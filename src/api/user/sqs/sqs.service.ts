import { Injectable, Logger } from '@nestjs/common';
import { SQS } from 'aws-sdk';
import { LoginMessageDto } from './dto/login-message.dto';

@Injectable()
export class SqsService {
	private readonly sqs: SQS;
	private readonly logger = new Logger(SqsService.name);

	constructor() {
		this.sqs = new SQS({ region: process.env.AWS_REGION });
	}

	async sendMessage(
		queueUrl: string,
		messageBody: LoginMessageDto
	): Promise<void> {
		const params = {
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify(messageBody),
		};

		try {
			await this.sqs.sendMessage(params).promise();
			this.logger.log(`Message sent to SQS queue: ${queueUrl}`);
		} catch (error) {
			this.logger.error(
				`Failed to send message to SQS queue: ${queueUrl}`,
				error.stack
			);
			throw new Error('Failed to send message to SQS queue');
		}
	}
}
