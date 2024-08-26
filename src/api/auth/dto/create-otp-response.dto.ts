export class CreateOtpResponseDto {
	success: boolean;
	message: string;
	otp?: string;
	token?: string;
	error?: string;
}
