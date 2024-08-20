import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';

jest.mock('aws-sdk', () => {
	return {
		CognitoIdentityServiceProvider: jest.fn(() => ({
			adminInitiateAuth: jest.fn().mockReturnThis(),
		})),
	};
});

jest.mock('dynamoose', () => ({
	model: jest.fn().mockImplementation(() => ({
		create: jest.fn().mockReturnValue({ promise: jest.fn() }),
	})),
	Schema: jest.fn(),
}));

describe('WalletService', () => {
	let walletService: WalletService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [ConfigModule.forRoot()],
			providers: [WalletService],
		}).compile();

		walletService = module.get<WalletService>(WalletService);
	});

	// test('test service', async () => {
	// 	jest.spyOn(walletService, 'testService').mockResolvedValue('test');
	// });
});
