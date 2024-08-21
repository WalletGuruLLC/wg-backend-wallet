import { Document } from 'dynamoose/dist/Document';

export class Wallet extends Document {
	id = '';
	name = '';
	walletType = '';
	walletAddress = '';
	active = true;
}
