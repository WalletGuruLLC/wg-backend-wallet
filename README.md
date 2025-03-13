# Wallet Microservice

This **Wallet Microservice** provides secure user authentication and authorization using **Node.js** and *
*NestJS**. It integrates **DynamoDB** as the NoSQL database with **Dynamoose** as the ORM.

## Dependencies

This microservice uses the following key dependencies:

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [DynamoDB](https://aws.amazon.com/dynamodb/) - NoSQL database
- [Dynamoose](https://dynamoosejs.com/) - ORM for DynamoDB
- [AWS SDK](https://aws.amazon.com/sdk-for-node-js/) - AWS integration
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Secure password hashing
- [Wg-infra](https://github.com/ErgonStreamGH/wg-infra) - Deploy services with Terraform
- [Rafiki](https://github.com/interledger/rafiki/tree/main/localenv) - Deploy services rafiki in local for connect with open payments
---

## Install

### 1. Clone the Repository

```sh
git clone https://github.com/ErgonStreamGH/wg-backend-wallet.git
cd wg-backend-wallet
```

### 2. Install Dependencies

```sh
npm install
```

### 3. Create envs in AWS Secrets Manager

Create a secret in AWS Secrets Manager with the name `walletguru-wallet-local` and the following key-value pairs:

```
{
  "AWS_REGION": "", # AWS Region for the application
  "AWS_ACCESS_KEY_ID": "", # AWS Access Key ID for access to DynamoDB and Cognito
  "AWS_SECRET_ACCESS_KEY": "", # AWS Secret Access Key for access to DynamoDB and Cognito
  "NODE_ENV": "", # Node Environment
  "COGNITO_USER_POOL_ID": "", # Cognito User Pool ID
  "COGNITO_CLIENT_ID": "", # Cognito Client ID
  "SENTRY_DSN": "", # Sentry DSN for error tracking
  "AUTH_URL": "", # Authentication URL for public access
  "RAFIKI_GRAPHQL_URL": "", # Rafiki GraphQL URL
  "DOMAIN_WALLET_URL": "", # Wallet URL for public access
  "BACKEND_API_SIGNATURE_VERSION": "1", # Backend API Signature Version
  "BACKEND_API_SIGNATURE_SECRET": "", # Backend API Signature
  "SQS_QUEUE_URL": "", # SQS Queue URL for sending email notifications
  "WALLET_WG_URL": "", # Wallet WG URL
  "CRON_TIME_EXPRESSION": "1 0 1 * *", # Cron Time
  "API_SECRET_SERVICES": "", # API Secret Services
  "WS_URL": "", # WS URL for public access
  "SIGNATURE_URL": "https://kxu5d4mr4blcthphxomjlc4xk40rvdsx.lambda-url.eu-central-1.on.aws/" # Signature URL for public access
}
```

| **Name Env**                  | **Description**                                                                                                                                               | **REQUIRED** |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|
| AWS_ACCESS_KEY_ID             | AWS Access Key for access to resources and service                                                                                                            | Yes          |
| AWS_SECRET_ACCESS_KEY         | AWS Secret Key for access to resources and service                                                                                                            | Yes          |
| AWS_REGION                    | AWS Region for access to resources and service                                                                                                                | Yes          |
| COGNITO_USER_POOL_ID          | Open https://us-east-2.console.aws.amazon.com/cognito/v2/idp/user-pools and see details of user-auth and get User pool ID                                     | Yes          |
| COGNITO_CLIENT_ID             | Open https://us-east-2.console.aws.amazon.com/cognito/v2/idp/user-pools and see details of user-auth and open app clients, get Client ID                      | Yes          |
| SENTRY_DSN                    | If you use Sentry you can put the dsn for logs                                                                                                                | No           |
| AUTH_URL                      | Micro service auth for local is http://localhost:3001                                                                                                         | Yes          |
| RAFIKI_GRAPHQL_URL            | Instance of rafiki [Doc official](https://github.com/interledger/rafiki/tree/main/localenv)                                                                   | Yes          |
| DOMAIN_WALLET_URL             | Domain used for create new wallets                                                                                                                            | Yes          |
| BACKEND_API_SIGNATURE_VERSION | Version of signature of rafiki                                                                                                                                | Yes          |
| BACKEND_API_SIGNATURE_SECRET  | Secret for create signature in servers of rafiki                                                                                                              | Yes          |
| SQS_QUEUE_URL                 | Open https://us-east-2.console.aws.amazon.com/sqs/v3/home?region=us-east-2#/queues and see details of paystreme-notifications-local and and get parameter URL | Yes          |
| WALLET_WG_URL                 | Url for service of wallet for enviroment local is http://localhost:3003                                                                                       | Yes          |
| CRON_TIME_EXPRESSION          | 1 0 1 * * Expression for run command create balances of service providers                                                                                     | Yes          |
| API_SECRET_SERVICES           | Secret for create jwt header                                                                                                                                  | Yes          |
| WS_URL                        | WS URL for public access                                                                                                                                      | No           |
| SIGNATURE_URL                 | Signature URL for public access for create auth in rafiki https://kxu5d4mr4blcthphxomjlc4xk40rvdsx.lambda-url.eu-central-1.on.aws/                            | Yes          |

### 4. Set Up Environment Variables

Create a `.env` file in the root directory and add:

```ini
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
SECRET_NAME="walletguru-wallet-local"
```

---

## Infrastructure Setup with `wg-infra`

The **wg-infra** repository is responsible for provisioning multiple AWS resources required by this project, including *
*ECR repositories, databases, IAM roles, networking, and other cloud infrastructure**.

### **Important:**

Make sure that the **Docker images of all microservices** are built and pushed to **AWS ECR** **before** installing and
running `wg-infra`. Otherwise, the infrastructure setup may fail due to missing dependencies.

## Ensure Consistency Across Microservices

Make sure you follow similar steps when setting up, deploying, and managing the following microservices hosted in the
respective repositories:

| **Microservice**                                | **Repository URL**                                               |
|-------------------------------------------------|------------------------------------------------------------------|
| Authentication Service (`backend-auth`)         | [GitHub Repo](https://github.com/WalletGuruLLC/backend-auth)     |
| Notification Service (`backend-notification`)   | [GitHub Repo](https://github.com/your-org/backend-notification)  |
| Admin Frontend (`frontend-admin`)               | [GitHub Repo](https://github.com/WalletGuruLLC/frontend-admin)   |
| Wallet Service (`backend-wallet`)               | [GitHub Repo](https://github.com/WalletGuruLLC/backend-wallet)   |
| Countries Now Service (`backend-countries-now`) | [GitHub Repo](https://github.com/ErgonStreamGH/wg-countries-now) |
| Codes Service (`backend-codes`)                 | [GitHub Repo](https://github.com/ErgonStreamGH/wg-backend-codes) |

Each microservice should:

1️⃣ Deploy the dependencies using Terraform in the **wg-infra** repository
2️⃣ Store environment variables securely in **AWS Secrets Manager**
3️⃣ Use **Docker Compose** for local development

