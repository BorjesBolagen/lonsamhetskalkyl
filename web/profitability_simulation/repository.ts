import "server-only";

import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabaseServer";
import type { MedelseRow, TrappstegRow } from "./types";

export async function fetchExactTrappstegRow(
  kundnamn: string,
  taxeprel: string,
  vklfgrv: number
): Promise<TrappstegRow | null> {
  const supabase = getSupabaseAdminClient();

  const response = await supabase
    .from("calculation_trappsteg")
    .select("*")
    .ilike("kundnamn", kundnamn)
    .eq("taxeprel", taxeprel)
    .eq("vklfgrv", vklfgrv)
    .limit(1);

  if (response.error) {
    throw new Error(`Fel vid steg 1-lookup: ${response.error.message}`);
  }

  const rows = (response.data ?? []) as TrappstegRow[];
  return rows.length > 0 ? rows[0] : null;
}

export async function fetchCustomerVklRows(
  kundnamn: string,
  vklfgrv: number
): Promise<TrappstegRow[]> {
  const supabase = getSupabaseAdminClient();

  const response = await supabase
    .from("calculation_trappsteg")
    .select("*")
    .ilike("kundnamn", kundnamn)
    .eq("vklfgrv", vklfgrv);

  if (response.error) {
    throw new Error(`Fel vid steg 2-lookup: ${response.error.message}`);
  }

  return (response.data ?? []) as TrappstegRow[];
}

export async function fetchCustomerRows(
  kundnamn: string
): Promise<TrappstegRow[]> {
  const supabase = getSupabaseAdminClient();

  const response = await supabase
    .from("calculation_trappsteg")
    .select("*")
    .ilike("kundnamn", kundnamn);

  if (response.error) {
    throw new Error(`Fel vid steg 3-lookup: ${response.error.message}`);
  }

  return (response.data ?? []) as TrappstegRow[];
}

export async function fetchKmByTaxeprel(
  taxeprel: string
): Promise<number | null> {
  const supabase = getSupabaseAdminClient();

  const response = await supabase
    .from("calculation_trappsteg")
    .select("km")
    .eq("taxeprel", taxeprel)
    .not("km", "is", null)
    .limit(1);

  if (response.error) {
    throw new Error(`Fel vid km-lookup: ${response.error.message}`);
  }

  const rows = response.data ?? [];
  if (rows.length === 0) {
    return null;
  }

  const km = rows[0]?.km;
  return km === null || km === undefined ? null : Number(km);
}

export async function fetchMedelseRowsByVkl(
  vklfgrv: number
): Promise<MedelseRow[]> {
  const supabase = getSupabaseAdminClient();

  const response = await supabase
    .from("calculation_medelse")
    .select("km_bucket, vklfgrv, kndnto_medelse")
    .eq("vklfgrv", vklfgrv)
    .order("km_bucket");

  if (response.error) {
    throw new Error(`Fel vid MedelSE-lookup: ${response.error.message}`);
  }

  return (response.data ?? []) as MedelseRow[];
}