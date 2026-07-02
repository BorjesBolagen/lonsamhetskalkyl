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
  | "postnummer"
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

  // Bakåtkompatibelt namn. Värdet kan numera vara postnummer.
  matchedTaxPoint: string | null;

  // Nytt tydligare namn för addons_postal.postnummer.
  matchedPostalCode?: string | null;

  matchedCity: string | null;
};

export type AddonWarning = {
  code: string;
  message: string;
};

export type AddonLocationLookup = {
  matchSource: AddonLookupSource;
  matchedRows: number;

  // Bakåtkompatibelt namn. Värdet kan numera vara postnummer.
  matchedTaxPoint: string | null;

  // Nytt tydligare namn för addons_postal.postnummer.
  matchedPostalCode?: string | null;

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

  // Taxepunkter används fortfarande av trappstegsmodellen.
  senderTaxPoint?: string | null;
  receiverTaxPoint?: string | null;

  // Addon-logiken använder postnummer först.
  pickupPostalCode?: string | null;
  destinationPostalCode?: string | null;

  // Addon-logiken använder postort som fallback när postnummer saknas/inte matchar.
  pickupCity?: string | null;
  destinationCity?: string | null;

  // Används av TID-tillägg.
  linjerel?: string | null;
};

export type ProfitabilityResult = {
  step_used: number;

  // Totalt pris inklusive tillägg.
  estimated_revenue: number;

  // Pris innan tillägg.
  base_revenue?: number;

  addon_total?: number;
  addons?: CalculatedAddon[];
  addon_lookup?: AddonCalculationResult["lookup"];
  addon_warnings?: AddonWarning[];

  detail?: string;

  // Befintliga Jaro-fält behålls.
  jaro_matched_name?: string;
  jaro_score?: number;
  best_name?: string;
  best_score?: number;
};
