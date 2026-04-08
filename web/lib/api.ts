import type {
	ConsignmentDetail,
	ConsignmentListItem,
	EquipageItem,
	LineItem,
} from "@/lib/ilogTypes";
import type { User } from "@/lib/databaseTypes";

import type {
	MessageResponse,
	BasicResponse,
	IlogResponse,
	TokenResponse
} from "@/lib/returnTypes";
import { Json } from "./supabaseServerSchema";

export const sendMessage = async (message: string): Promise<MessageResponse> => {
	const sentAt = new Date().toLocaleTimeString("sv-SE", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	const response = await fetch("/api/message", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ message, sentAt }),
	});

	if (!response.ok) {
		throw new Error("Request failed");
	}

	return (await response.json()) as MessageResponse;
};

/**
 * Validerar om inloggningssession/token fortfarande är giltig.
 */
export const tokenCheck = async (): Promise<TokenResponse> => {
	const response = await fetch("/api/token");

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as TokenResponse;
};

/**
 * Sign up funktion för supabase
 */
export const signUpProcedure = async (email: string): Promise<BasicResponse<null>> => {
  const response = await fetch(`/api/signup?email=${encodeURIComponent(email)}`, {
    method: "GET",
  });

  if (!response.ok) throw new Error((await response.json()).message);

  return (await response.json()) as BasicResponse<null>;
};

/**
 * Getter för alla användare i User-tabellen i supabase. Policies gäller, se Supabase
 */
export const getAllUsers = async (): Promise<BasicResponse<User[]>> => {
	const response = await fetch("/api/users", {
		method: "GET",
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<User[]>;
};

/**
 * Getter för den nuvarande inloggande användaren.
 * VARNING: Odefinierat beteende om det inte är någon inloggad (alltså om ingen cookie med token finns)
 * pallar inte detta just nu klockan är 2am
 */
export const getCurrentlySignedInUser = async (): Promise<BasicResponse<User>> => {
	const response = await fetch("/api/users/get/currentUser", {
		method: "GET",
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<User>;
}

/**
 * User tabell:
 * getUser - tar id som input och returnerar all data om en användare i User (id, email, roll osv)
 * setThreshold - tar id och sätter threshold-värde i User
 * deleteUser - tar id och raderar användaren från User
 * setEmail - tar id och sätter nytt email-värde. Måste nog skicka extra verifieringsmejl (och också sätta email_verified = False)
 * setFilters - tar id och sätter filter-json. Förmodligen där ett element är område, annat är tema (ljus/mörk) osv.
 * setPassword - tar id, dubbelkoll att inloggad användare är samma som id, och sätter nytt lösenord. Kanske finns någon funktion i supabase.auth
 * 
 */

/**
 * Hämtar information om en användare baserat på id. Policies gäller, se supabase.
 * @param id 
 * @returns BasicResponse<User>
 */
export const getUser = async (id: string): Promise<BasicResponse<User>> => {
	const response = await fetch(`/api/users/get/user?userId=${encodeURIComponent(id)}`, {
		method: "GET",
	});
	console.log("getUser raw response:", response);
	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<User>;
}

/**
 * Sätter threshold fär angivet userId. Admin kan sätta threshold för alla användare, vanliga användare kan bara sätta för sig själva.
 * VARNING: Odefinierat beteende om det inte är någon inloggad (alltså om ingen cookie med token finns)
 * @param id - id för användaren som ska få sin threshold uppdaterad
 * @param threshold - det nya threshold-värdet
 * @returns BasicResponse<null>
 */
export const setThreshold = async (id: string, threshold: number): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/users/set/threshold", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId: id, threshold }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

// NOT DONE YET
export const setEmail = async (id: string, newEmail: string): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/users/set/email", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId: id, newEmail }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

/**
 * Sätter filter-json för angivet userId. Admin kan sätta filters för alla användare, vanliga användare kan bara sätta för sig själva.
 * VARNING: Odefinierat beteende om det inte är någon inloggad (alltså om ingen cookie med token finns)
 * @param id - id för användaren som ska få sina filters uppdaterade
 * @param filters - Json-objekt med filterdata. Upp till frontend att bestämma struktur. Kanske något i stil med { theme: "dark", area: "stockholm" } eller så.
 * @returns BasicResponse<null>
 */
export const setFilters = async (id: string, filters: Json): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/users/set/filters", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId: id, filters }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

// NOT DONE YET
export const setPassword = async (id: string, newPassword: string): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/users/set/password", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId: id, newPassword }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

/**
 * Deletes a uiser based on id. Only admins can do this.
 * VARNING: Odefinierat beteende om det inte är någon inloggad (alltså om ingen cookie med token finns)
 * @param id 
 * @returns 
 */
export const deleteUser = async (id: string): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/users/delete/user", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId: id }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

/**
 * Hämtar lista över ekipage (fordon/transport-enheter).
*/
export const getIlogEquipages = async (): Promise<IlogResponse<EquipageItem[]>> => {
	const response = await fetch("/api/ilog/equipages", { method: "GET" });

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as IlogResponse<EquipageItem[]>;
};

/**
 * Hämtar alla iLog-linjer for aktuell grupp.
 */
export const getIlogLines = async (): Promise<IlogResponse<LineItem[]>> => {
	const response = await fetch("/api/ilog/lines", { method: "GET" });

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as IlogResponse<LineItem[]>;
};

/**
 * Hämtar bokningar (consignments) för ett ekipage på ett givet datum.
 */
export const getIlogConsignments = async (
	date: string,
	equipageId: number
): Promise<IlogResponse<ConsignmentListItem[]>> => {
	const params = new URLSearchParams({
		date,
		equipageId: String(equipageId),
	});

	const response = await fetch(`/api/ilog/consignments?${params.toString()}`, {
		method: "GET",
	});

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as IlogResponse<ConsignmentListItem[]>;
};

/**
 * Hämtar full detalj för en enskild bokning/konsignment.
 */
export const getIlogConsignment = async (
	consignmentId: number
): Promise<IlogResponse<ConsignmentDetail>> => {
	const response = await fetch(
		`/api/ilog/consignment?consignmentId=${encodeURIComponent(String(consignmentId))}`,
		{
			method: "GET",
		}
	);

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as IlogResponse<ConsignmentDetail>;
};


export type SimulationProfitabilityValue = {
	step_used: number;
	taxeprel: string;
	vklfgrv: number;
	estimated_revenue: number;
	explanation: string;
};

export type SimulationProfitabilityResponse = {
	success: boolean;
	value?: SimulationProfitabilityValue;
	error?: string;
	detail?: string | Array<{ msg?: string; [key: string]: unknown }>;
};

/**
 * Kör simulatorns lönsamhetsberäkning via backend-route.
 */
export const calculateSimulationProfitability = async (
	kundnamn: string,
	start: string,
	slut: string,
	chargeableWeight: number
): Promise<SimulationProfitabilityResponse> => {
	const response = await fetch("/api/profitability_simulation", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kundnamn,
			start,
			slut,
			chargeable_weight: chargeableWeight,
		}),
	});

	const contentType = response.headers.get("content-type") || "";

	if (!contentType.includes("application/json")) {
		throw new Error("API:t returnerade inte JSON.");
	}

	return (await response.json()) as SimulationProfitabilityResponse;
};
