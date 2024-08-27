import { Module } from '@nestjs/common';
import { WalletModule } from './api/wallet/wallet.module';
import { ConfigModule } from '@nestjs/config';
import {SentryModule} from "@sentry/nestjs/setup";

@Module({
	imports: [SentryModule.forRoot(),ConfigModule.forRoot(), WalletModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
