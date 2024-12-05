import { Document } from 'dynamoose/dist/Document';

export class ClearPayments extends Document {
	Id = '';
	ServiceProviderId?: string;
	TransactionIds?: string[];
	Value?: number;
	StartDate?: number;
	EndDate?: number;
	CreateDate?: string;
	UpdateDate?: string;
	Fees?: number;
	ReferenceNumber?: string;
	State?: boolean;
	Month?: number;
	Year?: number;
}
