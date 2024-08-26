import {
	Body,
	Controller,
	Delete,
	Get,
	HttpException,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Req,
	Res,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiTags,
} from '@nestjs/swagger';

import { AuthChangePasswordUserDto } from '../dto/auth-change-password-user.dto';
import { AuthConfirmPasswordUserDto } from '../dto/auth-confirm-password-user.dto';
import { AuthForgotPasswordUserDto } from '../dto/auth-forgot-password-user.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { SignInDto } from '../dto/signin.dto';
import { SendOtpDto } from '../dto/send-otp-email.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserService } from '../service/user.service';
import { errorCodes, successCodes } from '../../../utils/constants';
import { GetUsersDto } from '../dto/get-user.dto';
import { VerifyOtpDto } from '../../auth/dto/verify-otp.dto';
import { CognitoAuthGuard } from '../guard/cognito-auth.guard';
import { UpdateStatusUserDto } from '../dto/update-status-user.dto';
import { validatePassword } from '../../../utils/helpers/validatePassword';

@ApiTags('user')
@Controller('api/v1/users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Post('/register')
	@ApiCreatedResponse({
		description: 'The record has been successfully created.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async create(@Body() createUserDto: CreateUserDto, @Res() res) {
		try {
			const userFind = await this.userService.findOneByEmail(
				createUserDto?.email
			);
			if (userFind) {
				return res.status(HttpStatus.FORBIDDEN).send({
					statusCode: HttpStatus.FORBIDDEN,
					customCode: 'WGE0003',
					customMessage: errorCodes?.WGE0003?.description,
					customMessageEs: errorCodes.WGE0003?.descriptionEs,
				});
			}

			if (!['WALLET', 'PLATFORM', 'PROVIDER'].includes(createUserDto.type)) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0017',
					customMessage: errorCodes.WGE0017?.description,
					customMessageEs: errorCodes.WGE0017?.descriptionEs,
				});
			}

			if (createUserDto?.type === 'WALLET' && !createUserDto?.passwordHash) {
				return res.status(HttpStatus.PARTIAL_CONTENT).send({
					statusCode: HttpStatus.PARTIAL_CONTENT,
					customCode: 'WGE00018',
					customMessage: errorCodes?.WGE00018?.description,
					customMessageEs: errorCodes.WGE00018?.descriptionEs,
				});
			}

			const result = await this.userService.create(createUserDto);
			return res.status(HttpStatus.CREATED).send({
				statusCode: HttpStatus.CREATED,
				customCode: 'WGE0018',
				customMessage: successCodes.WGE0018?.description,
				customMessageEs: successCodes.WGE0018?.descriptionEs,
				data: result,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Get('/current-user')
	@ApiOkResponse({
		description: 'Successfully returned user info',
	})
	@ApiForbiddenResponse({ description: 'Invalid access token.' })
	async getUserInfo(@Req() req, @Res() res) {
		try {
			const userInfo = req.user;
			const userFind = await this.userService.findOneByEmail(
				userInfo?.UserAttributes?.[0]?.Value
			);

			let accessLevel = {};
			if (userFind?.roleId !== 'EMPTY') {
				accessLevel = await this.userService.listAccessLevels(userFind?.roleId);
			}

			userFind.accessLevel = accessLevel;

			delete userFind?.passwordHash;
			delete userFind?.otpTimestamp;

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0022',
				customMessage: successCodes.WGE0022?.description,
				customMessageEs: successCodes.WGE0022?.descriptionEs,
				data: userFind,
			});
		} catch (error) {
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0021',
				customMessage: errorCodes.WGE0021?.description,
				customMessageEs: errorCodes.WGE0021?.descriptionEs,
			});
		}
	}

	@Post('/verify/register')
	@ApiOkResponse({
		description: 'The user has been successfully verified.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async verifySignUp(@Body() verifyOtpDto: VerifyOtpDto, @Res() res) {
		try {
			const result = await this.userService.verifySignUp(verifyOtpDto);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0013',
				customMessage: successCodes.WGE0013?.description,
				customMessageEs: successCodes.WGE0013?.descriptionEs,
				data: result,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0005',
					customMessage: errorCodes.WGE0005?.description,
					customMessageEs: errorCodes.WGE0005?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}
	}

	@Get('/:id')
	@ApiOkResponse({
		description: 'The record has been successfully retrieved.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async findOne(@Param('id') id: string, @Res() res) {
		try {
			const user = await this.userService.findOne(id);
			if (!user) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0019',
				customMessage: successCodes.WGE0019?.description,
				customMessageEs: successCodes.WGE0019?.descriptionEs,
				data: user,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Patch('/:id')
	@ApiOkResponse({
		description: 'The record has been successfully updated.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async update(
		@Param('id') id: string,
		@Body() updateUserDto: UpdateUserDto,
		@Res() res
	) {
		try {
			const userFind = await this.userService.findOne(id);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			if (!userFind?.First && updateUserDto?.email) {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0024',
					customMessage: errorCodes.WGE0024?.description,
					customMessageEs: errorCodes.WGE0024?.descriptionEs,
				});
			}

			const user = await this.userService.update(id, updateUserDto);
			delete user.PasswordHash;

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0020',
				customMessage: successCodes.WGE0020?.description,
				customMessageEs: successCodes.WGE0020?.descriptionEs,
				data: user,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@Delete('/:id')
	@ApiOkResponse({
		description: 'The record has been successfully deleted.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async remove(@Param('id') id: string, @Res() res) {
		try {
			const userFind = await this.userService.findOne(id);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			await this.userService.remove(id);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0021',
				customMessage: successCodes.WGE0021?.description,
				customMessageEs: successCodes.WGE0021?.descriptionEs,
			});
		} catch (error) {
			if (error.message === 'User not found in database') {
				throw new HttpException(
					{
						statusCode: HttpStatus.NOT_FOUND,
						customCode: 'WGE0002',
						customMessage: errorCodes.WGE0002?.description,
						customMessageEs: errorCodes.WGE0002?.descriptionEs,
					},
					HttpStatus.NOT_FOUND
				);
			} else {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0016',
						customMessage: errorCodes.WGE0016?.description,
						customMessageEs: errorCodes.WGE0016?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
		}
	}

	@Post('/signin')
	@ApiOkResponse({
		description: 'The user has been successfully signed in.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async signin(@Body() signinDto: SignInDto, @Res() res) {
		try {
			const userFind = await this.userService.findOneByEmail(signinDto?.email);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			if (!userFind?.active) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0022',
					customMessage: errorCodes.WGE0022?.description,
					customMessageEs: errorCodes.WGE0022?.descriptionEs,
				});
			}
			await this.userService.signin(signinDto);
			return res.status(HttpStatus.OK).json({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0018',
				customMessage: successCodes.WGE0018?.description,
				customMessageEs: successCodes.WGE0018?.descriptionEs,
			});
		} catch (error) {
			throw new HttpException(
				{
					customCode: 'WGE0001',
					...errorCodes.WGE0001,
					message: error.message,
				},
				HttpStatus.UNAUTHORIZED
			);
		}
	}

	@Post('/verify/otp/mfa')
	@ApiOkResponse({
		description: 'The user has been successfully signed in.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Res() res) {
		try {
			const result = await this.userService.verifyOtp(verifyOtpDto);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0014',
				customMessage: successCodes.WGE0014?.description,
				customMessageEs: successCodes.WGE0014?.descriptionEs,
				data: result,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0005',
					customMessage: errorCodes.WGE0005?.description,
					customMessageEs: errorCodes.WGE0005?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Post('/change-password')
	@ApiOkResponse({
		description: 'The password has been successfully changed.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async changePassword(
		@Body() authChangePasswordUserDto: AuthChangePasswordUserDto,
		@Req() req,
		@Res() res
	) {
		try {
			const userInfo = req.user;
			const userFind = await this.userService.findOneByEmail(
				userInfo?.UserAttributes?.[0]?.Value
			);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			if (!validatePassword(authChangePasswordUserDto?.newPassword)) {
				return res.status(HttpStatus.BAD_REQUEST).send({
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0008',
					customMessage: errorCodes.WGE0008?.description,
					customMessageEs: errorCodes.WGE0008?.descriptionEs,
				});
			}
			const changePassworFormat = {
				token: req.token,
				currentPassword: authChangePasswordUserDto?.currentPassword,
				newPassword: authChangePasswordUserDto?.newPassword,
			};
			await this.userService.changeUserPassword(changePassworFormat);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0009',
				customMessage: successCodes.WGE0009?.description,
				customMessageEs: successCodes.WGE0009?.descriptionEs,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.BAD_REQUEST
			);
		}
	}

	@Post('/forgot-password')
	@UsePipes(ValidationPipe)
	@ApiOkResponse({
		description: 'The password reset request has been successfully processed.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async forgotPassword(
		@Body() authForgotPasswordUserDto: AuthForgotPasswordUserDto,
		@Res() res
	) {
		try {
			const userFind = await this.userService.findOneByEmail(
				authForgotPasswordUserDto?.email
			);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			await this.userService.forgotUserPassword(authForgotPasswordUserDto);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0018',
				customMessage: successCodes.WGE0018?.description,
				customMessageEs: successCodes.WGE0018?.descriptionEs,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@Post('/confirm-password')
	@UsePipes(ValidationPipe)
	@ApiOkResponse({
		description: 'The password has been successfully confirmed.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async confirmPassword(
		@Body() authConfirmPasswordUserDto: AuthConfirmPasswordUserDto,
		@Res() res
	) {
		try {
			const userFind = await this.userService.findOneByEmail(
				authConfirmPasswordUserDto?.email
			);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			await this.userService.confirmUserPassword(authConfirmPasswordUserDto);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0012',
				customMessage: successCodes.WGE0012?.description,
				customMessageEs: successCodes.WGE0012?.descriptionEs,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Get('/')
	@ApiOkResponse({
		description: 'Successfully returned users',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async getUsers(@Query() getUsersDto: GetUsersDto, @Res() res) {
		try {
			const users = await this.userService.getUsersByType(getUsersDto);
			if (!['WALLET', 'PLATFORM', 'PROVIDER'].includes(getUsersDto.type)) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0017',
					customMessage: errorCodes.WGE0017?.description,
					customMessageEs: errorCodes.WGE0017?.descriptionEs,
				});
			}
			if (getUsersDto?.page > users?.totalPages) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0023',
					customMessage: errorCodes.WGE0023?.description,
					customMessageEs: errorCodes.WGE0023?.descriptionEs,
				});
			}

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0019',
				customMessage: successCodes.WGE0019?.description,
				customMessageEs: successCodes.WGE0019?.descriptionEs,
				data: users,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@Patch('/update-status/:id')
	@ApiOkResponse({
		description: 'The user has been successfully updated.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async changeStatusUser(
		@Body() updateUserDto: UpdateStatusUserDto,
		@Res() res
	) {
		try {
			const userFind = await this.userService.findOneByEmail(
				updateUserDto?.email
			);
			if (!userFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				});
			}
			const user = await this.userService.changeStatusUser(updateUserDto);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0020',
				customMessage: successCodes.WGE0020?.description,
				customMessageEs: successCodes.WGE0020?.descriptionEs,
				data: user,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@Post('send-otp')
	@ApiOkResponse({
		description: successCodes.WGE0071?.description,
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async sendOtpEmail(@Body() sendOtpDto: SendOtpDto) {
		try {
			const foundUser = await this.userService.findOneByEmail(sendOtpDto.email);
			if (!foundUser) {
				return {
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				};
			}
			await this.userService.resendOtp(foundUser);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0071',
				customMessage: successCodes.WGE0071?.description,
				customMessageEs: successCodes.WGE0071?.descriptionEs,
			};
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0070',
					customMessage: errorCodes.WGE0070?.description,
					customMessageEs: errorCodes.WGE0070?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Post('/logout')
	@ApiOkResponse({
		description: 'Logout successfully.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async revokeTokenLogout(@Req() req, @Res() res) {
		try {
			const token = req.token;
			await this.userService.revokeTokenLogout(token);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0072',
				customMessage: successCodes.WGE0072?.description,
				customMessageEs: successCodes.WGE0072?.descriptionEs,
			});
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
