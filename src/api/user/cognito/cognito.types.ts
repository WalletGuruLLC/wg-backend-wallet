export interface CognitoUserAttribute {
	Name: string;
	Value: string;
}

export interface CognitoUser {
	Username?: string;
	Attributes?: CognitoUserAttribute[];
	UserCreateDate?: Date;
	UserLastModifiedDate?: Date;
	Enabled?: boolean;
	UserStatus?: string;
}

export interface CreateUserResponse {
	User?: CognitoUser;
}

export interface AuthenticationResult {
	AccessToken: string;
	ExpiresIn: number;
	IdToken: string;
	RefreshToken?: string;
	TokenType: string;
}

export interface AuthenticateUserResponse {
	AuthenticationResult?: AuthenticationResult;
}

export interface ChangePasswordResponse {}
export interface ForgotPasswordResponse {}
export interface ConfirmForgotPasswordResponse {}
