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
	active?: boolean;
}

export class GetWalletDto {
	id?: string;
	name?: string;
	walletType?: string;
	walletAddress?: string;
	active?: boolean;
}
