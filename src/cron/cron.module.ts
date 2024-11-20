import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './services/cron.service';
import { WalletModule } from 'src/api/wallet/wallet.module';

@Module({
	imports: [ScheduleModule.forRoot(), WalletModule],
	providers: [CronService],
})
export class CronModule {}
