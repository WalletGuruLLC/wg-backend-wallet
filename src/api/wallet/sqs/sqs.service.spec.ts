import { Test, TestingModule } from '@nestjs/testing';
import { SqsService } from './sqs.service';
import { Logger } from '@nestjs/common';
import { LoginMessageDto } from './dto/login-message.dto';

const mSendMessage = jest.fn();

jest.mock('aws-sdk', () => {
	return {
		SQS: jest.fn(() => ({
			sendMessage: mSendMessage,
		})),
	};
});

describe('SqsService', () => {
	let sqsService: SqsService;
	let logger: Logger;

	const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue';
	const messageBody: LoginMessageDto = {
		event: 'login_attempt',
		email: 'user@example.com',
		username: 'user123',
		value: '123456',
	};
	const params = {
		QueueUrl: queueUrl,
		MessageBody: JSON.stringify(messageBody),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SqsService, Logger],
		}).compile();

		sqsService = module.get<SqsService>(SqsService);
		logger = module.get<Logger>(Logger);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should send a message to SQS successfully', async () => {
		mSendMessage.mockReturnValue({
			promise: jest.fn().mockResolvedValue({}),
		});

		await sqsService.sendMessage(queueUrl, messageBody);

		expect(mSendMessage).toHaveBeenCalledWith(params);
	});

	it('should throw an error when sending a message to SQS fails', async () => {
		const error = new Error('Failed to send message');
		mSendMessage.mockReturnValue({
			promise: jest.fn().mockRejectedValue(error),
		});

		await expect(sqsService.sendMessage(queueUrl, messageBody)).rejects.toThrow(
			'Failed to send message to SQS queue'
		);

		expect(mSendMessage).toHaveBeenCalledWith(params);
	});
});
