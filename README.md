# Authentication Microservice

This **Authentication Microservice** provides secure user authentication and authorization using **Node.js** and *
*NestJS**. It integrates **DynamoDB** as the NoSQL database with **Dynamoose** as the ORM.

## Dependencies

This microservice uses the following key dependencies:

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [DynamoDB](https://aws.amazon.com/dynamodb/) - NoSQL database
- [Dynamoose](https://dynamoosejs.com/) - ORM for DynamoDB
- [AWS SDK](https://aws.amazon.com/sdk-for-node-js/) - AWS integration
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Secure password hashing

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

### 4. Set Up Environment Variables

Create a `.env` file in the root directory and add:

```ini
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
SECRET_NAME="walletguru-wallet-local"
```

---

## Deployment to AWS ECR

### 1. Create an AWS ECR Repository

#### Option 1: Manually via AWS Console

1. **Go to the AWS ECR Console**
    - Open the [AWS ECR Console](https://console.aws.amazon.com/ecr/home).
2. **Create a New Repository**
    - Click **"Create repository"**.
    - Set the **Repository name** to `backend-wallet`.
    - Choose **Private** or **Public** based on your needs.
    - (Optional) Enable **Scan on Push** for security checks.
    - Click **"Create repository"**.
3. For more details, see
   the [AWS ECR Repository Creation Guide](https://docs.aws.amazon.com/en_us/AmazonECR/latest/userguide/repository-create.html).

#### Option 2: Using AWS CLI (Automated)

##### **Step 1: Sign in to AWS CLI**

Ensure you are authenticated with AWS before creating the repository:

```sh
aws configure
```

This command will prompt you to enter your AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and default
region).

##### **Step 2: Create the Repository**

```sh
aws ecr create-repository --repository-name backend-wallet
```

### 2. Add Repository Details to `wg-infra/local.tfvars`

After creating the repository, update the Terraform variables in `wg-infra/local.tfvars`:

- **Add the repository name to `repos_list`:**
  ```hcl
  repos_list = [
    "backend-wallet",  # Add this line
    # Other repositories...
  ]
  ```

- **Add the repository URI to `microservices_list`:**
  ```hcl
  microservices_list = {
    "backend-wallet" = "<AWS_ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/backend-wallet"
    # Other microservices...
  }
  ```

### 3. Build the Docker Image

Using **Docker Compose**:

```sh
docker-compose build
```

### 4. Authenticate Docker with AWS ECR

```sh
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com
```

### 5. Tag and Push Image to ECR

```sh
docker tag wg-backend-wallet-server:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/backend-wallet:latest

docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/backend-wallet:latest
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

| **Microservice**                              | **Repository URL**                                              |
|-----------------------------------------------|-----------------------------------------------------------------|
| Authentication Service (`backend-auth`)       | [GitHub Repo](https://github.com/WalletGuruLLC/backend-auth)    |
| Notification Service (`backend-notification`) | [GitHub Repo](https://github.com/your-org/backend-notification) |
| Admin Frontend (`frontend-admin`)             | [GitHub Repo](https://github.com/WalletGuruLLC/frontend-admin)  |
| Wallet Service (`backend-wallet`)             | [GitHub Repo](https://github.com/WalletGuruLLC/backend-wallet)  |

Each microservice should:

1️⃣ Have its **Docker image pushed to AWS ECR**  
2️⃣ Be referenced in **`wg-infra/local.tfvars`** for Terraform  
3️⃣ Store environment variables securely in **AWS Secrets Manager**

