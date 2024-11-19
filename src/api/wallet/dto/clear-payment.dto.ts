import {
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';

export class CreateClearPayment {
	@IsString()
	@IsNotEmpty()
	serviceProviderId: string;

	@IsNumber()
	@IsNotEmpty()
	startDate: number;

	@IsNumber()
	@IsNotEmpty()
	endDate: number;

	@IsArray()
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	transactionIds: string[];

	@IsString()
	@IsOptional()
	observations?: string;
}
