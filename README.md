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

- `AWS_KEY_ID`: Key ID of the AWS account
- `AWS_SECRET_ACCESS_KEY`: Secret key of the AWS account
- `AWS_REGION`: Region of the AWS account
- `SECRET_NAME`: Name of the secret in AWS Secrets Manager
