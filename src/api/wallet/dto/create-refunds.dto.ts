import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateRefundsDto {
	@IsString()
	@IsNotEmpty()
	Id: string;

	@IsNumber()
	@IsNotEmpty()
	amount: number;

	@IsString()
	@IsNotEmpty()
	description: string;

	@IsString()
	@IsNotEmpty()
	activityId: string;

	@IsString()
	@IsNotEmpty()
	serviceProviderId: string;

	@IsString()
	@IsNotEmpty()
	walletAddress: string;
}
