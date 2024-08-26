import { Document } from 'dynamoose/dist/Document';

export class Otp extends Document {
	Email = '';
	Otp = '';
	Token = '';
	CreatedAt: Date = new Date();
}
