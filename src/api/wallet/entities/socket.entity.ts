import { Document } from 'dynamoose/dist/Document';

export class SocketKey extends Document {
	Id = '';
	PublicKey = '';
	SecretKey = '';
	ServiceProviderId = '';
}
