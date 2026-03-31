import type {
	ConsignmentDetail,
	ConsignmentListItem,
	EquipageItem,
} from "@/lib/ilogTypes";

type MessageResponse = {
	received: string;
	sentAt?: string;
};

type BasicResponse = {
	status: boolean;
	message: string;
	data?: object;
}

// Generell svarstyp för nya iLog-interna endpoints. T är datatypen som returneras (EquipageItem[], ConsignmentListItem[], etc).
type IlogResponse<T> = {
	status: boolean;
	message: string;
	data?: T;
};

type TokenResponse = {
	success: boolean;
	message: string;
	token?: object
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
 * Kollar om en användare med given email finns i databasen.
 */
export const checkUserExists = async (email: string): Promise<BasicResponse> => {
  const response = await fetch(`/api/user?email=${encodeURIComponent(email)}`, {
    method: "GET",
  });

  if (!response.ok) throw new Error(await response.text());

  return (await response.json()) as BasicResponse;
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