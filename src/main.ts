import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { dynamoConnect } from './config/dbconfig';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
	await dynamoConnect();
	const app = await NestFactory.create(AppModule);

	const config = new DocumentBuilder()
		.setTitle('Wallet Guru API Documentation')
		.setDescription(
			'Comprehensive documentation for the Wallet Guru API, detailing the wallet service and its endpoints'
		)
		.addServer('http://localhost:3000/', 'Local environment')
		.setVersion('1.0')
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document);

	app.enableCors({
		allowedHeaders: '*',
		origin: '*',
		credentials: true,
	});

	await app.listen(3000);
}
bootstrap();
