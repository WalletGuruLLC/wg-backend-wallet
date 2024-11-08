import { Document } from 'dynamoose/dist/Document';

export class WebSocketAction extends Document {
	Id?: string;
	PublicKey?: string;
	Nonce?: string;
	SessionId?: string;
	ActivityId?: string;
	WgUserId?: string;
	ItemName?: string;
	PaymentType?: string;
	Action?: string;
	EventType?: string;
	Timestamp?: Date;
	SubscribeMessage?: string;
	CreateDate?: Date;
	UpdateDate?: Date;
}
