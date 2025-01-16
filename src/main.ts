import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { dynamoConnect } from './config/dbconfig';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import * as cookieParser from 'cookie-parser';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { SecretsService } from './utils/secrets.service';
import redocExpressMiddleware from 'redoc-express';

async function bootstrap() {
	const secretsService = new SecretsService();
	const secrets = await secretsService.getSecretValue(process.env.SECRET_NAME);
	if (secrets) {
		Object.entries(secrets).forEach(([key, value]) => {
			process.env[key] = value;
		});
	} else {
		throw new Error('Secrets in AWS Key Management service are undefined!');
	}

	if (process.env.SENTRY_DSN) {
		Sentry.init({
			dsn: process.env.SENTRY_DSN,
			integrations: [nodeProfilingIntegration()],
			tracesSampleRate: 1.0, //  Capture 100% of the transactions
			profilesSampleRate: 1.0,
			environment: process.env.NODE_ENV,
		});
	}
	await dynamoConnect();
	const app = await NestFactory.create(AppModule);

	const config = new DocumentBuilder()
		.setTitle('Wallet Guru API Documentation')
		.setDescription(
			'Comprehensive documentation for the Wallet Guru API, detailing the wallet service and its endpoints'
		)
		.addServer('http://localhost:3001/', 'Local environment')
		.addServer('https://dev.wallet.walletguru.co/', 'Dev environment')
		.addServer('https://qa.wallet.walletguru.co/', 'QA environment')
		.addServer('https://stg.wallet.walletguru.co/', 'Stg environment')
		.addServer('https://wallet.walletguru.co/', 'Production environment')
		.setVersion('1.0')
		.addBearerAuth(
			{ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
			'JWT'
		)
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document);

	app.use(cookieParser());
	app.enableCors({
		allowedHeaders: '*',
		origin: '*',
		credentials: true,
		methods: 'GET,POST,PUT,DELETE,PATCH',
	});
	const redocOptions = {
		title: 'Wallet Guru API Documentation',
		version: '1.0',
		specUrl: '/docs-json',
	};

	app.use('/redocs', redocExpressMiddleware(redocOptions));

	await app.listen(3000);
}

bootstrap();
