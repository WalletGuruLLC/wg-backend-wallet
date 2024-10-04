interface Amount {
	value: string;
	assetCode: string;
	assetScale: number;
}

interface WebHookData {
	id: string;
	walletAddressId: string;
	state: string;
	receiver: string;
	debitAmount: Amount;
	receiveAmount: Amount;
	sentAmount: Amount;
	stateAttempts: number;
	createdAt: string;
	updatedAt: string;
	balance: string;
	incomingAmount?: Amount;
	completed?: boolean;
}

export class EventWebHookDTO {
	id: string;
	type: string;
	data: WebHookData;
}
