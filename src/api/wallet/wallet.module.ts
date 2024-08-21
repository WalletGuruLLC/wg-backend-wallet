import { Module } from '@nestjs/common';
import { WalletController } from './controller/wallet.controller';
import { WalletService } from './service/wallet.service';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [ConfigModule],
	controllers: [WalletController],
	providers: [WalletService],
})
export class WalletModule {}
