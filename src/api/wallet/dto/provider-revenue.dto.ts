import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProviderRevenue {
	@IsString()
	@IsNotEmpty()
	serviceProviderId: string;

	@IsString()
	@IsNotEmpty()
	startDate: string;

	@IsString()
	@IsNotEmpty()
	endDate: string;

	@IsArray()
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	transactionIds: string[];

	@IsString()
	@IsOptional()
	observations?: string;
}
