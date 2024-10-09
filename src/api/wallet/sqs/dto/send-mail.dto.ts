export class sendMailDto {
	event: string;
	email: string;
	username: string;
	value: {
		value: string;
		asset: string;
		walletAddress: string;
		date: string;
	};
}
