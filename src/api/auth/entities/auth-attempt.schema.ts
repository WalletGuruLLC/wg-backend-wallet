import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const AuthAttemptSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			default: () => uuidv4(),
		},
		Email: {
			type: String,
			required: true,
		},
		Section: {
			type: String,
			required: true,
		},
		Status: {
			type: String,
			enum: ['success', 'failure'],
			required: true,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);

export const AuthAttemptModel = dynamoose.model('Attempts', AuthAttemptSchema);
