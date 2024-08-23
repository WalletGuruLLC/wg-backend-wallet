import {Injectable} from '@nestjs/common';
import process from "node:process";
import {ConfigService} from "@nestjs/config";

@Injectable()
export class VerifyService {
    constructor(private readonly config: ConfigService) {
    }
    getVerifiedFactory() {
        const {
            verifierFactory,
        } = require('@southlane/cognito-jwt-verifier')
        // get a verifier instance. Put your config values here.
        return verifierFactory({
            region: this.config.get<string>('AWS_REGION'),
            userPoolId: this.config.get<string>('COGNITO_USER_POOL_ID'),
            appClientId: this.config.get<string>('COGNITO_CLIENT_ID'),
            tokenType: 'access', // either "access" or "id"
        })
    }
}
