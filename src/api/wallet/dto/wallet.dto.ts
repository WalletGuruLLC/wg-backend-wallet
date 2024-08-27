import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateWalletDto {
	name: string;
	walletType: string;
	walletAddress: string;
}

export class UpdateWalletDto {
	id?: string;
	name?: string;
	walletType?: string;
	walletAddress?: string;
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
}
