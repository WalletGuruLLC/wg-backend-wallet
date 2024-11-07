import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const WebSocketActionSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
		},
		PublicKey: {
			type: String,
		},
		Nonce: {
			type: String,
		},
		SessionId: {
			type: String,
		},
		ActivityId: {
			type: String,
		},
		WgUserId: {
			type: String,
		},
		ItemName: {
			type: String,
		},
		PaymentType: {
			type: String,
		},
		Action: {
			type: String,
		},
		EventType: {
			type: String,
		},
		Timestamp: {
			type: Date,
			required: true,
			default: () => new Date(),
		},
		SubscribeMessage: {
			type: String,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
