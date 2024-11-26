import { Document } from 'dynamoose/dist/Document';

export class RefundsEntity extends Document {
	Id: string;
	Description?: string;
	Amount?: number;
	ActivityId?: string;
	ServiceProviderId?: string;
	CreateDate?: string;
	UpdateDate?: string;
}
