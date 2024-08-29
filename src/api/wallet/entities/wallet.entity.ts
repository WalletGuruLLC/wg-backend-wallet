import { Document } from 'dynamoose/dist/Document';

export class Wallet extends Document {
	Id = '';
	Name = '';
	WalletType = '';
	WalletAddress = '';
	RafikiId = '';
	UserId = '';
	Active = true;
}
