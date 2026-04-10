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

export type SimulationProfitabilityInput = {
  kundnamn: string;
  start: string;
  slut: string;
  chargeable_weight: number;
};

export type SimulationProfitabilityResult = {
  step_used: number;
  taxeprel: string;
  vklfgrv: number;
  estimated_revenue: number;
  explanation: string;
};