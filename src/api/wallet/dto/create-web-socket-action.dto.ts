import { IsNotEmpty, IsOptional, IsString, IsDate } from 'class-validator';

export class CreateWebSocketActionDto {
	@IsString()
	@IsNotEmpty()
	Id: string;

	@IsString()
	@IsOptional()
	PublicKey?: string;

	@IsString()
	@IsOptional()
	nonce?: string;

	@IsString()
	@IsOptional()
	sessionId?: string;

	@IsString()
	@IsOptional()
	activityId?: string;

	@IsString()
	@IsOptional()
	wgUserId?: string;

	@IsString()
	@IsOptional()
	contentName?: string;

	@IsString()
	@IsOptional()
	paymentType?: string;

	@IsString()
	@IsOptional()
	action?: string;

	@IsString()
	@IsOptional()
	eventType?: string;

	@IsDate()
	@IsOptional()
	timestamp?: Date;

	@IsString()
	@IsOptional()
	subscribeMessage?: string;

	@IsDate()
	@IsOptional()
	CreateDate?: Date;

	@IsDate()
	@IsOptional()
	UpdateDate?: Date;
}
