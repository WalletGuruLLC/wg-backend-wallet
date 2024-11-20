import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { WalletService } from 'src/api/wallet/service/wallet.service';
import * as Sentry from '@sentry/nestjs';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';

@Injectable()
export class CronService implements OnModuleInit {
	constructor(
		private readonly configService: ConfigService,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly walletService: WalletService
	) {}

	onModuleInit() {
		this.handleClearPayments();
	}

	handleClearPayments() {
		const cronExpression = this.configService.get<string>(
			'CRON_TIME_EXPRESSION'
		);

		const job = new CronJob(cronExpression, async () => {
			await this.walletService.generateClearPayments();
		});

		this.schedulerRegistry.addCronJob('clearPaymentsJob', job);

		job.start();
	}
}
