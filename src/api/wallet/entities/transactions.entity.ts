import { Document } from 'dynamoose/dist/Document';

export interface Amount {
	_Typename: string;
	value: string;
	assetCode: string;
	assetScale: number;
}

export class Transaction extends Document {
	Id: string;
	Type: string;
	OutgoingPaymentId?: string;
	IncomingPaymentId?: string;
	WalletAddressId: string;
	State: string;
	Metadata?: object | null;
	Receiver: string;
	IncomingAmount?: Amount;
	ReceiveAmount?: Amount;
	CreatedAt: Date;
	Description: string;
	SenderUrl: string;
	ReceiverUrl: string;
}

export interface BaseTransaction {
	type: string;
	walletAddressId: string;
	state: string;
	createdAt: Date;
}

export interface OutgoingTransaction extends BaseTransaction {
	outgoingPaymentId: string;
	metadata?: object | null;
	receiver: string;
	receiveAmount: Amount;
}

export interface IncomingTransaction extends BaseTransaction {
	incomingPaymentId: string;
	incomingAmount: Amount;
}

export type TransactionType = OutgoingTransaction | IncomingTransaction;
