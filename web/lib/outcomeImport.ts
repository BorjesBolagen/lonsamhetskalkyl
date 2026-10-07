import "server-only";

/**
 * outcomeImport — tolkar Excel-filen med utfall per bil (regnr i kolumn A,
 * total intäkt i kolumn B) och normaliserar regnr.
 */

import ExcelJS from "exceljs";

export type OutcomeRow = { regnr: string; revenue: number };

export type OutcomeParseResult = {
  rows: OutcomeRow[];
  errors: string[];
  duplicateRegnr: string[];
};

export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "abc 123" / "ABC-123" -> "ABC123". Samma normalisering som i SQL. */
export function normalizeRegnr(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("result" in value) return cellToText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
    if (value instanceof Date) return "";
  }
  return String(value).trim();
}

function cellToNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cellToText(value).replace(/[\s ]/g, "").replace(",", ".");
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Läser första kalkylbladet. Duplicerade regnr summeras. */
export async function parseOutcomeWorkbook(
  buffer: ArrayBuffer,
): Promise<OutcomeParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  const errors: string[] = [];
  if (!sheet) {
    return { rows: [], errors: ["Filen innehåller inget kalkylblad."], duplicateRegnr: [] };
  }

  const totals = new Map<string, number>();
  const duplicates = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const rawRegnr = cellToText(row.getCell(1).value);
    const rawRevenue = row.getCell(2).value;
    if (rawRegnr === "" && cellToText(rawRevenue) === "") return;

    const revenue = cellToNumber(rawRevenue);

    // Rubrikrad: första raden där kolumn B inte är ett tal.
    if (rowNumber === 1 && revenue === null) return;

    const regnr = normalizeRegnr(rawRegnr);
    if (regnr === "") {
      errors.push(`Rad ${rowNumber}: regnr saknas.`);
      return;
    }
    if (revenue === null) {
      errors.push(`Rad ${rowNumber}: intäkten för ${regnr} är inte ett tal.`);
      return;
    }

    if (totals.has(regnr)) duplicates.add(regnr);
    totals.set(regnr, (totals.get(regnr) ?? 0) + revenue);
  });

  const rows = Array.from(totals.entries()).map(([regnr, revenue]) => ({
    regnr,
    revenue,
  }));
  return { rows, errors, duplicateRegnr: Array.from(duplicates) };
}
