import { getSupabaseAdminClient } from '@/lib/supabaseServer';
import type { Database } from '@/lib/supabaseServerSchema';

// Typ för en rad som ska kunna sparas i Historical_shipment.
export type HistoricalInsert = Database['public']['Tables']['Historical_shipment']['Insert'];

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

export function getMissingHeaders(headers: string[]): string[] {
    return REQUIRED_HEADERS.filter((required) => !headers.includes(required));
}

export type ImportProgress = {
    phase: 'validating' | 'inserting';
    processedRows: number;
    totalRows: number;
    percentage: number;
    message: string;
};

export type ImportResult = {
    columnsFound: number;
    rowsFound: number;
    insertedRows: number;
};

export class ImportHttpError extends Error {
    // statusCode används av route-lagret för att skicka rätt HTTP-status till klienten.
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly data?: { errorCount?: number; errors?: string[] }
    ) {
        super(message);
        this.name = 'ImportHttpError';
    }
}

/**
 * Läser en rad från CSV och delar upp den på semikolon.
 * Hanterar citattecken så att t.ex. "A;B" inte delas i två kolumner.
 */
function parseSemicolonLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ';' && !inQuotes) {
            fields.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    fields.push(current.trim());
    return fields;
}

/**
 * Konverterar text -> number.
 * Klarar svenska decimaler (",") och ignorerar tomma/NULL-värden.
 */
export function normalizeNumber(value: string | undefined): number | null {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
    }

    const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Samma som normalizeNumber men returnerar heltal.
 */
export function normalizeInteger(value: string | undefined): number | null {
    const n = normalizeNumber(value);
    if (n === null) {
        return null;
    }

    return Number.isInteger(n) ? n : Math.round(n);
}

/**
 * Validerar och normaliserar datum i format YYYY-MM-DD.
 * Returnerar null om datumet är tomt, NULL eller ogiltigt.
 */
export function normalizeDate(value: string | undefined): string | null {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null;
    }

    const timestamp = Date.parse(trimmed);
    if (Number.isNaN(timestamp)) {
        return null;
    }

    return trimmed;
}

/**
 * Parser hela CSV-innehållet till header + rader.
 * Hanterar BOM, citattecken, och filtrerar tomma rader.
 */
export function parseCSV(content: string): ParsedCSV {
    const cleaned = content.replace(/\uFEFF/, '');
    const lines = cleaned.split(/\r?\n/).filter(line => line.trim() !== '');

    const headerIndex = lines.findIndex((line) => line.includes('Fraktsedelsnr;'));
    if (headerIndex === -1) {
        throw new ImportHttpError(400, 'Kunde inte hitta rubrikraden i CSV-filen.');
    }

    const header = parseSemicolonLine(lines[headerIndex]);
    const rows: string[][] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const parsed = parseSemicolonLine(lines[i]);
        const hasData = parsed.some((cell) => cell !== '' && cell.toLowerCase() !== 'null');
        if (!hasData) {
            continue;
        }

        while (parsed.length < header.length) {
            parsed.push('');
        }

        rows.push(parsed);
    }

    return { header, rows };
}

/**
 * Processerar CSV-innehål: parsing, validering, och insert.
 * Returnerar antal rader som lästs in.
 */
export async function processHistoricalCSV(
    csvContent: string,
    adminId: string,
    sourceFileName: string,
    onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const parsed = parseCSV(csvContent);

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

    // Valideringspass
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
                admin_ID: adminId,
                imported_at: importedAt,
                source_file_name: sourceFileName,
            });
        }

        if (onProgress && totalRows > 0 && ((i + 1) % 250 === 0 || i === totalRows - 1)) {
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
