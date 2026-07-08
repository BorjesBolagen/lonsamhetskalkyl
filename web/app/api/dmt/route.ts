import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { Tables, TablesInsert } from "@/lib/supabaseServerSchema";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DmtRow = Tables<"addon_dmt">;
type DmtInsert = TablesInsert<"addon_dmt">;

type DmtParsedRule = DmtInsert;

type DmtImportSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  deletedDuplicates: number;
  periods: number;
  sheets: number;
};

type Matrix = unknown[][];

const DATE_FROM_MARKERS = ["DATE.FROM", "DATE FROM", "VALID.FROM", "VALID FROM"];
const DATE_TO_MARKERS = ["DATE.TO", "DATE TO", "VALID.TO", "VALID TO"];

function jsonResponse(status: boolean, message: string, data: unknown = null, httpStatus = 200) {
  return NextResponse.json(
    { status, message, data },
    { status: httpStatus },
  );
}

function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/Å/g, "A")
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/[^0-9A-Z.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRuleKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/Å/g, "A")
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/[^0-9A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function excelSerialDateToIso(value: number): string | null {
  if (!Number.isFinite(value)) return null;

  // Excel/Sheets lagrar datum som antal dagar sedan 1899-12-30.
  // Bygg ISO-datum från UTC-delarna så datumet inte flyttas av serverns tidszon.
  const utcMs = Math.round((value - 25569) * 86400 * 1000);
  const date = new Date(utcMs);

  if (Number.isNaN(date.getTime())) return null;

  return buildIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function dateObjectToIso(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;

  // Date-objekt från Excel kan representera lokal midnatt. Använd lokala datumdelar
  // i stället för toISOString(), annars kan 2026-07-01 bli 2026-06-30.
  return buildIsoDate(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
  );
}

function parseDateCell(value: unknown): string | null {
  if (value instanceof Date) {
    return dateObjectToIso(value);
  }

  if (typeof value === "number") {
    return excelSerialDateToIso(value);
  }

  const text = String(value ?? "").trim();

  if (!text) return null;

  const isoMatch = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  const slashDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slashDateMatch) {
    const [, first, second, year] = slashDateMatch;
    const firstNumber = Number(first);
    const secondNumber = Number(second);

    // DMT-filen visar datum som M/D/YYYY, t.ex. 7/1/2026 = 2026-07-01.
    // Om första talet är större än 12 tolkar vi det som D/M/YYYY.
    const month = firstNumber > 12 ? secondNumber : firstNumber;
    const day = firstNumber > 12 ? firstNumber : secondNumber;

    return buildIsoDate(Number(year), month, day);
  }

  const dottedOrDashedDateMatch = text.match(/\b(\d{1,2})[-.](\d{1,2})[-.](20\d{2})\b/);
  if (dottedOrDashedDateMatch) {
    const [, day, month, year] = dottedOrDashedDateMatch;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  const compactMatch = text.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  return null;
}

function markerMatches(value: unknown, markers: string[]): boolean {
  const normalized = normalizeLabel(value);

  return markers.some((marker) => normalized.includes(normalizeLabel(marker)));
}

function findDateByMarker(rows: Matrix, markers: string[]): string | null {
  for (const row of rows) {
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cell = row[colIndex];

      if (!markerMatches(cell, markers)) continue;

      const dateInSameCell = parseDateCell(cell);
      if (dateInSameCell) return dateInSameCell;

      // Den uppladdade DMT-filen har datumet två kolumner till höger om DATE.FROM/DATE.TO.
      // Fallbacks finns kvar så importer inte faller om filen exporteras med något annan spacing.
      for (const offset of [2, 1, 3, 4, 5]) {
        const date = parseDateCell(row[colIndex + offset]);
        if (date) return date;
      }
    }
  }

  return null;
}

function parsePercentageCell(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 0 && value <= 1 ? value * 100 : value;
  }

  const rawText = String(value ?? "").trim();
  if (!rawText) return null;

  const hasPercentSign = rawText.includes("%");
  const normalized = rawText
    .replace(/\s+/g, "")
    .replace("%", "")
    .replace(/,/g, ".");

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const numericValue = Number(match[0]);
  if (!Number.isFinite(numericValue)) return null;

  if (hasPercentSign) return numericValue;

  return numericValue > 0 && numericValue <= 1 ? numericValue * 100 : numericValue;
}

function findPercentageNextTo(row: unknown[], labelColumnIndex: number): number | null {
  // I DMT-filen ligger procentsatsen direkt bredvid intervallet/rubriken.
  const directValue = parsePercentageCell(row[labelColumnIndex + 1]);
  if (directValue !== null) return directValue;

  // Fallback för tomma mellan-celler från exporterade Excel-filer.
  for (let offset = 2; offset <= 4; offset += 1) {
    const candidate = row[labelColumnIndex + offset];
    if (isEmptyCell(candidate)) continue;

    const parsed = parsePercentageCell(candidate);
    if (parsed !== null) return parsed;

    break;
  }

  return null;
}

function parseKmIntervalLabel(value: unknown): { kmFrom: number; kmTo: number | null; ruleKey: string } | null {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[–—−]/g, "-")
    .toUpperCase()
    .replace(/KM/g, "")
    .trim();

  const match = text.match(/^(\d{1,4})\s*-\s*(\d{0,4})$/);
  if (!match) return null;

  const kmFrom = Number(match[1]);
  const kmTo = match[2] ? Number(match[2]) : null;

  if (!Number.isInteger(kmFrom) || kmFrom < 0) return null;
  if (kmTo !== null && (!Number.isInteger(kmTo) || kmTo < kmFrom)) return null;

  return {
    kmFrom,
    kmTo,
    ruleKey: `${kmFrom}-${kmTo ?? ""}`,
  };
}

function isFjarrPaketLabel(value: unknown): boolean {
  const normalized = normalizeRuleKey(value);

  return normalized === "FJARR_PAKET"
    || normalized === "FJARRPAKET"
    || normalized === "PAKETBUR_FJARR"
    || normalized === "PAKETBUR_FJARR_PAKET";
}

function collectRulesFromRows(rows: Matrix, validFrom: string, validTo: string): DmtParsedRule[] {
  const rules: DmtParsedRule[] = [];

  for (const row of rows) {
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cell = row[colIndex];
      if (isEmptyCell(cell)) continue;

      if (isFjarrPaketLabel(cell)) {
        const percentage = findPercentageNextTo(row, colIndex);

        if (percentage === null) continue;

        rules.push({
          valid_from: validFrom,
          valid_to: validTo,
          rule_type: "fjarr_paket",
          rule_key: "FJARR_PAKET",
          km_from: null,
          km_to: null,
          percentage,
        });
        continue;
      }

      const interval = parseKmIntervalLabel(cell);
      if (!interval) continue;

      const percentage = findPercentageNextTo(row, colIndex);
      if (percentage === null) continue;

      rules.push({
        valid_from: validFrom,
        valid_to: validTo,
        rule_type: "km_interval",
        rule_key: interval.ruleKey,
        km_from: interval.kmFrom,
        km_to: interval.kmTo,
        percentage,
      });
    }
  }

  return rules;
}

function getRuleIdentity(rule: DmtParsedRule): string {
  return [
    rule.valid_from,
    rule.valid_to,
    rule.rule_type,
    rule.rule_key,
    rule.km_from ?? "NULL",
    rule.km_to ?? "NULL",
  ].join("|");
}

function deduplicateParsedRules(rules: DmtParsedRule[]): { rules: DmtParsedRule[]; skipped: number } {
  const byIdentity = new Map<string, DmtParsedRule>();
  let skipped = 0;

  for (const rule of rules) {
    const identity = getRuleIdentity(rule);

    if (byIdentity.has(identity)) {
      skipped += 1;
    }

    byIdentity.set(identity, rule);
  }

  return {
    rules: [...byIdentity.values()],
    skipped,
  };
}

function parseDmtMatrices(sheetMatrices: Matrix[]): { rules: DmtParsedRule[]; skipped: number } {
  const parsedRules: DmtParsedRule[] = [];
  let skipped = 0;

  for (const rows of sheetMatrices) {
    const validFrom = findDateByMarker(rows, DATE_FROM_MARKERS);
    const validTo = findDateByMarker(rows, DATE_TO_MARKERS);

    if (!validFrom || !validTo) {
      skipped += 1;
      continue;
    }

    const rules = collectRulesFromRows(rows, validFrom, validTo);
    parsedRules.push(...rules);
  }

  const deduplicated = deduplicateParsedRules(parsedRules);

  return {
    rules: deduplicated.rules,
    skipped: skipped + deduplicated.skipped,
  };
}

function parsePastedTextToMatrix(text: string): Matrix {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"));
}

function normalizeExcelCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "object") return value;

  const cellObject = value as {
    result?: unknown;
    text?: unknown;
    richText?: Array<{ text?: unknown }>;
    hyperlink?: unknown;
  };

  if (cellObject.result !== undefined) {
    return normalizeExcelCellValue(cellObject.result);
  }

  if (typeof cellObject.text === "string") {
    return cellObject.text;
  }

  if (Array.isArray(cellObject.richText)) {
    return cellObject.richText
      .map((part) => String(part?.text ?? ""))
      .join("");
  }

  if (typeof cellObject.hyperlink === "string" && typeof cellObject.text === "string") {
    return cellObject.text;
  }

  return String(value);
}

async function parseXlsxFileToMatrices(file: File): Promise<Matrix[]> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("DMT-filen är för stor. Maxstorlek är 5 MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const signature = Buffer.from(arrayBuffer.slice(0, 4)).toString("hex");

  if (!signature.startsWith("504b")) {
    throw new Error("DMT-filen verkar inte vara en giltig .xlsx-fil.");
  }

  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const workbookBuffer = Buffer.from(arrayBuffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);

  const matrices: Matrix[] = [];

  workbook.worksheets.forEach((worksheet) => {
    const rows: Matrix = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const matrixRow: unknown[] = [];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        matrixRow[colNumber - 1] = normalizeExcelCellValue(cell.value);
      });

      rows[rowNumber - 1] = matrixRow;
    });

    matrices.push(rows);
  });

  return matrices;
}

function toDmtSettings(rows: DmtRow[]) {
  const sortedRows = [...rows].sort((a, b) => {
    if (a.valid_from !== b.valid_from) return b.valid_from.localeCompare(a.valid_from);
    if (a.valid_to !== b.valid_to) return b.valid_to.localeCompare(a.valid_to);
    return a.rule_key.localeCompare(b.rule_key);
  });

  if (sortedRows.length === 0) {
    return {
      validFrom: "",
      validTo: "",
      rules: [],
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeRows = sortedRows.filter(
    (row) => row.valid_from <= today && row.valid_to >= today,
  );
  const periodSource = activeRows.length > 0 ? activeRows : sortedRows;
  const selected = periodSource[0];
  const selectedRows = sortedRows.filter(
    (row) => row.valid_from === selected.valid_from && row.valid_to === selected.valid_to,
  );

  return {
    validFrom: selected.valid_from,
    validTo: selected.valid_to,
    rules: selectedRows.map((row) => ({
      id: row.id,
      ruleType: row.rule_type,
      ruleKey: row.rule_key,
      kmFrom: row.km_from,
      kmTo: row.km_to,
      percentage: row.percentage,
    })),
  };
}

async function loadDmtSettings() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("addon_dmt")
    .select("id, valid_from, valid_to, rule_type, rule_key, km_from, km_to, percentage")
    .order("valid_from", { ascending: false })
    .order("valid_to", { ascending: false })
    .order("rule_type", { ascending: true })
    .order("km_from", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return toDmtSettings((data ?? []) as DmtRow[]);
}

async function findExistingDmtRows(rule: DmtParsedRule): Promise<DmtRow[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("addon_dmt")
    .select("id, valid_from, valid_to, rule_type, rule_key, km_from, km_to, percentage")
    .eq("valid_from", rule.valid_from)
    .eq("valid_to", rule.valid_to)
    .eq("rule_type", rule.rule_type)
    .eq("rule_key", rule.rule_key);

  query = rule.km_from === null || rule.km_from === undefined
    ? query.is("km_from", null)
    : query.eq("km_from", rule.km_from);

  query = rule.km_to === null || rule.km_to === undefined
    ? query.is("km_to", null)
    : query.eq("km_to", rule.km_to);

  const { data, error } = await query.order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DmtRow[];
}

async function saveDmtRules(rules: DmtParsedRule[], initialSkipped: number, sheets: number): Promise<DmtImportSummary> {
  const supabase = await getSupabaseServerClient();
  let inserted = 0;
  let updated = 0;
  let deletedDuplicates = 0;

  for (const rule of rules) {
    const existingRows = await findExistingDmtRows(rule);
    const [primaryRow, ...duplicateRows] = existingRows;

    if (duplicateRows.length > 0) {
      const duplicateIds = duplicateRows.map((row) => row.id);
      const { error: deleteError } = await supabase
        .from("addon_dmt")
        .delete()
        .in("id", duplicateIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      deletedDuplicates += duplicateRows.length;
    }

    if (primaryRow) {
      const { error: updateError } = await supabase
        .from("addon_dmt")
        .update({
          percentage: rule.percentage,
          km_from: rule.km_from,
          km_to: rule.km_to,
        })
        .eq("id", primaryRow.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from("addon_dmt")
        .insert(rule);

      if (insertError) {
        throw new Error(insertError.message);
      }

      inserted += 1;
    }
  }

  const periods = new Set(rules.map((rule) => `${rule.valid_from}|${rule.valid_to}`)).size;

  return {
    inserted,
    updated,
    skipped: initialSkipped,
    deletedDuplicates,
    periods,
    sheets,
  };
}

async function importDmtMatrices(sheetMatrices: Matrix[]) {
  const parsed = parseDmtMatrices(sheetMatrices);

  if (parsed.rules.length === 0) {
    throw new Error(
      "Inga DMT-rader hittades. Kontrollera att filen innehåller DATE.FROM, DATE.TO, km-intervall, FJÄRR PAKET och procent direkt bredvid.",
    );
  }

  const summary = await saveDmtRules(
    parsed.rules,
    parsed.skipped,
    sheetMatrices.length,
  );
  const settings = await loadDmtSettings();

  return {
    summary,
    settings,
  };
}

export async function GET() {
  try {
    const settings = await loadDmtSettings();

    return jsonResponse(true, "DMT-inställning hämtad.", settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonResponse(false, `Kunde inte hämta DMT-inställning: ${message}`, null, 500);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return jsonResponse(false, "Ingen DMT-fil skickades med requesten.", null, 400);
      }

      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return jsonResponse(false, "DMT-importen stödjer bara .xlsx-filer.", null, 400);
      }

      const matrices = await parseXlsxFileToMatrices(file);
      const result = await importDmtMatrices(matrices);

      return jsonResponse(true, "DMT-filen importerades.", result);
    }

    if (contentType.includes("application/json")) {
      const body = await request.json() as { pastedText?: unknown };
      const pastedText = typeof body.pastedText === "string" ? body.pastedText : "";

      if (!pastedText.trim()) {
        return jsonResponse(false, "Ingen inklistrad DMT-data skickades med requesten.", null, 400);
      }

      const matrix = parsePastedTextToMatrix(pastedText);
      const result = await importDmtMatrices([matrix]);

      return jsonResponse(true, "Inklistrad DMT-data importerades.", result);
    }

    return jsonResponse(false, "Requesten måste vara multipart/form-data eller application/json.", null, 415);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonResponse(false, `Kunde inte importera DMT-data: ${message}`, null, 500);
  }
}
