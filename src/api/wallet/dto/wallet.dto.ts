import { IsBoolean, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateWalletDto {
	@IsNotEmpty()
	@IsString()
	name: string;

	@IsNotEmpty()
	@IsString()
	walletType: string;

	@IsNotEmpty()
	@IsString()
	walletAddress: string;
}

export class UpdateWalletDto {
	@IsNotEmpty()
	@IsString()
	id: string;

	@IsNotEmpty()
	@IsString()
	name: string;

	@IsNotEmpty()
	@IsString()
	walletType: string;

	@IsNotEmpty()
	@IsString()
	walletAddress: string;
}

export class GetWalletDto {
	@IsOptional()
	@IsString()
	id?: string;

	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsString()
	walletType?: string;

	@IsOptional()
	@IsString()
	walletAddress?: string;

	@IsOptional()
	@IsBoolean()
	active?: boolean;

	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@IsString()
	items?: number;

	@IsOptional()
	@IsString()
	page?: number;

	@IsOptional()
	@IsString()
	orderBy?: string;
}
