import "server-only";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type {
  AddonCalculationResult,
  AddonLocationLookup,
  CalculatedAddon,
  ProfitabilityInput,
} from "./types";

type UntypedRpcError = {
  message: string;
};

type UntypedRpcResult = {
  data: unknown;
  error: UntypedRpcError | null;
};

type UntypedSupabaseRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<UntypedRpcResult>;

type UntypedSelectResult = {
  data: unknown;
  error: UntypedRpcError | null;
};

type UntypedSupabaseFrom = (
  tableName: string,
) => {
  select: (columns: string) => Promise<UntypedSelectResult>;
};

type AddonTidRow = {
  name: string | null;
  linjerel: string | null;
  carriers_share: number | null;
};

const TIME_ADDON_AMOUNT = 828;

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNameKey(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeLineRelationKey(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-ZÅÄÖ]/g, "");
}

function toFiniteNumber(
  value: unknown,
  fallback = 0,
): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

function isAddonTidRow(
  value: unknown,
): value is AddonTidRow {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return false;
  }

  return (
    "name" in value
    && "linjerel" in value
    && "carriers_share" in value
  );
}

function emptyLocationLookup(): AddonLocationLookup {
  return {
    matchSource: "none",
    matchedRows: 0,
    matchedTaxPoint: null,
    matchedCity: null,
    localityClass: null,
    stor: null,
    hasBalanceAddon: false,
    ambiguous: {
      locality: false,
      metropolitan: false,
      balance: false,
    },
  };
}

/**
 * Delar taxepunktsrelationen i avsändar- och mottagartaxepunkt.
 * Exempel: "55302-11120" => senderTaxPoint = "55302", receiverTaxPoint = "11120".
 */
function splitTaxPointRelation(
  taxPointRelation: string | null | undefined,
): {
  senderTaxPoint: string | null;
  receiverTaxPoint: string | null;
} {
  const relation = normalizeOptionalText(taxPointRelation);

  if (!relation) {
    return {
      senderTaxPoint: null,
      receiverTaxPoint: null,
    };
  }

  const parts = relation
    .split(/[\-–—]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return {
    senderTaxPoint: parts[0] ?? null,
    receiverTaxPoint: parts[1] ?? null,
  };
}

/**
 * Normaliserar numeric-värden från Supabase till vanliga JavaScript-tal.
 */
function normalizeResult(
  value: AddonCalculationResult,
): AddonCalculationResult {
  return {
    ...value,

    chargeableWeight:
      toFiniteNumber(value.chargeableWeight),

    addonTotal:
      toFiniteNumber(value.addonTotal),

    addons: Array.isArray(value.addons)
      ? value.addons.map((addon) => ({
          ...addon,

          amount:
            toFiniteNumber(addon.amount),

          class:
            addon.class === null
              ? null
              : toFiniteNumber(addon.class),

          matchedTaxPoint:
            addon.matchedTaxPoint === null
              ? null
              : String(addon.matchedTaxPoint),
        }))
      : [],

    lookup: {
      sender:
        value.lookup?.sender
        ?? emptyLocationLookup(),

      receiver:
        value.lookup?.receiver
        ?? emptyLocationLookup(),
    },

    warnings: Array.isArray(value.warnings)
      ? value.warnings
      : [],
  };
}

async function resolveTimeAddon(
  supabase: unknown,
  customerName: string | null,
  lineRelation: string | null,
): Promise<CalculatedAddon | null> {
  const normalizedCustomerName = normalizeNameKey(customerName);
  const normalizedLineRelation = normalizeLineRelationKey(lineRelation);

  if (!normalizedCustomerName || !normalizedLineRelation) {
    return null;
  }

  const from = (
    supabase as { from: UntypedSupabaseFrom }
  ).from.bind(supabase);

  const { data, error } = await from("addon_tid")
    .select("name, linjerel, carriers_share");

  if (error) {
    throw new Error(
      `Tidstilläggen kunde inte hämtas: ${error.message}`,
    );
  }

  const rows = Array.isArray(data)
    ? data.filter(isAddonTidRow)
    : [];

  const match = rows.find((row) => (
    normalizeNameKey(row.name) === normalizedCustomerName
    && normalizeLineRelationKey(row.linjerel) === normalizedLineRelation
  ));

  if (!match) {
    return null;
  }

  const configuredAmount = toFiniteNumber(
    match.carriers_share,
    TIME_ADDON_AMOUNT,
  );

  const amount = configuredAmount > 0
    ? configuredAmount
    : TIME_ADDON_AMOUNT;

  return {
    id: -10_000,
    type: "tidtillagg",
    direction: "route",
    name: "Tidstillägg",
    amount,
    class: null,
    region: null,
    lookupSource: "name_linjerel",
    matchedTaxPoint: null,
    matchedCity: null,
  };
}

/**
 * Beräknar:
 *
 * - orttillägg från avsändaren
 * - orttillägg till mottagaren
 * - storstadstillägg till mottagaren
 * - balanstillägg till mottagaren
 * - tidstillägg utifrån kundnamn + linjerelation i addon_tid
 *
 * Taxepunkt används först. Postort används om taxepunkten inte hittas.
 */
export async function calculateApplicableAddons(
  input: ProfitabilityInput,
): Promise<AddonCalculationResult> {
  const weight =
    Number(input.chargeable_weight);

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(
      "Fraktgrundande vikt måste vara större än 0.",
    );
  }

  const relationParts =
    splitTaxPointRelation(input.taxPointRelation);

  const senderTaxPoint =
    normalizeOptionalText(input.senderTaxPoint)
    ?? relationParts.senderTaxPoint;

  const receiverTaxPoint =
    normalizeOptionalText(input.receiverTaxPoint)
    ?? relationParts.receiverTaxPoint;

  const customerName = normalizeOptionalText(
    input.kundnamn,
  );

  const lineRelation = normalizeOptionalText(
    input.linjerel,
  );

  const supabase =
    await getSupabaseServerClient();

  const rpc =
    supabase.rpc.bind(
      supabase,
    ) as unknown as UntypedSupabaseRpc;

  const {
    data,
    error,
  } = await rpc(
    "calculate_applicable_addons",
    {
      p_sender_taxepunkt:
        senderTaxPoint,

      p_sender_postort:
        normalizeOptionalText(
          input.pickupCity,
        ),

      p_receiver_taxepunkt:
        receiverTaxPoint,

      p_receiver_postort:
        normalizeOptionalText(
          input.destinationCity,
        ),

      p_chargeable_weight:
        weight,

      p_customer_name:
        customerName,

      p_linjerel:
        lineRelation,
    },
  );

  if (error) {
    throw new Error(
      `Tilläggen kunde inte beräknas: ${error.message}`,
    );
  }

  if (
    data === null
    || typeof data !== "object"
    || Array.isArray(data)
  ) {
    throw new Error(
      "Supabase returnerade ett ogiltigt tilläggsresultat.",
    );
  }

  const normalizedResult = normalizeResult(
    data as unknown as AddonCalculationResult,
  );

  const alreadyHasTimeAddon = normalizedResult.addons.some(
    (addon) => addon.type === "tidtillagg",
  );

  if (alreadyHasTimeAddon) {
    return normalizedResult;
  }

  let timeAddon: CalculatedAddon | null = null;

  try {
    timeAddon = await resolveTimeAddon(
      supabase,
      customerName,
      lineRelation,
    );
  } catch (error) {
    return {
      ...normalizedResult,
      warnings: [
        ...normalizedResult.warnings,
        {
          code: "TIME_ADDON_LOOKUP_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Tidstillägget kunde inte beräknas.",
        },
      ],
    };
  }

  if (!timeAddon) {
    return normalizedResult;
  }

  return {
    ...normalizedResult,
    addonTotal:
      normalizedResult.addonTotal + timeAddon.amount,
    addons: [
      ...normalizedResult.addons,
      timeAddon,
    ],
  };
}
