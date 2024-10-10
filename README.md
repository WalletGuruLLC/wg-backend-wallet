# Wallet Microservice

## Requirements

- Node.js (v14 or higher)
- NestJS (v7 or higher)
- AWS DynamoDB
- Dynamoose (v2 or higher)
- AWS SDK for Node.js

## Installation

    npm install

## Configuration

### Set up the environment variables

Create a .env file in the root of the project following the content of .env.example.


## Running the Application

    npm run start

## Envs for pipeline

- `NODE_ENV`: Environment of the application (development, qa, staging, production)
- `AWS_KEY_ID`: Key ID of the AWS account
- `AWS_SECRET_ACCESS_KEY`: Secret key of the AWS account
- `AWS_REGION`: Region of the AWS account
- `COGNITO_USER_POOL_ID`: ID of the Cognito User Pool
- `COGNITO_CLIENT_ID`: ID of the Cognito Client
- `AUTH_URL`: URL of the Auth microservice
- `RAFIKI_GRAPHQL_URL`: URL of the Rafiki GraphQL microservice
- `DOMAIN_WALLET_URL`: URL of the Wallet microservice
- `SENTRY_DSN`: DSN of the Sentry project
- `AWS_KEY`: Key of the AWS account for deploy image of docker in ECR
- `AWS_SECRET`: Secret of the AWS account for deploy image of docker in ECR
- `IMAGE`: Name of the image for deploy in ECR
- `CLUSTER_NAME`: Name of the cluster in ECS
- `AWS_ACCESS_KEY_ID_TERRAFORM`: Key ID of the AWS account for Terraform
- `AWS_SECRET_ACCESS_KEY_TERRAFORM`: Secret key of the AWS account for Terraform
- `BACKEND_API_SIGNATURE_VERSION`: Version of rafiki transaction
- `BACKEND_API_SIGNATURE_SECRET`: Secret of rafiki transactions
- `SQS_QUEUE_URL`: Url of AWS SQS Service

