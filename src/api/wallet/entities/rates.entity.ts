import { Document } from 'dynamoose/dist/Document';

export interface Rate {
	currency: unknown;
	rate: unknown;
}

export class Rates extends Document {
	Id: string = '';
	Base?: string;
	Rates?: Rate[];
	ExpTime?: string;
	CreateDate?: string;
	UpdateDate?: string;
}
