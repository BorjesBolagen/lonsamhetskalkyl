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

type HistoricalImportResponse = {
	columnsFound: number;
	rowsFound: number;
	insertedRows: number;
};

type HistoricalImportErrorData = {
	errorCount?: number;
	errors?: string[];
};

type HistoricalImportProgress = {
	phase: "uploading" | "validating" | "inserting";
	loadedBytes: number;
	totalBytes: number;
	processedRows?: number;
	totalRows?: number;
	percentage: number;
};

export class HistoricalImportError extends Error {
	public readonly details: string[];

	constructor(message: string, details: string[] = []) {
		super(message);
		this.name = "HistoricalImportError";
		this.details = details;
	}
}



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
 * Hämtar alla iLog-zoner for aktuell grupp.
 */
export const getIlogZones = async (
	date: string,
	withEquipages: boolean = false
): Promise<IlogResponse<ConsignmentListItem[]>> => {
	const params = new URLSearchParams({
		date,
		withEquipages: String(withEquipages), // convert to "true"/"false"
	});

	const response = await fetch(`/api/ilog/zones?${params.toString()}`, {
		method: "GET",
	});

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as IlogResponse<ConsignmentListItem[]>;
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

/**
 * Laddar upp en historisk kusk-CSV och triggar backend-import.
 */
export const importHistoricalCSV = async (
	file: File,
	onUploadProgress?: (progress: HistoricalImportProgress) => void,
): Promise<BasicResponse<HistoricalImportResponse>> => {
	return await new Promise((resolve, reject) => {
		// Vi använder FormData för att skicka filen som multipart/form-data.
		const formData = new FormData();
		formData.append("file", file);

		// XHR används i stället för fetch eftersom vi behöver:
		// 1) verklig upload-progress
		// 2) möjlighet att läsa streamad textrespons stegvis
		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/api/historical");
		// Specialheader som säger till backend att skicka NDJSON-progress.
		xhr.setRequestHeader("x-import-progress", "1");
		xhr.responseType = "text";

		// Hjälpvariabler för att kunna parsa NDJSON inkrementellt.
		// "parsedLength" håller reda på hur mycket av responseText vi redan läst.
		let parsedLength = 0;
		let buffered = "";
		let streamResult: BasicResponse<HistoricalImportResponse> | null = null;
		let streamError: HistoricalImportError | null = null;

		const handleStreamLine = (line: string) => {
			if (!line) {
				return;
			}

			let parsed: unknown;
			try {
				parsed = JSON.parse(line);
			} catch {
				return;
			}

			if (typeof parsed !== "object" || parsed === null) {
				return;
			}

			const payload = parsed as {
				type?: string;
				phase?: string;
				percentage?: number;
				processedRows?: number;
				totalRows?: number;
				result?: BasicResponse<HistoricalImportResponse>;
				message?: string;
				data?: HistoricalImportErrorData;
			};

			if (payload.type === "progress") {
				// Backend skickar progress-event för validating/inserting.
				// I dessa faser betraktas filen redan som 100% uppladdad.
				const phase = payload.phase === "validating" ? "validating" : "inserting";
				onUploadProgress?.({
					phase,
					loadedBytes: file.size,
					totalBytes: file.size,
					percentage: Math.max(0, Math.min(100, Math.round(payload.percentage ?? 0))),
					processedRows:
						typeof payload.processedRows === "number" ? payload.processedRows : undefined,
					totalRows: typeof payload.totalRows === "number" ? payload.totalRows : undefined,
				});
				return;
			}

			if (payload.type === "result" && payload.result) {
				// Slutresultat från backend (status + statistik).
				streamResult = payload.result;
				return;
			}

			if (payload.type === "error") {
				// Streamat fel mappas till samma custom-error som övriga importfel.
				const details = Array.isArray(payload.data?.errors)
					? payload.data.errors.filter((entry): entry is string => typeof entry === "string")
					: [];
				streamError = new HistoricalImportError(
					payload.message || "Import misslyckades",
					details,
				);
			}
		};

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable || event.total <= 0) {
				return;
			}

			// Ren nätverksuppladdning: hur många bytes browsern skickat till servern.
			onUploadProgress?.({
				phase: "uploading",
				loadedBytes: event.loaded,
				totalBytes: event.total,
				percentage: Math.min(100, Math.round((event.loaded / event.total) * 100)),
			});
		};

		xhr.onprogress = () => {
			// Läs endast tillkommet textsegment sedan förra onprogress.
			const chunk = xhr.responseText.slice(parsedLength);
			parsedLength = xhr.responseText.length;
			if (!chunk) {
				return;
			}

			// NDJSON kan komma i ofullständiga bitar, därför buffer + rad-split.
			buffered += chunk;
			const lines = buffered.split("\n");
			buffered = lines.pop() ?? "";

			for (const line of lines) {
				handleStreamLine(line.trim());
			}
		};

		xhr.onerror = () => {
			reject(new Error("Request failed"));
		};

		xhr.onload = () => {
			// Om sista chunk saknar newline försöker vi ändå parsa den här.
			if (buffered.trim()) {
				handleStreamLine(buffered.trim());
			}

			if (streamError) {
				reject(streamError);
				return;
			}

			if (streamResult) {
				resolve(streamResult);
				return;
			}

			let result: BasicResponse<HistoricalImportResponse> & {
				data?: HistoricalImportErrorData;
			};

			try {
				// Fallback: om backend inte streamar event försöker vi läsa vanlig JSON-respons.
				result = JSON.parse(xhr.responseText || "{}") as BasicResponse<HistoricalImportResponse> & {
					data?: HistoricalImportErrorData;
				};
			} catch {
				reject(new Error("Import misslyckades: ogiltigt serversvar"));
				return;
			}

			if (xhr.status < 200 || xhr.status >= 300) {
				const details = Array.isArray(result.data?.errors)
					? result.data.errors.filter((entry): entry is string => typeof entry === "string")
					: [];

				reject(new HistoricalImportError(result.message || "Import misslyckades", details));
				return;
			}

			resolve(result);
		};

		xhr.send(formData);
	});
};