import { Document } from 'dynamoose/dist/Document';

export class UserIncomingPayment extends Document {
	Id: string;
	ServiceProviderId?: string;
	UserId?: string;
	IncomingPaymentId?: string;
	ReceiverId?: string;
	Status?: boolean;
	CreateDate?: string;
	UpdateDate?: string;
	SenderUrl: string;
	ReceiverUrl: string;
}
