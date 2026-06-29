import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function try_styckegods_lookup(
  consignment: ConsignmentListItem
): Promise<{ price: number; method: string } | null> {
  if (!consignment.weight || consignment.weight <= 0) {
    return null;
  }

  const supabaseServer = await getSupabaseServerClient();
  const weightInTon = consignment.weight / 1000;
  let tonPrice: number | null = null;
  let calculationMethod = "";

  // Postnummer och förkortning (avsändare)
  let pickupZipClean = (consignment.pickupPostalCode || "").replace(/[\s-]/g, "");
  let fromAbbr = "";
  const pickupCityRaw = consignment.pickupLocationCity?.trim() || "";
  const pickupCityFirstWord = pickupCityRaw.split(" ")[0]; 

  // Sök på postnummer
  if (pickupZipClean) {
    const { data } = await (supabaseServer as any).from("tax_point_lookup" as any)
      .select("kontorsforkortning").eq("postnummer", parseInt(pickupZipClean, 10)).maybeSingle();
    if (data?.kontorsforkortning) fromAbbr = data.kontorsforkortning;
  }

  // Saknar vi postnummer eller förkortning söker vi staden
  if ((!pickupZipClean || !fromAbbr) && pickupCityRaw) {
    let { data } = await (supabaseServer as any).from("tax_point_lookup" as any)
      .select("postnummer, kontorsforkortning").ilike("postort", pickupCityRaw).limit(1).maybeSingle();
    
    if (!data && pickupCityFirstWord) {
      const res = await (supabaseServer as any).from("tax_point_lookup" as any)
        .select("postnummer, kontorsforkortning").ilike("postort", pickupCityFirstWord).limit(1).maybeSingle();
      data = res.data;
    }
    
    if (data?.kontorsforkortning && !fromAbbr) fromAbbr = data.kontorsforkortning;
    
    if (!pickupZipClean && data?.postnummer) {
      pickupZipClean = data.postnummer.toString();
    }
  }

  // Postnummer och förkortning (mottagare)
  let destZipClean = (consignment.destinationPostalCode || "").replace(/[\s-]/g, "");
  let toAbbr = "";
  const destCityRaw = consignment.destinationCity?.trim() || "";
  const destCityFirstWord = destCityRaw.split(" ")[0]; 

  if (destZipClean) {
    const { data } = await (supabaseServer as any).from("tax_point_lookup" as any)
      .select("kontorsforkortning").eq("postnummer", parseInt(destZipClean, 10)).maybeSingle();
    if (data?.kontorsforkortning) toAbbr = data.kontorsforkortning;
  }

  if ((!destZipClean || !toAbbr) && destCityRaw) {
    let { data } = await (supabaseServer as any).from("tax_point_lookup" as any)
      .select("postnummer, kontorsforkortning").ilike("postort", destCityRaw).limit(1).maybeSingle();
    
    if (!data && destCityFirstWord) {
      const res = await (supabaseServer as any).from("tax_point_lookup" as any)
        .select("postnummer, kontorsforkortning").ilike("postort", destCityFirstWord).limit(1).maybeSingle();
      data = res.data;
    }
    
    if (data?.kontorsforkortning && !toAbbr) toAbbr = data.kontorsforkortning;
    
    if (!destZipClean && data?.postnummer) {
      destZipClean = data.postnummer.toString();
    }
  }

  // Försök hitta linjepris
  if (fromAbbr && toAbbr) {
    const relation = `${fromAbbr}-${toAbbr}`.toUpperCase();
    const { data: linjeData, error: linjeError } = await (supabaseServer as any)
      .from("styckegods_linjer" as any).select("pris_per_ton").ilike("relation", relation).maybeSingle();

    if (!linjeError && linjeData) {
      tonPrice = Number(linjeData.pris_per_ton);
      calculationMethod = "Styckegods: Linjepris";
    }
  }

  // Annars kolla baserat på avstånd
  if (tonPrice === null && pickupZipClean && destZipClean) {
    const pZip = parseInt(pickupZipClean, 10);
    const dZip = parseInt(destZipClean, 10);

    const { data: distData, error: distError } = await (supabaseServer as any)
      .from("distance_map" as any).select("distance").eq("sender", pZip).eq("receiver", dZip).maybeSingle();

    if (!distError && distData && distData.distance) {
      const actualKm = Number(distData.distance);

      const { data: avstandData, error: avstandError } = await (supabaseServer as any)
        .from("styckegods_avstand" as any).select("pris_per_ton").gte("km", actualKm).order("km", { ascending: true }).limit(1).maybeSingle();

      if (!avstandError && avstandData) {
        tonPrice = Number(avstandData.pris_per_ton);
        calculationMethod = `Styckegods: Avstånd (${actualKm}km)`;
      }
    }
  }

  if (tonPrice === null) {
    return null;
  }

  const grundPris = tonPrice * weightInTon;
  const prisInklTillägg = grundPris * 1.085; // Tilläg
  const finalPrice = Math.round((prisInklTillägg + Number.EPSILON) * 100) / 100;
  
  return {
    price: finalPrice,
    method: calculationMethod
  };
}