type MessageResponse = {
	received: string;
	sentAt?: string;
};

type BasicResponse = {
	success: boolean;
	message: string;
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
