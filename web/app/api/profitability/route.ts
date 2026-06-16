import { NextRequest, NextResponse } from "next/server";
import { routeConsignment } from "@/profitability/service"; 
import { ConsignmentListItem } from "@/lib/ilogTypes";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const consignment = {
      consignmentId: Number(searchParams.get("consignmentId")) || 0,
      customerName: searchParams.get("customerName") || "",
      destinationCity: searchParams.get("destinationCity") || "",
      senderName: searchParams.get("senderName") || "",
      pickupLocationName: searchParams.get("pickupLocationName") || "",
      receiverName: searchParams.get("receiverName") || "",
      destinationLocationName: searchParams.get("destinationLocationName") || "",
      weight: Number(searchParams.get("weight")) || 0,
      zoneName: searchParams.get("zoneName") || "",
      consignmentProperties: searchParams.get("consignmentProperties") || "",
      pickupLocationCity: searchParams.get("pickupLocationCity") || "",
      taxPointRelation: searchParams.get("taxPointRelation") || "",
      pickupPostalCode: searchParams.get("pickupPostalCode") || "",
      destinationPostalCode: searchParams.get("destinationPostalCode") || "",
    } as ConsignmentListItem;

    const supabase = await getSupabaseServerClient();
    
    let isValidDest = true;
    let destTaxPoint = "";

    // 1. Kolla upp mottagaren
    const destZipClean = consignment.destinationPostalCode.replace(/[\s-]/g, "");
    const destCity = consignment.destinationCity.trim().toUpperCase();

    if (destZipClean) {
        const destZipNum = parseInt(destZipClean, 10);
        if (!isNaN(destZipNum)) {
            const { data } = await (supabase as any).from("tax_point_lookup")
                .select("taxepunktspostnummer").eq("postnummer", destZipNum).maybeSingle();
            
            if (data && data.taxepunktspostnummer) {
                destTaxPoint = data.taxepunktspostnummer.toString();
            }
        }
    } 
    
    // Om postnummer saknas eller misslyckades, sök på ortnamn
    if (!destTaxPoint && destCity) {
        const { data } = await (supabase as any).from("tax_point_lookup")
            .select("taxepunktspostnummer").ilike("postort", destCity).limit(1);
            
        if (data && data.length > 0 && data[0].taxepunktspostnummer) {
            destTaxPoint = data[0].taxepunktspostnummer.toString();
        }
    }

    if (!destTaxPoint) {
        isValidDest = false;
    }

    // 2. Bygg taxPointRelation om den saknas
    let finalTaxPointRelation = consignment.taxPointRelation;

    if (isValidDest && !finalTaxPointRelation) {
        const pickupZipClean = consignment.pickupPostalCode.replace(/[\s-]/g, "");
        const pickupCity = consignment.pickupLocationCity.trim().toUpperCase();
        let pickupTaxPoint = "";

        if (pickupZipClean) {
            const pickupZipNum = parseInt(pickupZipClean, 10);
            if (!isNaN(pickupZipNum)) {
                const { data } = await (supabase as any).from("tax_point_lookup")
                    .select("taxepunktspostnummer").eq("postnummer", pickupZipNum).maybeSingle();
                    
                if (data && data.taxepunktspostnummer) {
                    pickupTaxPoint = data.taxepunktspostnummer.toString();
                }
            }
        }
        
        if (!pickupTaxPoint && pickupCity) {
            const { data } = await (supabase as any).from("tax_point_lookup")
                .select("taxepunktspostnummer").ilike("postort", pickupCity).limit(1);
                
            if (data && data.length > 0 && data[0].taxepunktspostnummer) {
                pickupTaxPoint = data[0].taxepunktspostnummer.toString();
            }
        }

        if (pickupTaxPoint && destTaxPoint) {
            finalTaxPointRelation = `${pickupTaxPoint}-${destTaxPoint}`;
        }
    }

    // 3. SKicka vidare
    const enrichedConsignment = {
        ...consignment,
        taxPointRelation: finalTaxPointRelation,
        _isDbValidDestination: isValidDest 
    } as ConsignmentListItem & { _isDbValidDestination: boolean };


    const input = {
      kundnamn: enrichedConsignment.customerName,
      taxPointRelation: finalTaxPointRelation, 
      chargeable_weight: enrichedConsignment.weight ?? 0,
      use_entire_name: searchParams.get("useEntireName") === "true",
    };

    const result = await routeConsignment(enrichedConsignment, input);

    return NextResponse.json({ success: true, value: result });
    
  } catch (error) {
    console.error("profitability route error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Okänt fel vid lönsamhetsberäkning." },
      { status: 500 }
    );
  }
}