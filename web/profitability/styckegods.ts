import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { CalculatedAddon } from "./types";

type StyckegodsLookupResult = {
  price: number;
  basePrice: number;
  addonAmount: number;
  distanceKm: number | null;
  addons: CalculatedAddon[];
  method: string;
};

const STYCKEGODS_ADDON_PERCENTAGE = 8.5;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function resolveDistanceKm(
  supabaseServer: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  sender: number,
  receiver: number,
): Promise<number | null> {
  const queryDistance = async (
    from: number,
    to: number,
  ): Promise<number | null> => {
    const { data, error } = await (supabaseServer as any)
      .from("distance_map" as any)
      .select("distance")
      .eq("sender", from)
      .eq("receiver", to)
      .maybeSingle();

    if (error) {
      return null;
    }

    const distanceKm = Number(data?.distance);

    return Number.isFinite(distanceKm) && distanceKm > 0
      ? distanceKm
      : null;
  };

  const directDistance = await queryDistance(sender, receiver);

  if (directDistance !== null) {
    return directDistance;
  }

  return await queryDistance(receiver, sender);
}

export async function try_styckegods_lookup(
  consignment: ConsignmentListItem
): Promise<StyckegodsLookupResult | null> {
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

  const pickupZip = pickupZipClean
    ? parseInt(pickupZipClean, 10)
    : NaN;

  const destinationZip = destZipClean
    ? parseInt(destZipClean, 10)
    : NaN;

  const distanceKm = Number.isFinite(pickupZip) && Number.isFinite(destinationZip)
    ? await resolveDistanceKm(supabaseServer, pickupZip, destinationZip)
    : null;

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
  if (tonPrice === null && distanceKm !== null) {
    const { data: avstandData, error: avstandError } = await (supabaseServer as any)
      .from("styckegods_avstand" as any).select("pris_per_ton").gte("km", distanceKm).order("km", { ascending: true }).limit(1).maybeSingle();

    if (!avstandError && avstandData) {
      tonPrice = Number(avstandData.pris_per_ton);
      calculationMethod = `Styckegods: Avstånd (${distanceKm}km)`;
    }
  }

  if (tonPrice === null) {
    return null;
  }

  const basePrice = roundMoney(tonPrice * weightInTon);
  const addonAmount = roundMoney(basePrice * (STYCKEGODS_ADDON_PERCENTAGE / 100));
  const finalPrice = roundMoney(basePrice + addonAmount);
  const addons: CalculatedAddon[] = addonAmount > 0
    ? [
        {
          id: -40_000,
          type: "styckegodstillagg",
          direction: "route",
          name: `Styckegodstillägg ${STYCKEGODS_ADDON_PERCENTAGE.toString().replace(".", ",")} %`,
          amount: addonAmount,
          class: null,
          region: null,
          lookupSource: "none",
          matchedTaxPoint: null,
          matchedCity: null,
        },
      ]
    : [];

  return {
    price: finalPrice,
    basePrice,
    addonAmount,
    distanceKm,
    addons,
    method: calculationMethod,
  };
}
