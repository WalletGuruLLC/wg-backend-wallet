import * as dynamoose from 'dynamoose';

export async function dynamoConnect() {
	dynamoose.aws.sdk.config.update({
		accessKeyId: process.env.AWS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.AWS_REGION,
	});
}
