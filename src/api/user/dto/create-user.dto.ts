import { MfaTypeUser, StateUser, TypeUser } from 'src/api/user/dto/user.enums';

export class CreateUserDto {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	passwordHash: string;
	mfaEnabled: boolean;
	mfaType: MfaTypeUser;
	type: TypeUser;
	roleId: string;
	active: boolean;
	state: StateUser;
	picture: string;
	sendSms: boolean;
	sendEmails: boolean;
	serviceProviderId: string;
	lastLogin: Date;
	termsConditions: boolean;
	privacyPolicy: boolean;
}
