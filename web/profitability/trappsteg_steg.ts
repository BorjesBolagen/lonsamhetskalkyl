import { ProfitabilityInput } from "./types";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { roundUpWeight } from "../lib/backend/utils";
import { normalizeText } from "./service";
import { ConsignmentListItem } from "@/lib/ilogTypes";


/**
 * Steg 1 för trappstegsmodellen. Försöker hitta exakt matching på kundnamn + taxeprel + vklfgrv.
 * Om en sådan rad hittas så returneras den beräknade intäkten enligt: kundnetto * vikt.
 * Om ingen rad hittas i steg 1 returneras null.
 * 
 * @param input ProfitabilityInput typ med variabler som kan behövas i detta steg
 * @returns Estimerat pris eller null
 * @throws Error om input är fel eller om databasen inte får träff
 */
export async function try_steg_1(input: ProfitabilityInput, weight_plus_one: number, use_entire_name: boolean): Promise<number | null> {

    // Hämta input variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);

    // Fråga supabase om (kundnamn, viktklass, avsändningstaxepunkt, mottagningstaxepunkt) finns.
    // Om det finns returneras alla dessa raders kundnettofrakt och vikt
    // Gör först med vanlig vikt
    const supabase = await getSupabaseServerClient();
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_1", {
        in_name: kundnamn,
        in_input_weight: weight,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep,
        in_use_entire_name: use_entire_name
    });

    if (error_orginal) {
        throw new Error("Fel vid steg 1: " + error_orginal.message);
    }

    // Gör sedan med vikt+1
    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_1", {
        in_name: kundnamn,
        in_input_weight: weight_plus_one,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep,
        in_use_entire_name: use_entire_name
    })

    if (error_plus_ett) {
        throw new Error("Fel vid steg 1: " + error_plus_ett.message);
    }

    const hittatOrginalData = Array.isArray(data_orginal) && data_orginal.length > 0;
    const hittatPlusEttData = Array.isArray(data_plus_ett) && data_plus_ett.length > 0;

    if (!hittatOrginalData && !hittatPlusEttData) {
        return null;
    }

    // Funktion som tar ett av de två resultaten och räknar ut estimerad intäkt genom kilopris * vikt för input-frakt
    const estimeraPris = (rows: Array<{ kundnettofrakt: number; vikt: number }>) => {
        const totalKundnettofrakt = rows.reduce((sum, row) => sum + row.kundnettofrakt, 0);
        const totalVikt = rows.reduce((sum, row) => sum + row.vikt, 0);
        return totalKundnettofrakt / totalVikt * weight;
    };

    // Lista med estimerade priser
    const estimates: number[] = [];

    // Om vi hittade för orginalparametrar, beräkna estimerat pris
    if (hittatOrginalData) {
        const estOrginal = estimeraPris(data_orginal);
        estimates.push(estOrginal);
    }

    // Om vi hittade för vikt+1, beräkna estimerat pris
    if (hittatPlusEttData) {
        const estPlusEtt = estimeraPris(data_plus_ett);
        estimates.push(estPlusEtt);
    }


    // Returnera det lägsta av de estimerade priserna
    return Math.min(...estimates);
}

/**
 * Steg 2 för trappstegsmodellen. Försöker hitta exakt matching på kundnamn + avstånd (km) + vklfgrv.
 * Om en sådan rad hittas så returneras ett estimerat pris enligt: medel_se_faktor * snitt_kund_vkl_forh_se * vikt.
 * Om vi inte får användbar träff i steg 2 returneras null.
 *
 * @param input ProfitabilityInput typ med variabler som behövs i steg 2.
 * @returns Estimerat pris eller null.
 * @throws Error om input är fel eller om databasanropet misslyckas.
 */
export async function try_steg_2(input: ProfitabilityInput, weight_plus_one: number, use_entire_name: boolean): Promise<number | null> {

    // Hämta input variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);

    const supabase = await getSupabaseServerClient();

    // Kolla om supabase har match på kundnamn, km och viktklass
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_2", {
        in_name: kundnamn,
        in_input_weight: weight,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep,
        in_use_entire_name: use_entire_name
    });

    if (error_orginal) {
        throw new Error("Fel vid steg 2: " + JSON.stringify(error_orginal, null, 2));
    }

    // Kolla om supabase har match på kundnamn, km och viktklass för vikt+1
    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_2", {
        in_name: kundnamn,
        in_input_weight: weight_plus_one,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep,
        in_use_entire_name: use_entire_name
    });

    if (error_plus_ett) {
        throw new Error("Fel vid steg 2: " + JSON.stringify(error_plus_ett, null, 2));
    }


    // --------- Se om vi fick träff och beräkna estimerat pris om vi fick träff
    // Beräkna först estimerat pris för orginalvikt
    const calculatePris = (d: { medel_se_faktor: number | null, snitt_kund_vkl_forh_se: number | null } | null): number | null => {
        if (!d || d.medel_se_faktor === null || d.snitt_kund_vkl_forh_se === null) return null;

        // Beräkna pris som medel_se_faktor * snitt_kund_vkl_forh_se * vikt
        return d.medel_se_faktor * d.snitt_kund_vkl_forh_se * weight;
    };

    const estimeratPris_orginal = calculatePris(data_orginal);
    const estimeratPris_plus_ett = calculatePris(data_plus_ett);

    if (estimeratPris_orginal !== null && estimeratPris_plus_ett !== null) {
        return Math.min(estimeratPris_orginal, estimeratPris_plus_ett);
    }
    return estimeratPris_orginal ?? estimeratPris_plus_ett ?? null;
}

/**
 * Steg 3 för trappstegsmodellen. Försöker hitta matchning på kundnamn och använder genomsnittliga faktorer för att estimera intäkten.
 * Om träff finns returneras ett estimerat pris enligt: medel_se_faktor * medel_forh_se_kundvis * vikt.
 * Om vi inte får användbar träff i steg 3 returneras null.
 *
 * @param input ProfitabilityInput typ med variabler som behövs i steg 3.
 * @returns Estimerat pris eller null.
 * @throws Error om input är fel eller om databasanropet misslyckas.
 */
export async function try_steg_3(input: ProfitabilityInput, weight_plus_one: number, use_entire_name: boolean): Promise<number | null> {
    
    // Hämta variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);

    // Kolla om supabase har match på bara kundnamn
    const supabase = await getSupabaseServerClient();
    const [{ data: data_orginal, error: error_orginal }, { data: data_plus_ett, error: error_plus_ett }] = 
        await Promise.all([
            supabase.rpc("steg_3", { in_kundnamn: kundnamn, in_weight: weight, in_taxep_sender: sender_taxep, in_taxep_receiver: receiver_taxep, in_use_entire_name: use_entire_name }),
            supabase.rpc("steg_3", { in_kundnamn: kundnamn, in_weight: weight_plus_one, in_taxep_sender: sender_taxep, in_taxep_receiver: receiver_taxep, in_use_entire_name: use_entire_name })
        ]);

    if (error_orginal) {
        throw new Error("Fel vid steg 3: " + JSON.stringify(error_orginal, null, 2));
    }

    if (error_plus_ett) {
        throw new Error("Fel vid steg 3: " + JSON.stringify(error_plus_ett, null, 2));
    }

    // -------- Se om vi fick träff och estimera pris om vi fick träff
    const calculatePris_3 = (d: { medel_se_faktor: number | null, medel_forh_se_kundvis: number | null } | null): number | null => {
        if (!d || d.medel_se_faktor === null || d.medel_forh_se_kundvis === null) return null;

        // Beräkna pris som medel_se_faktor * medel_forh_se_kundvis * vikt
        return d.medel_se_faktor * d.medel_forh_se_kundvis * weight;
    };

    const estimeratPris_orginal = calculatePris_3(data_orginal);
    const estimeratPris_plus_ett = calculatePris_3(data_plus_ett);

    if (estimeratPris_orginal !== null && estimeratPris_plus_ett !== null) {
        return Math.min(estimeratPris_orginal, estimeratPris_plus_ett);
    }

    return estimeratPris_orginal ?? estimeratPris_plus_ett ?? null;

}

/**
 * Steg 4 för trappstegsmodellen. Försöker hitta matchning på taxepunkter och viktklass, oberoende av kundnamn.
 * Om träff finns returneras ett estimerat pris enligt: (sum_kundnetto / sum_vikt) * vikt.
 * Om vi inte får användbar träff i steg 4 returneras null.
 *
 * @param input ProfitabilityInput typ med variabler som behövs i steg 4.
 * @returns Estimerat pris eller null.
 * @throws Error om input är fel eller om databasanropet misslyckas.
 */
export async function try_steg_4(input: ProfitabilityInput, weight_plus_one: number): Promise<number | null> {

    // Hämta variabler
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);

    // Kolla om supabase har match på bara taxepunkter och viktklass
    const supabase = await getSupabaseServerClient();
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_4", {
        in_sender_taxep: sender_taxep,
        in_receiver_taxep: receiver_taxep,
        in_weight: weight
    });

    if (error_orginal) {
        throw new Error("Fel vid steg 4: " + JSON.stringify(error_orginal, null, 2));
    }

    // Kolla om supabase har match på vikt+1
    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_4", {
        in_sender_taxep: sender_taxep,
        in_receiver_taxep: receiver_taxep,
        in_weight: weight_plus_one
    });

    if (error_plus_ett) {
        throw new Error("Fel vid steg 4: " + JSON.stringify(error_plus_ett, null, 2));
    }

    // -------- Se om vi fick träff och estimera pris om vi fick träff
    const calculatePris = (d: { sum_kundnetto: number, sum_vikt: number } | null, weight: number): number | null => {
        if (!d || d.sum_kundnetto === null || d.sum_vikt === null) return null;

        // Räkna ut pris som sum_kundnetto / sum_vikt * vikt
        return (d.sum_kundnetto / d.sum_vikt) * weight;
    };

    const estimeratPris_orginal = calculatePris(data_orginal?.[0], weight);
    const estimeratPris_plus_ett = calculatePris(data_plus_ett?.[0], weight);

    // Returnera minimum eller det som inte är null, eller null om båda är null
    if (estimeratPris_orginal !== null && estimeratPris_plus_ett !== null) {
        return Math.min(estimeratPris_orginal, estimeratPris_plus_ett);
    }
    return estimeratPris_orginal ?? estimeratPris_plus_ett ?? null;
}

export async function try_steg_5(input: ProfitabilityInput, weight_plus_one: number): Promise<number | null> {

    // Hämta variabler
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);

    const supabase = await getSupabaseServerClient();
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_5", {
        in_sender_taxep: sender_taxep,
        in_receiver_taxep: receiver_taxep,
        in_weight: weight
    })

    if (error_orginal) {
        throw new Error("Fel vid steg 5: " + JSON.stringify(error_orginal, null, 2));
    }

    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_5", {
        in_sender_taxep: sender_taxep,
        in_receiver_taxep: receiver_taxep,
        in_weight: weight_plus_one
    })

    if (error_plus_ett) {
        throw new Error("Fel vid steg 5: " + JSON.stringify(error_plus_ett, null, 2));
    }

    // -------- Se om vi fick träff och estimera pris om vi fick träff
    const calculatePris = (d: { medel_se: number, forh_linjevis: number } | null, weight: number): number | null => {
        if (!d || d.medel_se === null || d.forh_linjevis === null) return null;

        // Räkna ut pris som medel_se * forh_linjevis * vikt
        return d.medel_se * d.forh_linjevis * weight;
    };

    const estimeratPris_orginal = calculatePris(data_orginal?.[0], weight);
    const estimeratPris_plus_ett = calculatePris(data_plus_ett?.[0], weight);

    // Returnera minimum eller det som inte är null, eller null om båda är null
    if (estimeratPris_orginal !== null && estimeratPris_plus_ett !== null) {
        return Math.min(estimeratPris_orginal, estimeratPris_plus_ett);
    }
    return estimeratPris_orginal ?? estimeratPris_plus_ett ?? null;
}

/**
 * Slår upp pris i Sunes-prislistan baserat på ihopslagen sträng:
 * Avsändare + Avs-ort + Mottagare + Mott-ort
 */
export async function try_sune_lookup(consignment: ConsignmentListItem): Promise<number | null> {
    const supabase = await getSupabaseServerClient();
    
    const sender = (consignment.senderName || "").trim().toUpperCase();
    const pickupCity = (consignment.pickupLocationCity || "").trim().toUpperCase();
    const receiver = (consignment.receiverName || "").trim().toUpperCase();
    const destCity = (consignment.destinationCity || "").trim().toUpperCase();

    if (!pickupCity || !destCity) return null;

    // Skapa och sök med lookup
    const fuzzy4Part = `%${sender}%${pickupCity}%${receiver}%${destCity}%`;

    let { data, error } = await (supabase as any).from("sunes_pricing")
        .select("genomsnittspris")
        .ilike("lookup", fuzzy4Part) 
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Fel vid Sune-uppslag Försök 1:", error);
    }

    if (data && data.genomsnittspris) {
        return Number(data.genomsnittspris); // Träff på första försöket!
    }

    // Sök utan mottagare, saknas ibland i prislistan
    const fuzzy3Part = `%${sender}%${pickupCity}%${destCity}%`;

    const { data: dataFallback, error: errorFallback } = await (supabase as any).from("sunes_pricing")
        .select("genomsnittspris")
        .ilike("lookup", fuzzy3Part) 
        .limit(1)
        .maybeSingle();

    if (errorFallback) {
        console.error("Fel vid Sune-uppslag Försök 2:", errorFallback);
        return null;
    }

    if (dataFallback && dataFallback.genomsnittspris) {
        return Number(dataFallback.genomsnittspris);
    }

    // Ingen träff
    return null;
}