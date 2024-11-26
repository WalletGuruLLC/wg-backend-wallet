import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './services/cron.service';
import { WalletModule } from 'src/api/wallet/wallet.module';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [ScheduleModule.forRoot(), WalletModule, ConfigModule],
	providers: [CronService],
})
export class CronModule {}
