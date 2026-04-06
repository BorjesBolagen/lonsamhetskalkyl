import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabaseServer';
import { getCurrentUser } from '@/lib/backend/utils';
import type { Database } from '@/lib/supabaseServerSchema';

// Typ för en rad som ska kunna sparas i Historical_shipment.
// Denna kommer användas när vi mappar CSV -> databasrad.
type HistoricalInsert = Database['public']['Tables']['Historical_shipment']['Insert']

// Resultatet av CSV-parsning: en header-rad + alla data-rader.
type ParsedCSV = {
    header: string[];
    rows: string[][];
};

// Kolumner som MÅSTE finnas i CSV för att importen ska godkännas.
const REQUIRED_HEADERS = [
    'avbgsp_id',
    'Fraktsedelsnr',
    'Kundnr',
    'Kundnamn',
    'Linjenr',
    'Avsändandeort',
    'Avs postnr',
    'Bestammelseort',
    'Bes postnr',
    'Lf-datum',
    'Avräkningsdatum',
    'Ers exk tillägg',
    'Ers ink tillägg',
    'Kundnettofrakt',
    'DMT',
    'Enhet',
    'Fraktgrundandevikt',
] as const;

function getMissingHeaders(headers: string[]): string[] {
    // Returnerar alla obligatoriska kolumner som INTE finns i filens header.
    return REQUIRED_HEADERS.filter((required) => !headers.includes(required));
}

type ImportProgress = {
    // validating = radkontroll, inserting = DB-skrivning
    phase: 'validating' | 'inserting';
    processedRows: number;
    totalRows: number;
    percentage: number;
    message: string;
};

type ImportResult = {
    columnsFound: number;
    rowsFound: number;
    insertedRows: number;
};

type ImportErrorData = {
    errorCount?: number;
    errors?: string[];
};

class ImportHttpError extends Error {
    public readonly statusCode: number;
    public readonly data?: ImportErrorData;

    constructor(statusCode: number, message: string, data?: ImportErrorData) {
        super(message);
        this.name = 'ImportHttpError';
        this.statusCode = statusCode;
        this.data = data;
    }
}

function mapImportError(error: unknown): {
    statusCode: number;
    message: string;
    data?: ImportErrorData;
} {
    // Central felmappning så både JSON-svar och stream-svar hanterar fel lika.
    if (error instanceof ImportHttpError) {
        return {
            statusCode: error.statusCode,
            message: error.message,
            data: error.data,
        };
    }

    return {
        statusCode: 500,
        message: error instanceof Error ? error.message : 'Internal server error',
    };
}

async function runHistoricalImport(
    request: Request,
    onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
    // runHistoricalImport innehåller all importlogik och är "motor"n.
    // Samma motor används av både:
    // 1) klassisk JSON-endpoint
    // 2) streamad progress-endpoint
    const supabase = await getSupabaseServerClient();
    const currentUser = await getCurrentUser(supabase);

    if (!currentUser.status || !currentUser.data) {
        throw new ImportHttpError(401, 'Kunde inte verifiera användare.');
    }

    if (currentUser.data.role !== 'admin') {
        throw new ImportHttpError(403, 'Endast admin kan importera historisk data.');
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
        throw new ImportHttpError(400, 'Ingen fil mottagen.');
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new ImportHttpError(400, 'Endast .csv-filer är tillåtna.');
    }

    const content = await file.text();
    const parsed = parseCSV(content);

    const missingHeaders = getMissingHeaders(parsed.header);
    if (missingHeaders.length > 0) {
        throw new ImportHttpError(
            400,
            `CSV saknar obligatoriska kolumner: ${missingHeaders.join(', ')}`,
        );
    }

    const headerIndexMap = new Map<string, number>();
    parsed.header.forEach((columnName, idx) => headerIndexMap.set(columnName, idx));

    const getCell = (row: string[], headerName: string): string => {
        const idx = headerIndexMap.get(headerName);
        if (idx === undefined) {
            return '';
        }
        return (row[idx] ?? '').trim();
    };

    const rowsToInsert: HistoricalInsert[] = [];
    const rowErrors: string[] = [];
    const importedAt = new Date().toISOString();
    const totalRows = parsed.rows.length;

    // Valideringspass: vi bygger upp rowsToInsert i minnet.
    // Om en enda rad är felaktig avbryts hela importen (all-or-nothing).
    for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const rowNumber = i + 2;

        const shipmentIdRaw = getCell(row, 'Fraktsedelsnr');
        if (!shipmentIdRaw) {
            continue;
        }

        const avbgspId = normalizeInteger(getCell(row, 'avbgsp_id'));
        const shipmentId = normalizeInteger(getCell(row, 'Fraktsedelsnr'));
        const customerId = normalizeInteger(getCell(row, 'Kundnr'));
        const customerNameRaw = getCell(row, 'Kundnamn');
        const customerName = customerNameRaw || null;
        const lineNumber = normalizeInteger(getCell(row, 'Linjenr'));
        const senderCity = getCell(row, 'Avsändandeort');
        const senderZip = normalizeInteger(getCell(row, 'Avs postnr'));
        const receiverCity = getCell(row, 'Bestammelseort');
        const receiverZip = normalizeInteger(getCell(row, 'Bes postnr'));
        const dateCompleted = normalizeDate(getCell(row, 'Lf-datum'));
        const uploadDate = normalizeDate(getCell(row, 'Avräkningsdatum'));
        const compExclAddon = normalizeNumber(getCell(row, 'Ers exk tillägg'));
        const compInclAddon = normalizeNumber(getCell(row, 'Ers ink tillägg'));
        const netCustomerFreight = normalizeNumber(getCell(row, 'Kundnettofrakt'));
        const dmt = normalizeNumber(getCell(row, 'DMT')) ?? 0;
        const regNumber = getCell(row, 'Enhet');
        const weight = normalizeInteger(getCell(row, 'Fraktgrundandevikt'));

        if (avbgspId === null) rowErrors.push(`Rad ${rowNumber}: avbgsp_id är ogiltig.`);
        if (shipmentId === null) rowErrors.push(`Rad ${rowNumber}: Fraktsedelsnr är ogiltig.`);
        if (customerId === null) rowErrors.push(`Rad ${rowNumber}: Kundnr är ogiltig.`);
        if (lineNumber === null) rowErrors.push(`Rad ${rowNumber}: Linjenr är ogiltig.`);
        if (!senderCity) rowErrors.push(`Rad ${rowNumber}: Avsändandeort saknas.`);
        if (senderZip === null) rowErrors.push(`Rad ${rowNumber}: Avs postnr är ogiltigt.`);
        if (!receiverCity) rowErrors.push(`Rad ${rowNumber}: Bestammelseort saknas.`);
        if (receiverZip === null) rowErrors.push(`Rad ${rowNumber}: Bes postnr är ogiltigt.`);
        if (dateCompleted === null) rowErrors.push(`Rad ${rowNumber}: Lf-datum är ogiltigt.`);
        if (uploadDate === null) rowErrors.push(`Rad ${rowNumber}: Avräkningsdatum är ogiltigt.`);
        if (compExclAddon === null) rowErrors.push(`Rad ${rowNumber}: Ers exk tillägg är ogiltig.`);
        if (compInclAddon === null) rowErrors.push(`Rad ${rowNumber}: Ers ink tillägg är ogiltig.`);
        if (netCustomerFreight === null) rowErrors.push(`Rad ${rowNumber}: Kundnettofrakt är ogiltig.`);
        if (!regNumber) rowErrors.push(`Rad ${rowNumber}: Enhet saknas.`);
        if (weight === null) rowErrors.push(`Rad ${rowNumber}: Fraktgrundandevikt är ogiltig.`);

        if (
            avbgspId !== null &&
            shipmentId !== null &&
            customerId !== null &&
            lineNumber !== null &&
            senderCity &&
            senderZip !== null &&
            receiverCity &&
            receiverZip !== null &&
            dateCompleted !== null &&
            uploadDate !== null &&
            compExclAddon !== null &&
            compInclAddon !== null &&
            netCustomerFreight !== null &&
            regNumber &&
            weight !== null
        ) {
            rowsToInsert.push({
                avbgsp_id: avbgspId,
                shipment_id: shipmentId,
                customer_id: customerId,
                customer_name: customerName,
                FLM: null,
                volume: null,
                weight,
                line_number: lineNumber,
                sender_zip: senderZip,
                receiver_zip: receiverZip,
                sender_city: senderCity,
                receiver_city: receiverCity,
                reg_number: regNumber,
                date_completed: dateCompleted,
                upload_date: uploadDate,
                comp_excl_addon: compExclAddon,
                comp_incl_addon: compInclAddon,
                net_customer_freight: netCustomerFreight,
                DMT: dmt,
                admin_ID: currentUser.data.id,
                imported_at: importedAt,
                source_file_name: file.name,
            });
        }

        if (onProgress && totalRows > 0 && ((i + 1) % 250 === 0 || i === totalRows - 1)) {
            // Progress skickas i intervall för att undvika för tät event-spam.
            onProgress({
                phase: 'validating',
                processedRows: i + 1,
                totalRows,
                percentage: Math.round(((i + 1) / totalRows) * 100),
                message: 'Validerar rader...',
            });
        }
    }

    if (rowErrors.length > 0) {
        // Full success-regel: inga partiella inserts vid valideringsfel.
        throw new ImportHttpError(
            400,
            `Validering misslyckades. Första fel: ${rowErrors[0]}`,
            {
                errorCount: rowErrors.length,
                errors: rowErrors,
            },
        );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new ImportHttpError(
            500,
            'Import misslyckades: SUPABASE_SERVICE_ROLE_KEY saknas i servermiljön.',
        );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    // Batchad insert gör att vi kan ge progress under lång DB-fas
    // och minskar risken för timeouts jämfört med en enda jättestor insert.
    const batchSize = 500;
    const totalInsertRows = rowsToInsert.length;
    let insertedRows = 0;

    for (let start = 0; start < totalInsertRows; start += batchSize) {
        const batch = rowsToInsert.slice(start, start + batchSize);
        const { error: insertError } = await supabaseAdmin
            .from('Historical_shipment')
            .insert(batch);

        if (insertError) {
            throw new ImportHttpError(
                500,
                `Import misslyckades vid databasskrivning: ${insertError.message}`,
            );
        }

        insertedRows += batch.length;
        if (onProgress && totalInsertRows > 0) {
            onProgress({
                phase: 'inserting',
                processedRows: insertedRows,
                totalRows: totalInsertRows,
                percentage: Math.round((insertedRows / totalInsertRows) * 100),
                message: 'Sparar rader i databasen...',
            });
        }
    }

    return {
        columnsFound: parsed.header.length,
        rowsFound: parsed.rows.length,
        insertedRows,
    };
}

export async function POST(request: Request) {
    // Headern styr om klienten vill ha streamad progress (NDJSON)
    // eller klassiskt JSON-svar när allt är klart.
    const wantsProgressStream = request.headers.get('x-import-progress') === '1';

    if (!wantsProgressStream) {
        try {
            const data = await runHistoricalImport(request);
            return NextResponse.json({
                status: true,
                message: 'CSV importerad.',
                data,
            });
        } catch (error) {
            const mapped = mapImportError(error);
            return NextResponse.json(
                {
                    status: false,
                    message: mapped.message,
                    ...(mapped.data ? { data: mapped.data } : {}),
                },
                { status: mapped.statusCode }
            );
        }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            // Varje rad i streamen är ett JSON-objekt + newline (NDJSON).
            const send = (payload: unknown) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
            };

            void (async () => {
                try {
                    const data = await runHistoricalImport(request, (progress) => {
                        send({
                            type: 'progress',
                            ...progress,
                        });
                    });

                    send({
                        type: 'result',
                        result: {
                            status: true,
                            message: 'CSV importerad.',
                            data,
                        },
                    });
                } catch (error) {
                    const mapped = mapImportError(error);
                    send({
                        type: 'error',
                        statusCode: mapped.statusCode,
                        message: mapped.message,
                        data: mapped.data,
                    });
                } finally {
                    // Viktigt att alltid stänga streamen så klienten vet att jobbet är klart.
                    controller.close();
                }
            })();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
        },
    });
}

// Läser en rad från CSV och delar upp den på semikolon.
// Hanterar citattecken så att t.ex. "A;B" inte delas i två kolumner.
function parseSemicolonLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    // Går tecken för tecken genom raden för att korrekt hantera citattecken.
    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        // Om vi hittar citattecken: växla "inQuotes" eller hantera escaped quote "".
        if (char === '"') {
            const next = line[i + 1];

            // Dubbla citattecken inne i citat betyder ett bokstavligt citattecken.
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                // Annars går vi in/ut ur citatläge.
                inQuotes = !inQuotes;
            }
            continue;
        }

        // Semikolon avslutar en kolumn ENDAST om vi inte är inne i citat.
        if (char === ';' && !inQuotes) {
            fields.push(current.trim());
            current = '';
            continue;
        }

        // Vanligt tecken: bygg vidare på aktuell kolumntext.
        current += char;
    }

    // Lägg till sista kolumnen efter loopen.
    fields.push(current.trim());
    return fields;
}

// Konverterar text -> number.
// Klarar svenska decimaler (",") och ignorerar tomma/NULL-värden.
function normalizeNumber(value: string | undefined): number | null {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
    }

    // Ta bort mellanrum o byter decimaltecken till punkt
    const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
}

// Samma som normalizeNumber men returnerar heltal.
// Om talet inte är heltal avrundas det (kan ändras senare om ni vill vara striktare).
function normalizeInteger(value: string | undefined): number | null {
    const n = normalizeNumber(value);
    if (n === null) {
        return null;
    }

    // Returnera heltal direkt, annars avrunda närmaste heltal.
    return Number.isInteger(n) ? n : Math.round(n);
}

// Validerar och normaliserar datum i format YYYY-MM-DD.
// Returnerar null om datumet är tomt, NULL eller ogiltigt.
function normalizeDate(value: string | undefined): string | null {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
    }

    // Förväntat format: "yyyy-mm-dd"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null;
    }

    const timestamp = Date.parse(trimmed);
    if (Number.isNaN(timestamp)) {
        return null;
    }

    return trimmed;
}

// Parser hela CSV-innehållet till header + rader.
// 1) Tar bort BOM, 2) hittar rubrikraden, 3) filtrerar bort tomma rader,
// 4) ser till att varje rad har samma antal kolumner som headern.
function parseCSV(content: string): ParsedCSV {
    const cleaned = content.replace(/\uFEFF/, ''); // Ta bort eventuella BOM-tecken
    const lines = cleaned.split(/\r?\n/).filter(line => line.trim() !== '');

    // Vi söker efter rubrikraden som innehåller Fraktsedelsnr (vårt shipment_id).
    const headerIndex = lines.findIndex((line) => line.includes('Fraktsedelsnr;'));
    if (headerIndex === -1) {
        throw new Error('Kunde inte hitta rubrikraden i CSV-filen.');
    }

    const header = parseSemicolonLine(lines[headerIndex]);
    const rows: string[][] = [];

    // Startar efter header-raden och parser varje datarad.
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const parsed = parseSemicolonLine(lines[i]);

        // Hoppa över helttomma rader
        const hasData = parsed.some((cell) => cell !== '' && cell.toLowerCase() !== 'null');
        if (!hasData) {
            continue;
        }

        // Se till att raden har lika många kolumner som headern
        while (parsed.length < header.length) {
            parsed.push('');
        }

        // Spara en normaliserad rad (rätt antal kolumner).
        rows.push(parsed);
    }

    return { header, rows };
}