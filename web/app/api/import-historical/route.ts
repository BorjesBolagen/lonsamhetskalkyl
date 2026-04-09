import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabaseServer';
import { getCurrentUser } from '@/lib/backend/utils';
import { ImportHttpError, processHistoricalCSV } from '@/lib/importEngine';

// create-upload-session: skapar import_job + signerad URL
// start-import: läser fil från Storage och importerar till DB
type CreateUploadSessionRequest = {
  action: 'create-upload-session';
  filename: string;
};

type StartImportRequest = {
  action: 'start-import';
  jobId: string;
};

type HistoricalImportRequest = CreateUploadSessionRequest | StartImportRequest;

async function requireAdminUser() {
  const supabase = await getSupabaseServerClient();
  const currentUser = await getCurrentUser(supabase);

  if (!currentUser.status || !currentUser.data) {
    throw new ImportHttpError(401, 'Kunde inte verifiera användare.');
  }

  if (currentUser.data.role !== 'admin') {
    throw new ImportHttpError(403, 'Endast admin kan importera historisk data.');
  }

  return currentUser.data;
}

async function handleCreateUploadSession(adminId: string, filename: string) {
  if (!filename) {
    throw new ImportHttpError(400, 'Filnamn saknas i request.');
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const jobId = crypto.randomUUID();
  const storagePath = `imports/${jobId}.csv`;

  const { error: insertError } = await supabaseAdmin
    .from('import_jobs')
    .insert({
      id: jobId,
      admin_id: adminId,
      status: 'uploading',
      storage_path: storagePath,
    });

  if (insertError) {
    throw new ImportHttpError(500, 'Kunde inte skapa import-jobb i databasen.');
  }

  const { data: signedUrlData, error: urlError } = await supabaseAdmin
    .storage
    .from('historical-imports')
    .createSignedUploadUrl(storagePath);

  if (urlError || !signedUrlData) {
    throw new ImportHttpError(500, 'Kunde inte generera uppladdnings-URL.');
  }

  return {
    jobId,
    uploadUrl: signedUrlData.signedUrl,
    storagePath,
  };
}

async function handleStartImport(adminId: string, jobId: string) {
  if (!jobId) {
    throw new ImportHttpError(400, 'jobId saknas i request.');
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: job, error: jobError } = await supabaseAdmin
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('admin_id', adminId)
    .single();

  if (jobError || !job) {
    throw new ImportHttpError(404, 'Import-jobb hittades inte.');
  }

  if (!job.storage_path) {
    throw new ImportHttpError(400, 'Lagringsväg saknas för import-jobbet.');
  }

  const storagePath = job.storage_path;

  try {
    await supabaseAdmin
      .from('import_jobs')
      .update({ status: 'validating' })
      .eq('id', jobId);

    const { data: fileBlob, error: downloadError } = await supabaseAdmin
      .storage
      .from('historical-imports')
      .download(storagePath);

    if (downloadError || !fileBlob) {
      throw new ImportHttpError(
        500,
        `Kunde inte ladda ned CSV-filen: ${downloadError?.message || 'Okänt fel'}`,
      );
    }

    const csvContent = await fileBlob.text();
    const result = await processHistoricalCSV(csvContent, adminId, storagePath);

    await supabaseAdmin
      .from('import_jobs')
      .update({
        status: 'completed',
        rows_total: result.rowsFound,
        rows_processed: result.rowsFound,
        rows_valid: result.rowsFound,
        rows_failed: result.rowsFound - result.insertedRows,
        inserted_row_count: result.insertedRows,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return {
      jobId,
      status: 'completed',
      result,
    };
  } catch (error) {
    const errorMessage =
      error instanceof ImportHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Okänt fel vid import';

    const validationErrors =
      error instanceof ImportHttpError && error.data?.errors ? error.data.errors : [];

    await supabaseAdmin
      .from('import_jobs')
      .update({
        status: 'error',
        error_message: errorMessage,
        validation_errors: validationErrors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw error;
  } finally {
    // Filen tas alltid bort efter importförsök (både success/failure).
    await supabaseAdmin.storage.from('historical-imports').remove([storagePath]);
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser();
    const body = (await request.json()) as HistoricalImportRequest;

    if (body.action === 'create-upload-session') {
      const session = await handleCreateUploadSession(adminUser.id, body.filename);
      return NextResponse.json(session);
    }

    if (body.action === 'start-import') {
      const result = await handleStartImport(adminUser.id, body.jobId);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Ogiltig action. Förväntade create-upload-session eller start-import.' },
      { status: 400 },
    );
  } catch (error) {
    // Alla kontrollerade ImportHttpError returneras med rätt statuskod.
    const statusCode = error instanceof ImportHttpError ? error.statusCode : 500;
    const message =
      error instanceof ImportHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Internt serverfel.';

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
