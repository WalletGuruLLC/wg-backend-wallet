import {
	Injectable,
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { UserService } from '../service/user.service';
import { errorCodes } from '../../../utils/constants';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
	constructor(private readonly authService: UserService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers.authorization;

		if (!authHeader) {
			throw new HttpException(
				{
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			const user = await this.authService.getUserInfo(authHeader);
			request.user = user;
			request.token = authHeader;
			return true;
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}
	}
}
