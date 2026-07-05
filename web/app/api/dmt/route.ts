import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/authHelpers";

type DmtRuleKey =
  | "0-150"
  | "151-250"
  | "251-350"
  | "351-450"
  | "451-550"
  | "551-650"
  | "651-750"
  | "751-900"
  | "901-1100"
  | "1101-"
  | "FJARR_PAKET";

type DmtRuleType = "km_interval" | "fjarr_paket";

type DmtRuleConfig = {
  ruleKey: DmtRuleKey;
  ruleType: DmtRuleType;
  kmFrom: number | null;
  kmTo: number | null;
};

type DmtRequestRule = DmtRuleConfig & {
  percentage: number;
};

type DmtRow = {
  id?: number;
  valid_from: string;
  valid_to: string;
  rule_type: string;
  rule_key: string;
  km_from: number | null;
  km_to: number | null;
  percentage: number;
};

type DmtInsertRow = Omit<DmtRow, "id">;

type SupabaseError = {
  message: string;
};

const DMT_RULE_CONFIGS: DmtRuleConfig[] = [
  { ruleKey: "0-150", ruleType: "km_interval", kmFrom: 0, kmTo: 150 },
  { ruleKey: "151-250", ruleType: "km_interval", kmFrom: 151, kmTo: 250 },
  { ruleKey: "251-350", ruleType: "km_interval", kmFrom: 251, kmTo: 350 },
  { ruleKey: "351-450", ruleType: "km_interval", kmFrom: 351, kmTo: 450 },
  { ruleKey: "451-550", ruleType: "km_interval", kmFrom: 451, kmTo: 550 },
  { ruleKey: "551-650", ruleType: "km_interval", kmFrom: 551, kmTo: 650 },
  { ruleKey: "651-750", ruleType: "km_interval", kmFrom: 651, kmTo: 750 },
  { ruleKey: "751-900", ruleType: "km_interval", kmFrom: 751, kmTo: 900 },
  { ruleKey: "901-1100", ruleType: "km_interval", kmFrom: 901, kmTo: 1100 },
  { ruleKey: "1101-", ruleType: "km_interval", kmFrom: 1101, kmTo: null },
  { ruleKey: "FJARR_PAKET", ruleType: "fjarr_paket", kmFrom: null, kmTo: null },
];

const DMT_RULE_KEYS = DMT_RULE_CONFIGS.map((rule) => rule.ruleKey);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}

function isDmtRuleKey(value: unknown): value is DmtRuleKey {
  return typeof value === "string" && DMT_RULE_KEYS.includes(value as DmtRuleKey);
}

function getRuleConfig(ruleKey: DmtRuleKey): DmtRuleConfig {
  const config = DMT_RULE_CONFIGS.find((rule) => rule.ruleKey === ruleKey);

  if (!config) {
    throw new Error(`Okänd DMT-regel: ${ruleKey}`);
  }

  return config;
}

function parseDmtRules(value: unknown): DmtRequestRule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rules: DmtRequestRule[] = [];

  for (const item of value) {
    if (!isPlainObject(item) || !isDmtRuleKey(item.ruleKey)) {
      return null;
    }

    const percentage = Number(item.percentage);

    if (!Number.isFinite(percentage) || percentage < 0) {
      return null;
    }

    const config = getRuleConfig(item.ruleKey);

    rules.push({
      ...config,
      percentage,
    });
  }

  const uniqueKeys = new Set(rules.map((rule) => rule.ruleKey));
  const hasAllRules = DMT_RULE_KEYS.every((ruleKey) => uniqueKeys.has(ruleKey));

  return hasAllRules && uniqueKeys.size === DMT_RULE_KEYS.length
    ? rules
    : null;
}

async function requireAdmin() {
  const { error: userError } = await requireUser();
  if (userError) return { supabase: null, userId: null, error: userError };

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      userId: null,
      error: NextResponse.json(
        { status: false, message: "Ej autentiserad" },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("User")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      supabase,
      userId: user.id,
      error: NextResponse.json(
        {
          status: false,
          message:
            "Kunde inte kontrollera adminbehörighet: " + profileError.message,
        },
        { status: 500 },
      ),
    };
  }

  if (profile?.role !== "admin") {
    return {
      supabase,
      userId: user.id,
      error: NextResponse.json(
        { status: false, message: "Saknar behörighet" },
        { status: 403 },
      ),
    };
  }

  return { supabase, userId: user.id, error: null };
}

function getAddonDmtTable(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  return (supabase.from as unknown as (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        options?: { ascending?: boolean },
      ) => {
        limit: (count: number) => Promise<{ data: unknown; error: SupabaseError | null }>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          in: (
            column: string,
            values: string[],
          ) => Promise<{ error: SupabaseError | null }>;
        };
      };
    };
    insert: (rows: DmtInsertRow[]) => Promise<{ error: SupabaseError | null }>;
  })("addon_dmt");
}

export async function GET() {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const addonDmt = getAddonDmtTable(supabase!);

  const { data, error: fetchError } = await addonDmt
    .select("id, valid_from, valid_to, rule_type, rule_key, km_from, km_to, percentage")
    .order("valid_from", { ascending: false })
    .limit(200);

  if (fetchError) {
    return NextResponse.json(
      {
        status: false,
        message: "Kunde inte hämta DMT-inställning: " + fetchError.message,
      },
      { status: 500 },
    );
  }

  const rows = Array.isArray(data) ? (data as DmtRow[]) : [];
  const firstRow = rows[0];

  if (!firstRow) {
    return NextResponse.json({
      status: true,
      data: {
        validFrom: "",
        validTo: "",
        rules: [],
      },
    });
  }

  const latestRows = rows.filter(
    (row) =>
      row.valid_from === firstRow.valid_from && row.valid_to === firstRow.valid_to,
  );

  return NextResponse.json({
    status: true,
    data: {
      validFrom: firstRow.valid_from,
      validTo: firstRow.valid_to,
      rules: latestRows.map((row) => ({
        ruleType: row.rule_type,
        ruleKey: row.rule_key,
        kmFrom: row.km_from,
        kmTo: row.km_to,
        percentage: Number(row.percentage),
      })),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);

  if (!isPlainObject(body)) {
    return NextResponse.json(
      { status: false, message: "Ogiltig DMT-payload." },
      { status: 400 },
    );
  }

  const validFrom = body.validFrom;
  const validTo = body.validTo;
  const rules = parseDmtRules(body.rules);

  if (!isValidIsoDate(validFrom) || !isValidIsoDate(validTo)) {
    return NextResponse.json(
      {
        status: false,
        message: "Valid from och valid to måste anges i formatet YYYY-MM-DD.",
      },
      { status: 400 },
    );
  }

  if (new Date(validTo) < new Date(validFrom)) {
    return NextResponse.json(
      { status: false, message: "Valid to måste vara efter eller samma som valid from." },
      { status: 400 },
    );
  }

  if (!rules) {
    return NextResponse.json(
      {
        status: false,
        message: "Alla DMT-rader måste skickas med en procentsats större än eller lika med 0.",
      },
      { status: 400 },
    );
  }

  const rows: DmtInsertRow[] = rules.map((rule) => ({
    valid_from: validFrom,
    valid_to: validTo,
    rule_type: rule.ruleType,
    rule_key: rule.ruleKey,
    km_from: rule.kmFrom,
    km_to: rule.kmTo,
    percentage: rule.percentage,
  }));

  const addonDmt = getAddonDmtTable(supabase!);

  const { error: deleteError } = await addonDmt
    .delete()
    .eq("valid_from", validFrom)
    .eq("valid_to", validTo)
    .in("rule_key", [...DMT_RULE_KEYS]);

  if (deleteError) {
    return NextResponse.json(
      {
        status: false,
        message: "Kunde inte ersätta tidigare DMT-rader: " + deleteError.message,
      },
      { status: 500 },
    );
  }

  const { error: insertError } = await addonDmt.insert(rows);

  if (insertError) {
    return NextResponse.json(
      {
        status: false,
        message: "Kunde inte spara DMT-rader: " + insertError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: true,
    message: "DMT-inställning sparad",
    data: {
      validFrom,
      validTo,
      insertedRows: rows.length,
    },
  });
}
