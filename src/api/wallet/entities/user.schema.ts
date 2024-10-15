import * as dynamoose from 'dynamoose';
import { User } from './user.entity';
import { v4 as uuidv4 } from 'uuid';
import { MfaTypeUser, StateUser, TypeUser } from '../dto/user.enums';

export const UserSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
		},
		FirstName: {
			type: String,
		},
		LastName: {
			type: String,
		},
		Email: {
			type: String,
			index: {
				global: true,
				name: 'EmailIndex',
			},
		},
		PasswordHash: {
			type: String,
			required: true,
		},
		MfaEnabled: {
			type: Boolean,
			default: false,
		},
		MfaType: {
			type: String,
			enum: Object.values(MfaTypeUser),
			default: MfaTypeUser.TOTP,
		},
		Type: {
			type: String,
			enum: Object.values(TypeUser),
			default: TypeUser.PLATFORM,
			index: {
				global: true,
				name: 'UserTypeIndex',
			},
		},
		RoleId: {
			type: String,
			default: 'EMPTY',
		},
		Active: {
			type: Boolean,
			default: true,
		},
		First: {
			type: Boolean,
			default: true,
		},
		State: {
			type: Number,
			enum: Object.values(StateUser),
			default: StateUser.VERIFY,
		},
		Picture: {
			type: String,
			default: '',
		},
		Phone: {
			type: String,
			index: {
				global: true,
				name: 'PhoneIndex',
			},
		},
		SendSms: {
			type: Boolean,
			default: false,
		},
		SendEmails: {
			type: Boolean,
			default: true,
		},
		ServiceProviderId: {
			type: String,
			default: 'EMPTY',
		},
		LastSignIn: {
			type: Date,
			default: null,
		},
		Otp: {
			type: String,
			default: '',
		},
		OtpTimestamp: {
			type: Date,
			default: () => new Date(),
		},
		TermsConditions: {
			type: Boolean,
			default: false,
		},
		PrivacyPolicy: {
			type: Boolean,
			default: false,
		},
		SocialSecurityNumber: {
			type: String,
		},
		IdentificationType: {
			type: String,
		},
		IdentificationNumber: {
			type: String,
		},
		Country: {
			type: String,
		},
		StateLocation: {
			type: String,
		},
		City: {
			type: String,
		},
		ZipCode: {
			type: String,
		},
		Address: {
			type: String,
		},
		DateOfBirth: {
			type: Date,
		},
		Avatar: {
			type: String,
		},
		ContactUser: {
			type: Boolean,
			default: false,
		},
		LinkedServiceProviders: {
			type: Array,
			schema: [String],
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);

// Asocia el modelo con la clase User
export const UserModel = dynamoose.model<User>('Users', UserSchema, {
	create: false,
	update: false,
	waitForActive: false,
});
