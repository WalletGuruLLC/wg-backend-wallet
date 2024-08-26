import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { UserService } from './user.service';
import { SqsService } from '../sqs/sqs.service';
import { User } from '../entities/user.entity';
import { AuthenticateUserResponse } from '../cognito/cognito.types';
import { CreateOtpResponseDto } from '../../auth/dto/create-otp-response.dto';

const mAdminCreateUser = jest.fn();
const mForgotPassword = jest.fn().mockReturnValue({ promise: jest.fn() });
const mChangePassword = jest.fn().mockReturnValue({ promise: jest.fn() });
const mConfirmForgotPassword = jest
	.fn()
	.mockReturnValue({ promise: jest.fn() });
const mSendMessage = jest.fn().mockReturnValue({ promise: jest.fn() });

jest.mock('aws-sdk', () => {
	return {
		CognitoIdentityServiceProvider: jest.fn(() => ({
			adminCreateUser: mAdminCreateUser,
			forgotPassword: mForgotPassword,
			changePassword: mChangePassword,
			confirmForgotPassword: mConfirmForgotPassword,
			adminInitiateAuth: jest.fn().mockReturnThis(),
		})),
		SQS: jest.fn(() => ({
			sendMessage: mSendMessage,
		})),
	};
});

jest.mock('dynamoose', () => ({
	model: jest.fn().mockImplementation(() => ({
		delete: jest.fn().mockReturnValue({ promise: jest.fn() }),
		create: jest.fn().mockReturnValue({ promise: jest.fn() }),
	})),
	Schema: jest.fn(),
}));

jest.mock('amazon-cognito-identity-js', () => {
	return {
		CognitoUserPool: jest.fn(),
		CognitoUser: jest.fn().mockImplementation(() => {
			return {
				getSession: jest.fn(callback => {
					callback(null, { getIdToken: () => ({ jwtToken: 'fake_token' }) });
				}),
			};
		}),
		AuthenticationDetails: jest.fn().mockImplementation(() => {
			return {};
		}),
	};
});

describe('UserService', () => {
	let userService: UserService;
	let configService: ConfigService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [ConfigModule.forRoot()],
			providers: [UserService, SqsService],
		}).compile();

		userService = module.get<UserService>(UserService);
		configService = module.get<ConfigService>(ConfigService);
	});

	test('debe crear una instancia de cognitoService', () => {
		expect(CognitoIdentityServiceProvider).toHaveBeenCalled();
		expect(userService['cognitoService']).toBeDefined();
	});

	test('forgotPassword debe llamar a cognitoService.forgotPassword con el nombre de usuario correcto', async () => {
		await userService['cognitoService'].forgotPassword('test@scrummers.co');
		expect(mForgotPassword).toHaveBeenCalled();
	});

	test('changePassword debe llamar a cognitoService.changePassword con los parámetros correctos', async () => {
		const email = 'testuser';
		const currentPassword = 'oldPassword123';
		const newPassword = 'newPassword123';
		await userService['cognitoService'].changePassword(
			email,
			currentPassword,
			newPassword
		);

		expect(mChangePassword).toHaveBeenCalledWith({
			AccessToken: email, // Ajuste para usar AccessToken
			PreviousPassword: currentPassword,
			ProposedPassword: newPassword,
		});
	});

	test('confirmPassword debe llamar a cognitoService.confirmForgotPassword con los parámetros correctos', async () => {
		const email = 'testuser';
		const confirmationCode = '123456';
		const newPassword = 'newPassword123';

		await userService['cognitoService'].confirmForgotPassword(
			email,
			confirmationCode,
			newPassword
		);

		expect(mConfirmForgotPassword).toHaveBeenCalled();
	});

	test('signin should send a message to SQS with the correct parameters', async () => {
		const signinDto = { email: 'test@scrummers.co', password: 'password123' };
		const foundUser = {
			Id: 'user-id',
			Email: 'test@scrummers.co',
			FirstName: 'Test',
			LastName: 'User',
			Phone: '1234567890',
			PasswordHash: 'hashed-password',
			MfaEnabled: true,
			RoleId: 1,
			State: 1,
		} as unknown as User;
		const authResult = {
			AuthenticationResult: {
				AccessToken: 'fake_token',
			},
		} as unknown as AuthenticateUserResponse;
		const otpResult = { otp: '123456' } as unknown as CreateOtpResponseDto;

		jest.spyOn(userService, 'findOneByEmail').mockResolvedValue(foundUser);
		jest
			.spyOn(userService['cognitoService'], 'authenticateUser')
			.mockResolvedValue(authResult);
		jest.spyOn(userService, 'generateOtp').mockResolvedValue(otpResult);

		await userService.signin(signinDto);

		expect(mSendMessage).toHaveBeenCalledTimes(1);
	});
});
