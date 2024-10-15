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
			required: true,
		},
		OutgoingPaymentId: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'OutgoingPaymentIdIndex',
			},
		},
		IncomingPaymentId: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'IncomingPaymentIdIndex',
			},
		},
		WalletAddressId: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'WalletAddressIdIndex',
			},
		},
		State: {
			type: String,
			required: true,
		},
		Metadata: {
			type: Object,
			default: null,
		},
		Receiver: {
			type: String,
			required: true,
		},
		IncomingAmount: {
			type: Object,
			required: true,
			schema: {
				_Typename: String,
				value: String,
				assetCode: String,
				assetScale: Number,
			},
		},
		ReceiveAmount: {
			type: Object,
			required: true,
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
			required: true,
		},
	},
	{
		timestamps: {
			createdAt: 'createdAt',
			updatedAt: 'updatedAt',
		},
	}
);
