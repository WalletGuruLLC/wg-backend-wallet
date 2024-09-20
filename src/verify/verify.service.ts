import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifierFactory } from '@southlane/cognito-jwt-verifier';

@Injectable()
export class VerifyService {
	constructor(private readonly config: ConfigService) {}
	getVerifiedFactory() {
		// get a verifier instance. Put your config values here.
		return verifierFactory({
			region: this.config.get<string>('AWS_REGION'),
			userPoolId: this.config.get<string>('COGNITO_USER_POOL_ID'),
			appClientId: this.config.get<string>('COGNITO_CLIENT_ID'),
			tokenType: 'access', // either "access" or "id"
		});
	}
}
