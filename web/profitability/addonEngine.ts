import "server-only";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type {
  AddonCalculationResult,
  AddonLocationLookup,
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

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

/**
 * Beräknar:
 *
 * - orttillägg från avsändaren
 * - orttillägg till mottagaren
 * - storstadstillägg till mottagaren
 * - balanstillägg till mottagaren
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

  const supabase =
    await getSupabaseServerClient();

  // De genererade Supabase-typerna känner inte till nya SQL-funktioner
  // förrän databastyperna har regenererats. Därför görs just detta RPC-anrop otypat.
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

  return normalizeResult(
    data as unknown as AddonCalculationResult,
  );
}
