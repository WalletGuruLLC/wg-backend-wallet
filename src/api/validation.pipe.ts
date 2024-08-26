import {
	ValidationPipe,
	ValidationError,
	HttpException,
	HttpStatus,
} from '@nestjs/common';

export function customValidationPipe(customCode: string, errorCodes: any) {
	return new ValidationPipe({
		exceptionFactory: (errors: ValidationError[]) => {
			const message = errors.map(
				error =>
					`${error.property} has wrong value ${error.value}, ${Object.values(
						error.constraints
					).join(', ')}`
			);
			return new HttpException(
				{ customCode, ...errorCodes, message },
				HttpStatus.BAD_REQUEST
			);
		},
	});
}
