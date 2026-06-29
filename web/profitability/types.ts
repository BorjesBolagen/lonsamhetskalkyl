export type TrappstegRow = {
  kundnamn: string;
  taxeprel: string;
  vklfgrv: number;
  kndntofgrv: number | null;
  forh_se_radvis: number | null;
  forh_se_kundvis: number | null;
  km: number | null;
};

export type MedelseRow = {
  km_bucket: number;
  vklfgrv: number;
  kndnto_medelse: number;
};

export type AddonDirection = "from" | "to";

export type AddonType =
  | "orttillagg"
  | "storstadstillagg"
  | "balanstillagg"
  | "tidtillagg";

export type AddonLookupSource =
  | "taxepunkt"
  | "postort"
  | "name_linjerel"
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

export type ProfitabilityInput = {
  kundnamn: string;
  taxPointRelation: string;
  chargeable_weight: number;
  useEntireName?: boolean;

  // Taxepunkt används först för tillägg.
  // Postort används som fallback om taxepunkten saknas eller inte hittas i addons_postal.
  senderTaxPoint?: string | null;
  receiverTaxPoint?: string | null;
  pickupCity?: string | null;
  destinationCity?: string | null;

  linjerel?: string | null;
  pickupPostalCode?: string | null;
  destinationPostalCode?: string | null;
};

export type ProfitabilityResult = {
  step_used: number;

  // Totalt pris inklusive tillägg.
  estimated_revenue: number;

  // Pris innan tillägg.
  base_revenue?: number;

  addon_total?: number;
  addons?: CalculatedAddon[];
  addon_warnings?: AddonWarning[];

  detail?: string;

  // Befintliga Jaro-fält behålls.
  jaro_matched_name?: string;
  jaro_score?: number;
  best_name?: string;
  best_score?: number;
};
