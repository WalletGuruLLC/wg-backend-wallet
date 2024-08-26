import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { CognitoService } from './cognito.service';

// Mock of CognitoIdentityServiceProvider
jest.mock('aws-sdk', () => {
	const mAdminCreateUser = jest.fn();
	const mAdminSetUserPassword = jest.fn();
	return {
		CognitoIdentityServiceProvider: jest.fn(() => ({
			adminCreateUser: mAdminCreateUser,
			adminSetUserPassword: mAdminSetUserPassword,
		})),
	};
});

describe('CognitoService', () => {
	let cognitoService: CognitoService;
	let cognitoISP: jest.Mocked<CognitoIdentityServiceProvider>;
	let mockPromise: jest.Mock;

	beforeEach(() => {
		process.env.COGNITO_USER_POOL_ID = 'us-east-2_EhbAxcCTT'; // Set the environment variable

		cognitoService = new CognitoService();
		cognitoISP =
			new CognitoIdentityServiceProvider() as jest.Mocked<CognitoIdentityServiceProvider>;

		mockPromise = jest.fn();
		cognitoISP.adminCreateUser.mockReturnValue({
			promise: mockPromise,
		} as any);
		cognitoISP.adminSetUserPassword.mockReturnValue({
			promise: mockPromise,
		} as any);
	});

	it('should create a user in Cognito', async () => {
		const expectedResponse = { User: { Username: 'testuser' } };
		mockPromise.mockResolvedValue(expectedResponse);

		const result = await cognitoService.createUser(
			'testuser',
			'password123',
			'test@example.com'
		);
		expect(result).toEqual(expectedResponse);
	});

	it('should handle errors when creating a user', async () => {
		const errorMessage = 'Error creating user';
		mockPromise.mockRejectedValue(new Error(errorMessage));

		await expect(
			cognitoService.createUser('testuser', 'password123', 'test@example.com')
		).rejects.toThrow(`Error creating user in Cognito: ${errorMessage}`);
	});
});
