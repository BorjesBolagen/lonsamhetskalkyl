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

export type AddonDirection = "from" | "to" | "route";

export type AddonType =
  | "orttillagg"
  | "storstadstillagg"
  | "balanstillagg"
  | "tidtillagg"
  | "hvotillagg"
  | "dmttillagg"
  | "styckegodstillagg";

export type AddonLookupSource =
  | "taxepunkt"
  | "postort"
  | "name"
  | "name_linjerel"
  | "dmt_rule"
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
  distanceKm?: number | null;
};

export type ProfitabilityResult = {

  // Trappstegsmodellen steg använt
  step_used: number;

  // Summa intäkter som visas i prognosen. För trappstegsflödet är detta Direktlastat Fjärr-andelen från NAV + tillägg.
  estimated_revenue: number;

  // Håller felmeddelande för trappstegsmodellen
  detail?: string;

  /////////////////// Tilläggsberäkning
  base_revenue?: number; // Pris/intäktsbas innan tillägg. För trappstegsflödet är detta Direktlastat Fjärr-andelen efter NAV.
  customer_net_revenue?: number; // Kundnettot från trappstegsmodellen innan NAV-fördelning och tillägg.
  addon_total?: number;
  addons?: CalculatedAddon[];
  addon_warnings?: AddonWarning[];

  /////////////////// NAV beräkning
  nav_error?: string;
  nav_ers_exklusive_tillägg?: NavResult;

};
