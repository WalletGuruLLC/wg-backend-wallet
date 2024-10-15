import { Document } from 'dynamoose/dist/Document';
import { MfaTypeUser, StateUser, TypeUser } from '../dto/user.enums';

export class User extends Document {
	Id = '';
	FirstName = '';
	LastName = '';
	Email = '';
	Phone = '';
	PasswordHash = '';
	MfaEnabled = false;
	MfaType: string = MfaTypeUser.TOTP;
	Type: TypeUser = TypeUser.PLATFORM;
	RoleId = '';
	Active: boolean;
	First: boolean;
	State: StateUser = StateUser.VERIFY;
	Picture = '';
	SendSms = false;
	SendEmails = true;
	ServiceProviderId = '';
	LastLogin?: Date = null;
	OtpTimestamp: Date = new Date();
	TermsConditions = false;
	PrivacyPolicy = false;
	AccessLevel = {};
	SocialSecurityNumber?: string;
	IdentificationType?: string;
	IdentificationNumber?: string;
	Country?: string;
	StateLocation?: string;
	City?: string;
	ZipCode?: string;
	Address?: string;
	DateOfBirth?: Date = null;
	Avatar?: string;
	ContactUser: boolean;
	LinkedServiceProviders?: string[];
}
