import { Message } from "./databaseTypes";

// Responstyp för de flesta API-anrop i applikationen.
export type BasicResponse<T> = {
	status: boolean;
	message: string;
	data?: T;
}

// Generell svarstyp för nya iLog-interna endpoints. T är datatypen som returneras (EquipageItem[], ConsignmentListItem[], etc).
export type IlogResponse<T> = {
	status: boolean;
	message: string;
	data?: T;
};

export type TokenResponse = {
	success: boolean;
	message: string;
	token?: object
}

export type MessageResponse = {
	status: boolean;
	message: string;
	last_read_messages: string
	messages: Message[]
}