import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const TransactionsSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
		},
		Type: {
			type: String,
		},
		OutgoingPaymentId: {
			type: String,
			index: {
				global: true,
				name: 'OutgoingPaymentIdIndex',
			},
		},
		IncomingPaymentId: {
			type: String,
			index: {
				global: true,
				name: 'IncomingPaymentIdIndex',
			},
		},
		WalletAddressId: {
			type: String,
			index: {
				global: true,
				name: 'WalletAddressIdIndex',
			},
		},
		State: {
			type: String,
		},
		Metadata: {
			type: Object,
			schema: {
				type: String,
				wgUser: String,
				description: String,
			},
		},
		Receiver: {
			type: String,
		},
		IncomingAmount: {
			type: Object,
			schema: {
				_Typename: String,
				value: String,
				assetCode: String,
				assetScale: Number,
			},
		},
		ReceiveAmount: {
			type: Object,
			schema: {
				_Typename: String,
				value: String,
				assetCode: String,
				assetScale: Number,
			},
		},
		CreatedAt: {
			type: Date,
			default: () => new Date(),
		},
		Description: {
			type: String,
		},
		SenderUrl: {
			type: String,
		},
		ReceiverUrl: {
			type: String,
		},
	},
	{
		timestamps: {
			createdAt: 'createdAt',
			updatedAt: 'updatedAt',
		},
	}
);
