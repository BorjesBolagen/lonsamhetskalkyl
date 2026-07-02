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

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePostalCode(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
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

function toNullableString(
  value: unknown,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function emptyLocationLookup(): AddonLocationLookup {
  return {
    matchSource: "none",
    matchedRows: 0,
    matchedTaxPoint: null,
    matchedPostalCode: null,
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

function normalizeAddon(
  addon: CalculatedAddon,
): CalculatedAddon {
  const matchedPostalCode =
    toNullableString(addon.matchedPostalCode)
    ?? toNullableString(addon.matchedTaxPoint);

  return {
    ...addon,

    amount:
      toFiniteNumber(addon.amount),

    class:
      addon.class === null
        ? null
        : toFiniteNumber(addon.class),

    matchedPostalCode,

    // Bakåtkompatibilitet. Fältet heter fortfarande matchedTaxPoint i delar av UI:t,
    // men värdet är nu postnummer från addons_postal.
    matchedTaxPoint:
      toNullableString(addon.matchedTaxPoint)
      ?? matchedPostalCode,
  };
}

function normalizeLookup(
  lookup: AddonLocationLookup | null | undefined,
): AddonLocationLookup {
  if (!lookup) {
    return emptyLocationLookup();
  }

  const matchedPostalCode =
    toNullableString(lookup.matchedPostalCode)
    ?? toNullableString(lookup.matchedTaxPoint);

  return {
    ...lookup,

    matchedRows:
      toFiniteNumber(lookup.matchedRows),

    matchedPostalCode,

    // Bakåtkompatibilitet. Värdet är postnummer.
    matchedTaxPoint:
      toNullableString(lookup.matchedTaxPoint)
      ?? matchedPostalCode,

    matchedCity:
      toNullableString(lookup.matchedCity),

    localityClass:
      lookup.localityClass === null
        ? null
        : toFiniteNumber(lookup.localityClass),

    ambiguous: {
      locality: Boolean(lookup.ambiguous?.locality),
      metropolitan: Boolean(lookup.ambiguous?.metropolitan),
      balance: Boolean(lookup.ambiguous?.balance),
    },
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
      ? value.addons.map(normalizeAddon)
      : [],

    lookup: {
      sender:
        normalizeLookup(value.lookup?.sender),

      receiver:
        normalizeLookup(value.lookup?.receiver),
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
 * - TID-tillägg via kundnamn och linjerelation
 *
 * Postnummer används först. Postort används som fallback i Supabase om
 * postnummer saknas eller inte ger träff.
 *
 * RPC-parametrarna heter fortfarande p_*_taxepunkt för bakåtkompatibilitet,
 * men värdet som skickas är postnummer från iLog.
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

  const senderPostalCode =
    normalizePostalCode(input.pickupPostalCode);

  const receiverPostalCode =
    normalizePostalCode(input.destinationPostalCode);

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
      // Bakåtkompatibla parameternamn. Värdet är postnummer, inte taxepunkt.
      p_sender_taxepunkt:
        senderPostalCode,

      p_sender_postort:
        normalizeOptionalText(
          input.pickupCity,
        ),

      p_receiver_taxepunkt:
        receiverPostalCode,

      p_receiver_postort:
        normalizeOptionalText(
          input.destinationCity,
        ),

      p_chargeable_weight:
        weight,

      p_customer_name:
        normalizeOptionalText(
          input.kundnamn,
        ),

      p_linjerel:
        normalizeOptionalText(
          input.linjerel,
        ),
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
