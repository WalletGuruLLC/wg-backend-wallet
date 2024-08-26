export interface CognitoServiceInterface {
	createUser(username: string, password: string, email: string): Promise<any>;
}
