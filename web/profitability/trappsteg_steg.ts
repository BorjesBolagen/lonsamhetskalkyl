import { ProfitabilityInput } from "./types";
import { normalizeText } from "./engine";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { roundUpWeight } from "./repository";

/**
 * Steg 1 för trappstegsmodellen. Försöker hitta exakt matching på kundnamn + taxeprel + vklfgrv.
 * Om en sådan rad hittas så returneras den beräknade intäkten enligt kundnetto * vikt.
 * Om ingen rad hittas returneras null
 * @param input ProfitabilityInput typ med variabler som kan behövas i detta steg
 * @returns Estimerat pris eller null
 * @throws Error om input är fel eller om databasen inte får träff
 */
export async function try_steg_1(input: ProfitabilityInput): Promise<number | null> {

    // Hämta input variabler
    const kundnamn = normalizeText(input.kundnamn);
    const [sender_taxep, receiver_taxep] = input.taxPointRelation?.trim().split("-").map(Number) || [];
    const weight = Number(input.chargeable_weight);
    const weight_plus_one = await roundUpWeight(weight);

    // Validera input
    if (!kundnamn) {
        throw new Error("Kundnamn måste fyllas i.");
    }
    if (!sender_taxep || !receiver_taxep) {
        throw new Error("Taxepunkter måste fyllas i.");
    }
    if (isNaN(weight)) {
        throw new Error("Levererad vikt måste vara ett giltigt tal.");
    }

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
        console.log("steg 1 data: ", JSON.stringify(data_orginal, null, 2));
        estimates.push(estOrginal);
    }

    // Om vi hittade för vikt+1, beräkna estimerat pris
    if (hittatPlusEttData) {
        const estPlusEtt = estimeraPris(data_plus_ett);
        console.log("steg 1 data +1: ", JSON.stringify(data_plus_ett, null, 2));
        estimates.push(estPlusEtt);
    }

    console.log("kund: ", kundnamn);
    console.log("estimerad intäkt steg 1: ", estimates);

    // Returnera det lägsta av de estimerade priserna
    return Math.min(...estimates);
}

//export function try_steg_2()