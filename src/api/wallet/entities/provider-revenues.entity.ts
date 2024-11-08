import { Document } from 'dynamoose/dist/Document';

export class ProviderRevenues extends Document {
	Id = '';
	ServiceProviderId?: string;
	TransactionIds?: string[];
	Value?: number;
	StartDate?: number;
	EndDate?: number;
	CreateDate?: string;
	UpdateDate?: string;
}
