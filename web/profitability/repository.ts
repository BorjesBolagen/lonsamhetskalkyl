import "server-only";

import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabaseServer";
import type { MedelseRow, TrappstegRow } from "./types";

function reverseTaxeprel(taxeprel: string): string {
  const [sender, receiver] = taxeprel.split("-");
  if (!sender || !receiver) {
    return taxeprel;
  }
  return `${receiver}-${sender}`;
}

function normalizeTaxepunkt(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function splitTaxeprel(taxeprel: string): { sender: string; receiver: string } {
  const [senderRaw, receiverRaw] = taxeprel.split("-");

  const sender = normalizeTaxepunkt(senderRaw);
  const receiver = normalizeTaxepunkt(receiverRaw);

  if (!sender || !receiver) {
    throw new Error(`Ogiltig taxeprel: '${taxeprel}'`);
  }

  return { sender, receiver };
}

export async function fetchExactTrappstegRow(
  kundnamn: string,
  taxeprel: string,
  vklfgrv: number
): Promise<TrappstegRow | null> {
  const supabase = await getSupabaseAdminClient();

  const exactResponse = await supabase
    .from("calculation_trappsteg")
    .select("*")
    .ilike("kundnamn", kundnamn)
    .eq("taxeprel", taxeprel)
    .eq("vklfgrv", vklfgrv)
    .limit(1);

  if (exactResponse.error) {
    throw new Error(`Fel vid steg 1-lookup: ${exactResponse.error.message}`);
  }

  const exactRows = (exactResponse.data ?? []) as TrappstegRow[];
  if (exactRows.length > 0) {
    return exactRows[0];
  }

  const reversedTaxeprel = reverseTaxeprel(taxeprel);

  const reversedResponse = await supabase
    .from("calculation_trappsteg")
    .select("*")
    .ilike("kundnamn", kundnamn)
    .eq("taxeprel", reversedTaxeprel)
    .eq("vklfgrv", vklfgrv)
    .limit(1);

  if (reversedResponse.error) {
    throw new Error(
      `Fel vid steg 1 reverse-lookup: ${reversedResponse.error.message}`
    );
  }

  const reversedRows = (reversedResponse.data ?? []) as TrappstegRow[];
  return reversedRows.length > 0 ? reversedRows[0] : null;
}

export async function fetchCustomerVklRows(
  kundnamn: string,
  vklfgrv: number
): Promise<TrappstegRow[]> {
  const supabase = await getSupabaseAdminClient();

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
  const supabase = await getSupabaseAdminClient();

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
  const { sender, receiver } = splitTaxeprel(taxeprel);

  const response = await supabase
    .from("distance_map")
    .select("*")
    .or(
      `and(sender.eq.${sender},receiver.eq.${receiver}),and(sender.eq.${receiver},receiver.eq.${sender})`
    );

  if (response.error) {
    throw new Error(`Fel vid distance_map-lookup: ${response.error.message}`);
  }

  const rows = response.data ?? [];

  console.log("distance_map candidates", {
    taxeprel,
    sender,
    receiver,
    count: rows.length,
    rows,
  });

  const matchedRow = rows.find((row: any) => {
    const rowSender = normalizeTaxepunkt(row.sender);
    const rowReceiver = normalizeTaxepunkt(row.receiver);

    return (
      (rowSender === sender && rowReceiver === receiver) ||
      (rowSender === receiver && rowReceiver === sender)
    );
  }) as { distance?: number | string | null } | undefined;

  if (!matchedRow) {
    return null;
  }

  const km = Number(matchedRow.distance);
  return Number.isFinite(km) ? km : null;
}

export async function fetchMedelseRowsByVkl(
  vklfgrv: number
): Promise<MedelseRow[]> {
  const supabase = await getSupabaseAdminClient();

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