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

export type ProfitabilityInput = {
  kundnamn: string;
  taxPointRelation: string;
  chargeable_weight: number;
  use_entire_name: boolean;
};

export type ProfitabilityResult = {
  step_used: number;
  estimated_revenue: number;
  detail?: string;
};