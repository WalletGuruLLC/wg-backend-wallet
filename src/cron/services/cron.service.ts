import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WalletService } from 'src/api/wallet/service/wallet.service';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class CronService {
	constructor(private readonly walletService: WalletService) {}
	@Cron('1 0 1 * *')
	async handleClearPayments() {
		try {
			await this.walletService.generateClearPayments();
		} catch (error) {
			Sentry.captureException(error);
		}
	}
}
