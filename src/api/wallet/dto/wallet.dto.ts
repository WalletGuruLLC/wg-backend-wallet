export class CreateWalletDto {
	Name: string;
	WalletType: string;
	WalletAddress: string;
	Active: boolean;
}

export class UpdateWalletDto {
	Id?: string;
	name?: string;
	walletType?: string;
	walletAddress?: string;
	active?: string;
}
