interface Amount {
	value: string;
	assetCode: string;
	assetScale: number;
}

export class MetadataWebHookDTO {
	description: string;
	type: string;
	wgUser: string;
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
	metadata: MetadataWebHookDTO;
}

export class EventWebHookDTO {
	id: string;
	type: string;
	data: WebHookData;
}
