type MessageResponse = {
	received: string;
	sentAt?: string;
};

type BasicResponse = {
	success: boolean;
	message: string;
}

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

export const tokenCheck = async (): Promise<TokenResponse> => {
	const response = await fetch("/api/token");

	if (!response.ok) {
		throw new Error("Request failed: " + (await response.text()));
	}

	return (await response.json()) as TokenResponse;
};