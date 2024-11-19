import { Document } from 'dynamoose/dist/Document';

export class ClearPayments extends Document {
	Id = '';
	ServiceProviderId?: string;
	TransactionIds?: string[];
	Value?: number;
	RevenueDate?: number;
	CreateDate?: string;
	UpdateDate?: string;
}
