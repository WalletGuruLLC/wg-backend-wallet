export default () => ({
    region: process.env.AWS_REGION,
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    appClientId: process.env.COGNITO_CLIENT_ID,
});