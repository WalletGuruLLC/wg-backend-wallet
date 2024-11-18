import { Document } from 'dynamoose/dist/Document';

export interface Metadata {
	type: string;
	wgUser: string;
	description: string;
	activityId?: string;
	contentName?: string;
}

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
	Metadata?: Metadata;
	Receiver: string;
	IncomingAmount?: Amount;
	ReceiveAmount?: Amount;
	CreatedAt: Date;
	Description: string;
	SenderUrl: string;
	ReceiverUrl: string;
	Pay?: boolean;
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
