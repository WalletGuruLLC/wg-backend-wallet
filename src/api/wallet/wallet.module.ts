import { Module } from '@nestjs/common';
import { UserController } from './controller/wallet.controller';
import { WalletService } from './service/wallet.service';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [ConfigModule],
	controllers: [UserController],
	providers: [WalletService],
})
export class UserModule {}
