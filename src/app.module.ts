import { Module } from '@nestjs/common';
import { UserModule } from './api/wallet/wallet.module';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [ConfigModule.forRoot(), UserModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
