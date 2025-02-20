import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { ApolloClientService } from './graphql/apollo-client.service';
import { WalletModule } from './api/wallet/wallet.module';
import { SecretsModule } from './secrets.module';

@Module({
	imports: [
		SecretsModule,
		SentryModule.forRoot(),
		ConfigModule.forRoot(),
		WalletModule,
	],
	controllers: [],
	providers: [ApolloClientService],
})
export class AppModule {}
