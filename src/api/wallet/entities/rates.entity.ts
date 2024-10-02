import { Document } from 'dynamoose/dist/Document';

export interface Rate {
	currency: unknown;
	rate: unknown;
}

export class Rates extends Document {
	Id: string;
	Base?: string;
	Rates?: object;
	ExpirationTime?: string;
	CreateDate?: string;
	UpdateDate?: string;
}
