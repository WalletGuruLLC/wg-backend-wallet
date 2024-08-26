import { Document } from 'dynamoose/dist/Document';
export class Role extends Document {
	Id: string;
	Name: string;
	Description: string;
	ProviderId: string;
	Active: boolean;
	Modules: object;
	CreateDate: string;
	UpdateDate: string;
}
