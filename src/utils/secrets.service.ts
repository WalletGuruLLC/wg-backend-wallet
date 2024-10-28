import { Injectable } from '@nestjs/common';
import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

@Injectable()
export class SecretsService {
	private client: SecretsManagerClient;

	constructor() {
		this.client = new SecretsManagerClient({ region: 'us-east-1' });
	}

	async getSecretValue(
		secretName = 'dev-notification'
	): Promise<Record<string, string> | undefined> {
		try {
			const command = new GetSecretValueCommand({ SecretId: secretName });
			const response = await this.client.send(command);

			if (response.SecretString) {
				return JSON.parse(response.SecretString);
			}

			if (response.SecretBinary) {
				return JSON.parse(Buffer.from(response.SecretBinary).toString('utf-8'));
			}

			return undefined;
		} catch (error) {
			console.error('Error fetching secret from Secrets Manager:', error);
			throw error;
		}
	}
}
