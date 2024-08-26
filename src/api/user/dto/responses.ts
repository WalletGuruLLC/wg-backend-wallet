import { StateUser, TypeUser } from './user.enums';

export interface ApiResponse<T> {
	statusCode: number;
	message: string;
	data?: T;
}

export interface CreateUserResponse {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	type: TypeUser;
	roleId: string;
	active: boolean;
	state: StateUser;
	serviceProviderId: string;
	lastLogin: Date | null;
	first: boolean;
	termsConditions: boolean;
	privacyPolicy: boolean;
}

export interface SignInResponse {
	token: string;
	user: CreateUserResponse;
}

export interface getUsersResponse {
	users: Array<any>;
}
