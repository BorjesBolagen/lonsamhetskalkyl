import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function try_paketbur_lookup(
  consignment: ConsignmentListItem
): Promise<number | null> {
  if (!consignment.paketburar || consignment.paketburar <= 0) {
    return null;
  }

  const supabaseServer = await getSupabaseServerClient();

  // Avsändare 
  let fromAbbr = "";
  const pickupZipClean = (consignment.pickupPostalCode || "").replace(/[\s-]/g, "");

  if (pickupZipClean) {
    const { data } = await (supabaseServer as any)
      .from("tax_point_lookup" as any)
      .select("kontorsforkortning")
      .eq("postnummer", parseInt(pickupZipClean, 10))
      .maybeSingle();
    if (data?.kontorsforkortning) fromAbbr = data.kontorsforkortning;
  }

  if (!fromAbbr && consignment.pickupLocationCity) {
    const { data } = await (supabaseServer as any)
      .from("tax_point_lookup" as any)
      .select("kontorsforkortning")
      .ilike("postort", consignment.pickupLocationCity.trim())
      .limit(1)
      .maybeSingle();
    if (data?.kontorsforkortning) fromAbbr = data.kontorsforkortning;
  }

  // Mottagare
  let toAbbr = "";
  const destZipClean = (consignment.destinationPostalCode || "").replace(/[\s-]/g, "");

  if (destZipClean) {
    const { data } = await (supabaseServer as any)
      .from("tax_point_lookup" as any)
      .select("kontorsforkortning")
      .eq("postnummer", parseInt(destZipClean, 10))
      .maybeSingle();
    if (data?.kontorsforkortning) toAbbr = data.kontorsforkortning;
  }

  if (!toAbbr && consignment.destinationCity) {
    const { data } = await (supabaseServer as any)
      .from("tax_point_lookup" as any)
      .select("kontorsforkortning")
      .ilike("postort", consignment.destinationCity.trim())
      .limit(1)
      .maybeSingle();
    if (data?.kontorsforkortning) toAbbr = data.kontorsforkortning;
  }

  if (!fromAbbr || !toAbbr) {
    return null;
  }

  const relation = `${fromAbbr}-${toAbbr}`.toUpperCase();

  // Slå upp i tabellen
  const { data: priceDataArray, error } = await (supabaseServer as any)
    .from("paketbur_prices" as any)
    .select("*")
    .ilike("relation", `%${relation.trim()}%`);

  if (error || !priceDataArray || priceDataArray.length === 0) {
    return null;
  }

  const actualBurar = Number(consignment.paketburar);
  const tierBurar = Math.ceil(actualBurar);
  const correctRow = priceDataArray.find(
    (row: any) => Number(row.antal_burar) === tierBurar
  );

  if (!correctRow) {
    return null;
  }

  const finalPrice = correctRow.pris * actualBurar;
  return Math.round((finalPrice + Number.EPSILON) * 100) / 100;
}