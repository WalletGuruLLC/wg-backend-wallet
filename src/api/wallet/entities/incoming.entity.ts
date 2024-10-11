import { Document } from 'dynamoose/dist/Document';

export class UserIncomingPayment extends Document {
	Id: string;
	ServiceProviderId?: string;
	UserId?: string;
	IncomingPaymentId?: string;
	Status?: boolean;
	CreateDate?: string;
	UpdateDate?: string;
}
