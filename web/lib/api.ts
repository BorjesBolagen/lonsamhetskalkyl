import type {
	ConsignmentDetail,
	ConsignmentListItem,
	EquipageItem,
	LineItem,
} from "@/lib/ilogTypes";
import type { User, Message } from "@/lib/databaseTypes";
import type {
	BasicResponse,
	IlogResponse,
	MessageResponse,
	TokenResponse,
} from "@/lib/returnTypes";
import { Json } from "./supabaseServerSchema";

type HistoricalImportResponse = {
	columnsFound: number;
	rowsFound: number;
	insertedRows: number;
	filteredOutRows: number;
	replacedRows: number;
};

// ============================================================
// Auth
// ============================================================

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

export const loginProcedure = async (email: string, password: string, rememberMe: boolean): Promise<BasicResponse<null>> => {
	const response = await fetch(`/api/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		}, body: JSON.stringify({ email, password, rememberMe }),
	});

	if (!response.ok) throw new Error((await response.json()).message);

	return (await response.json()) as BasicResponse<null>;
}

// ============================================================
// Users
// ============================================================

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

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<User>;
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

export const forgotPassword = async (email: string): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/auth/forgot-password", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

// NOT DONE YET
export const setPassword = async (currentPassword: string, newPassword: string): Promise<BasicResponse<null>> => {
	const response = await fetch("/api/users/set/password", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ currentPassword, newPassword }),
	});

	if (!response.ok) throw new Error((await response.json()).message);
	return (await response.json()) as BasicResponse<null>;
}

/**
 * Deletes a user based on id. Only admins can do this.
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


// ============================================================
// iLog data
// ============================================================


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


// ============================================================
// Profitability simulation
// ============================================================
export type ProfitabilityValue = {
	step_used: number;
	estimated_revenue: number;
	detail?: string;
};

export type ProfitabilityResponse = {
	success: boolean;
	value?: ProfitabilityValue;
	error?: string;
	detail?: string;
};

export type NameMatchResponse = {
	best_name: string;
	best_score: number;
}

export const calculateProfitability = async (
    consignment: ConsignmentListItem,
	useEntireName: boolean
): Promise<ProfitabilityResponse> => {

    const params = new URLSearchParams({
        consignmentId: String(consignment.consignmentId || 0),
        customerName: consignment.customerName || "",
        destinationCity: consignment.destinationCity || "",
        senderName: consignment.senderName || "",
        pickupLocationName: consignment.pickupLocationName || "",
        receiverName: consignment.receiverName || "",
        destinationLocationName: consignment.destinationLocationName || "",
        weight: String(consignment.weight || 0),
        zoneName: consignment.zoneName || "",
        consignmentProperties: consignment.consignmentProperties || "",
        pickupLocationCity: consignment.pickupLocationCity || "",
        taxPointRelation: consignment.taxPointRelation || "",
		pickupPostalCode: consignment.pickupPostalCode || "",
    	destinationPostalCode: consignment.destinationPostalCode || "",
        useEntireName: String(useEntireName)
    });

    const url = `/api/profitability?${params.toString()}`;

    const response = await fetch(url, {
        method: "GET",
        cache: "no-store", 
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("API:t returnerade inte JSON.");
    }

    const data = await response.json();
    return data as ProfitabilityResponse;
};

export const getBestNameMatch = async (name: string): Promise<BasicResponse<NameMatchResponse>> => {
	
	const params = new URLSearchParams({ name });
	const response = await fetch(`/api/profitability/jaro-estimation?${params.toString()}`, {
		method: "GET",
	});

	if (!response.ok) {
		const error = await response.json() as { message?: string };
		throw new Error(error.message || "Request failed");
	}

	return (await response.json()) as BasicResponse<NameMatchResponse>;
}

// ============================================================
// Historical import
// ============================================================

/**
 * Hämtar signerad upload-URL och jobId för historisk import.
 */
export const createHistoricalImportSession = async (filename: string): Promise<{
	jobId: string;
	uploadUrl: string;
	storagePath: string;
}> => {
	const response = await fetch('/api/import-historical', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'create-upload-session', filename }),
	});

	if (!response.ok) {
		const error = await response.json() as { error?: string };
		throw new Error(error.error || 'Kunde inte skapa upload-session');
	}

	return (await response.json()) as { jobId: string; uploadUrl: string; storagePath: string };
};

/**
 * Laddar upp CSV-fil direkt till Supabase Storage via signerad URL.
 */
export const uploadHistoricalCsvToStorage = async (
	uploadUrl: string,
	file: File,
	onProgress?: (percent: number) => void,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable) {
				const percent = Math.round((event.loaded / event.total) * 100);
				onProgress?.(percent);
			}
		});

		xhr.addEventListener('load', () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else {
				reject(new Error(`Upload misslyckades: HTTP ${xhr.status}`));
			}
		});

		xhr.addEventListener('error', () => reject(new Error('Upload-fel')));
		xhr.addEventListener('abort', () => reject(new Error('Upload avbruten')));

		xhr.open('PUT', uploadUrl);
		// Content-Type måste matcha fil-typen
		xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
		xhr.send(file);
	});
};

/**
 * Startar historisk import från tidigare uppladdad CSV i Storage.
 */
export const runHistoricalImport = async (jobId: string): Promise<{
	jobId: string;
	status: string;
	result: HistoricalImportResponse;
}> => {
	const response = await fetch('/api/import-historical', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'start-import', jobId }),
	});

	if (!response.ok) {
		const error = await response.json() as { error?: string };
		throw new Error(error.error || 'Kunde inte starta import');
	}

	return (await response.json()) as {
		jobId: string;
		status: string;
		result: HistoricalImportResponse;
	};
};

export async function getIlogUnassignedConsignments(
  date: string,
  lineId: number,
  lineType: "ZONE" | "ZONEFILTER" | "ZONEGROUP",
) {
  const response = await fetch(
    `/api/ilog/unassigned-consignments?date=${encodeURIComponent(date)}&lineId=${lineId}&lineType=${encodeURIComponent(lineType)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return response.json();
}

// ============================================================
// Messaging system
// ============================================================

/**
 * Skickar ett meddelande. Bara admins kan skicka meddelanden. 
 * @param body sträng på meddelandets innehåll. Max 1000 tecken, annars nekas requesten
 * @returns Promise på BasicResponse<null>. Hur det gick att skicka meddelandet
 * @throws Error med felmeddelande från API:t om HTTP status inte är 2xx, t.ex. om body är för långt eller om användaren inte är admin.
 */
export const addMessage = async (body: string): Promise<BasicResponse<null>> => {

	const response = await fetch("/api/messages/add", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ body })
	});

	if (!response.ok) throw new Error((await response.json()).message);

	return (await response.json()) as BasicResponse<null>;
}

/**
 * Hämtar alla meddelanden inom angiven page sorterat efter datum skickat. Uppdaterar när inloggade användaren senast läste meddelanden
 * @param page sida att hämta. Börjar på 1 sedan 2 osv.
 * @param pageSize Hur många meddelanden som finns på en sida. Max 100 annars nekas requesten
 * @returns Promise på MessageResponse. De två viktigaste attributerna är:
 * 		- last_read_messages vilket är tiden användaren senast anropade getMessages. Borde kunna översättas till riktig tid med "new Date(last_read_message)"
 * 		- messages lista på alla meddelanden på denna page. Denna lista är pageSize lång
 * @throws Error med felmeddelande från API:t om HTTP status inte är 2xx, t.ex om pageSize är för stor
 */
export const getMessages = async (page: number, pageSize: number): Promise<MessageResponse> => {

	const params = new URLSearchParams({
		page: String(page),
		pageSize: String(pageSize),
	});

	const response = await fetch(`/api/messages/get/messages?${params.toString()}`, {
		method: "GET"
	});

	if (!response.ok) throw new Error((await response.json()).message);

	return (await response.json()) as MessageResponse;


}

/**
 * Hämtar hur många olästa meddelanden den inloggade användaren har.
 * @returns Promise på BasicResponse där data-fältet har antal olästa meddelanden
 * @throws Error med felmeddelande från API:t om HTTP status inte är 2xx
 */
export const getAmountOfUnreadMessages = async (): Promise<BasicResponse<number>> => {

	const response = await fetch("/api/messages/get/unreadMessages", {
		method: "GET"
	});

	if (!response.ok) throw new Error((await response.json()).message);

	return (await response.json()) as BasicResponse<number>;
}


/**
 * Tar bort ett meddelande baserat på messageId. Bara admins kan göra detta.
 * @param messageId ID för meddelandet som ska raderas
 * @returns Promise på BasicResponse<null>. Hur det gick att radera meddelandet
 * @throws Error med felmeddelande från API:t om HTTP status inte är 2xx, t.ex. om messageId inte finns eller om användaren inte är admin.
 */
export const deleteMessage = async (messageId: number): Promise<BasicResponse<null>> => {

	const paramMessageId = encodeURIComponent(String(messageId));
	const response = await fetch(`/api/messages/delete?messageId=${paramMessageId}`, {
		method: "DELETE",
	});

	if (!response.ok) throw new Error((await response.json()).message);

	return (await response.json()) as BasicResponse<null>;
}

/**
 * Hämtar hur många sidor som finns givet hur många meddelanden som finns på en sida (pageSize)
 * @param pageSize Antal meddelanden som visas på varje sida. Max 100 (lib/backend/utils:MAX_NUMBER_OF_MESSAGES_PER_PAGE), annars nekas requesten.
 * @return Promise på BasicResponse<number>. Antal sidor som finns givet pageSize. Returnernas i data-fältet
 * @throws Error med felmeddelande från API:t om HTTP status inte är 2xx, t.ex. om pageSize är större än 100.
 */
export const getAmountOfPages = async (pageSize: number): Promise<BasicResponse<number>> => {

	const paramPageSize = encodeURIComponent(String(pageSize));
	const response = await fetch(`/api/messages/get/amountOfPages?pageSize=${paramPageSize}`, {
		method: "GET",
	});

	if (!response.ok) throw new Error((await response.json()).message);

	return (await response.json()) as BasicResponse<number>;
}
