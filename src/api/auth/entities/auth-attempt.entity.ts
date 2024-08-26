import { Document } from 'dynamoose/dist/Document';

export class Attempt extends Document {
	Id = '';
	Email = '';
	Section = '';
	Status = 'failure';
}
