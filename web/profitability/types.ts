export type AddonDirection = "from" | "to";

export type AddonType =
  | "orttillagg"
  | "storstadstillagg"
  | "balanstillagg";

export type AddonLookupSource =
  | "taxepunkt"
  | "postort"
  | "none";

export type CalculatedAddon = {
  id: number;
  type: AddonType;
  direction: AddonDirection;
  name: string;
  amount: number;
  class: number | null;
  region: "stockholm" | "goteborg" | null;
  lookupSource: AddonLookupSource;
  matchedTaxPoint: string | null;
  matchedCity: string | null;
};

export type AddonWarning = {
  code: string;
  message: string;
};

export type AddonLocationLookup = {
  matchSource: AddonLookupSource;
  matchedRows: number;
  matchedTaxPoint: string | null;
  matchedCity: string | null;
  localityClass: number | null;
  stor: "s" | "g" | null;
  hasBalanceAddon: boolean;

  ambiguous: {
    locality: boolean;
    metropolitan: boolean;
    balance: boolean;
  };
};

export type AddonCalculationResult = {
  chargeableWeight: number;
  addonTotal: number;
  addons: CalculatedAddon[];

  lookup: {
    sender: AddonLocationLookup;
    receiver: AddonLocationLookup;
  };

  warnings: AddonWarning[];
};

export type NavResult = {
  avg_term_ers: number,
  ank_term_ers: number,
  fjarr_ers: number
}

export type ProfitabilityInput = {
  kundnamn: string;
  taxPointRelation: string;
  chargeable_weight: number;

  // Taxepunkt används först för tillägg.
  // Postort används som fallback om taxepunkten saknas eller inte hittas i addons_postal.
  senderTaxPoint?: string | null;
  receiverTaxPoint?: string | null;
  pickupCity?: string | null;
  destinationCity?: string | null;

  // Behålls för annan logik, men används inte längre som primär nyckel i addons_postal.
  pickupPostalCode?: string | null;
  destinationPostalCode?: string | null;
};

export type ProfitabilityResult = {

  // Trappstegsmodellen steg använt
  step_used: number;

  // Totalt pris inklusive tillägg.
  estimated_revenue: number;

  // Håller felmeddelande för trappstegsmodellen
  detail?: string;

  /////////////////// Tilläggsberäkning
  base_revenue?: number; // Pris innan tillägg. Kundnetto
  addon_total?: number;
  addons?: CalculatedAddon[];
  addon_warnings?: AddonWarning[];

  /////////////////// NAV beräkning
  nav_error?: string;
  nav_ers_exklusive_tillägg?: NavResult;

};
