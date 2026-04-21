import { ProfitabilityInput } from "./types";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { roundUpWeight, normalizeText } from "../lib/backend/utils";

function valideraInput(input: ProfitabilityInput) {
    // Validera input
    if (!input.kundnamn) {
        throw new Error("Kundnamn måste fyllas i.");
    }
    if (!input.taxPointRelation) {
        throw new Error("Taxepunkter måste fyllas i.");
    }
    if (isNaN(input.chargeable_weight)) {
        throw new Error("Levererad vikt måste vara ett giltigt tal.");
    }
}

/**
 * Steg 1 för trappstegsmodellen. Försöker hitta exakt matching på kundnamn + taxeprel + vklfgrv.
 * Om en sådan rad hittas så returneras den beräknade intäkten enligt kundnetto * vikt.
 * Om ingen rad hittas returneras null
 * @param input ProfitabilityInput typ med variabler som kan behövas i detta steg
 * @returns Estimerat pris eller null
 * @throws Error om input är fel eller om databasen inte får träff
 */
export async function try_steg_1(input: ProfitabilityInput): Promise<number | null> {

    valideraInput(input);

    // Hämta input variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);
    const weight_plus_one = await roundUpWeight(weight);

    // Fråga supabase om (kundnamn, viktklass, avsändningstaxepunkt, mottagningstaxepunkt) finns.
    // Om det finns returneras alla dessa raders kundnettofrakt och vikt
    // Gör först med vanlig vikt
    const supabase = await getSupabaseServerClient();
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_1", {
        in_name: kundnamn,
        in_input_weight: weight,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep
    });

    if (error_orginal) {
        throw new Error("Fel vid steg 1: " + error_orginal.message);
    }

    // Gör sedan med vikt+1
    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_1", {
        in_name: kundnamn,
        in_input_weight: weight_plus_one,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep
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
 * Om en sådan rad hittas så returneras den beräknade intäkten enligt 
 * @param input 
 */
export async function try_steg_2(input: ProfitabilityInput): Promise<number | null> {

    valideraInput(input);

    // Hämta input variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);
    const weight_plus_one = await roundUpWeight(weight); 

    // Kolla om supabase har match på kundnamn, km och viktklass
    const supabase = await getSupabaseServerClient();
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_2", {
        in_name: kundnamn,
        in_input_weight: weight,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep
    });

    if (error_orginal) {
        throw new Error("Fel vid steg 2: " + JSON.stringify(error_orginal, null, 2));
    }

    // Kolla om supabase har match på kundnamn, km och viktklass för vikt+1
    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_2", {
        in_name: kundnamn,
        in_input_weight: weight_plus_one,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep
    });

    if (error_plus_ett) {
        throw new Error("Fel vid steg 2: " + JSON.stringify(error_plus_ett, null, 2));
    }


    // --------- Se om vi fick träff och beräkna estimerat pris om vi fick träff
    // Beräkna först estimerat pris för orginalvikt
    const { medel_se_faktor, snitt_kund_vkl_forh_se } = data_orginal;

    const results_orginal = [];
    if (medel_se_faktor !== null) { results_orginal.push(medel_se_faktor) }
    else { return null }
    if (snitt_kund_vkl_forh_se !== null) { results_orginal.push(snitt_kund_vkl_forh_se) }
    else { return null }

    // Beräkna estimerat pris som medel_se_faktor * snitt_kund_vkl_forh_se * vikt.
    const estimeratPris_orginal = results_orginal.reduce((acc, val) => acc * val, 1) * weight;

    // Beräkna sedan estimerat pris för vikt+1
    const { medel_se_faktor: medel_se_faktor_plus_ett, snitt_kund_vkl_forh_se: snitt_kund_vkl_forh_se_plus_ett } = data_plus_ett;

    const results_plus_ett = [];
    if (medel_se_faktor_plus_ett !== null) { results_plus_ett.push(medel_se_faktor_plus_ett) }
    else { return null }
    if (snitt_kund_vkl_forh_se_plus_ett !== null) { results_plus_ett.push(snitt_kund_vkl_forh_se_plus_ett) }
    else { return null }

    // Beräkna estimerat pris som medel_se_faktor * snitt_kund_vkl_forh_se * vikt.
    // Fråga - ska man ta multiplicerat med orginalvikt eller vikt+1 här?
    const estimeratPris_plus_ett = results_plus_ett.reduce((acc, val) => acc * val, 1) * weight;

    // Returnera det lägsta av de estimerade priserna
    return Math.min(estimeratPris_orginal, estimeratPris_plus_ett);
}

export async function try_steg_3(input: ProfitabilityInput): Promise<number | null> {
    
    valideraInput(input);

    // Hämta variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);
    const weight_plus_one = await roundUpWeight(weight);

    // Kolla om supabase har match på bara kundnamn
    const supabase = await getSupabaseServerClient();
    const { data: data_orginal, error: error_orginal } = await supabase.rpc("steg_3", {
        in_kundnamn: kundnamn,
        in_weight: weight,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep
    });

    if (error_orginal) {
        throw new Error("Fel vid steg 3: " + JSON.stringify(error_orginal, null, 2));
    }

    // Kolla om supabase har match på bara kundnamn för vikt+1
    const { data: data_plus_ett, error: error_plus_ett } = await supabase.rpc("steg_3", {
        in_kundnamn: kundnamn,
        in_weight: weight_plus_one,
        in_taxep_sender: sender_taxep,
        in_taxep_receiver: receiver_taxep
    });

    if (error_plus_ett) {
        throw new Error("Fel vid steg 3: " + JSON.stringify(error_plus_ett, null, 2));
    }

    // -------- Se om vi fick träff och estimera pris om vi fick träff
    // Beräkna först estimerat pris för orginalvikt
    const { medel_se_faktor, medel_forh_se_kundvis } = data_orginal;
    const results_orginal = [];
    if (medel_se_faktor !== null) { results_orginal.push(medel_se_faktor) }
    else { return null }
    if (medel_forh_se_kundvis !== null) { results_orginal.push(medel_forh_se_kundvis) }
    else { return null }

    // Beräkna estimerat pris som medel_se_faktor * medel_forh_se_kundvis * vikt
    const estimeratPris_orginal = results_orginal.reduce((acc, val) => acc * val, 1) * weight;

    // Beräkna sedan estimerat pris för vikt+1
    const { medel_se_faktor: medel_se_faktor_plus_ett, medel_forh_se_kundvis: medel_forh_se_kundvis_plus_ett } = data_plus_ett;
    const results_plus_ett = [];
    if (medel_se_faktor_plus_ett !== null) { results_plus_ett.push(medel_se_faktor_plus_ett) }
    else { return null }
    if (medel_forh_se_kundvis_plus_ett !== null) { results_plus_ett.push(medel_forh_se_kundvis_plus_ett) }
    else { return null }

    // Beräkna estimerat pris som medel_se_faktor * medel_forh_se_kundvis * vikt
    // Fråga - ska man ta multiplicerat med orginalvikt eller vikt+1 här?
    const estimeratPris_plus_ett = results_plus_ett.reduce((acc, val) => acc * val, 1) * weight;

    // Returnera det lägsta av de estimerade priserna
    return Math.min(estimeratPris_orginal, estimeratPris_plus_ett);

}