export const HttpStatus = {
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
};

export const StatusMessages = {
	[HttpStatus.OK]: 'success',
	[HttpStatus.CREATED]: 'created',
	[HttpStatus.ACCEPTED]: 'accepted',
	[HttpStatus.NO_CONTENT]: 'no content',
	[HttpStatus.BAD_REQUEST]: 'bad request',
	[HttpStatus.UNAUTHORIZED]: 'unauthorized',
	[HttpStatus.FORBIDDEN]: 'forbidden',
	[HttpStatus.NOT_FOUND]: 'not found',
	[HttpStatus.INTERNAL_SERVER_ERROR]: 'internal server error',
	[HttpStatus.BAD_GATEWAY]: 'bad gateway',
	[HttpStatus.SERVICE_UNAVAILABLE]: 'service unavailable',
};

export const errorCodes = {
	WGE0001: {
		message: 'Incorrect password',
		description:
			'The entered password does not match the one registered in the system.',
		descriptionEs:
			'La contraseña ingresada no coincide con la registrada en el sistema.',
	},
	WGE0002: {
		message: 'User not found',
		description:
			'There is no account associated with the entered email or username.',
		descriptionEs:
			'No existe una cuenta asociada con el correo electrónico o nombre de usuario ingresado.',
	},
	WGE0003: {
		message: 'User already exists',
		description:
			'An account is already registered with the provided email or username.',
		descriptionEs:
			'Ya existe una cuenta registrada con el correo electrónico o nombre de usuario proporcionado.',
	},
	WGE0004: {
		message: 'Email not verified',
		description: 'The account exists, but the email has not been verified.',
		descriptionEs:
			'La cuenta existe, pero el correo electrónico no ha sido verificado.',
	},
	WGE0005: {
		message: 'Incorrect verification code',
		description: 'The entered verification code is incorrect or has expired.',
		descriptionEs:
			'El código de verificación ingresado es incorrecto o ha expirado.',
	},
	WGE0006: {
		message: 'Session expired',
		description: 'The authentication session has expired, please log in again.',
		descriptionEs:
			'La sesión de autenticación ha expirado, por favor inicie sesión nuevamente.',
	},
	WGE0007: {
		message: 'Incorrect old password',
		description: 'The current password entered is incorrect.',
		descriptionEs: 'La contraseña actual ingresada es incorrecta.',
	},
	WGE0008: {
		message: 'New password not valid',
		description:
			'The new password does not meet the established security requirements.',
		descriptionEs:
			'La nueva contraseña no cumple con los requisitos de seguridad establecidos.',
	},
	WGE0010: {
		message: 'Error sending verification email',
		description:
			'There was a problem sending the verification email. Please try again.',
		descriptionEs:
			'Hubo un problema al enviar el correo de verificación. Por favor, inténtelo de nuevo.',
	},
	WGE0011: {
		message: 'Invalid reset token',
		description: 'The entered password reset token is invalid or has expired.',
		descriptionEs:
			'El token de restablecimiento de contraseña ingresado es inválido o ha expirado.',
	},
	WGE0015: {
		message: 'Two-factor authentication error',
		description:
			'Two-factor authentication failed due to an incorrect code or technical issue.',
		descriptionEs:
			'La autenticación de dos factores falló debido a un código incorrecto o un problema técnico.',
	},
	WGE0016: {
		message: 'Internal server error',
		description:
			'An unexpected error occurred on the server. Please try again later.',
		descriptionEs:
			'Ocurrió un error inesperado en el servidor. Por favor, inténtelo de nuevo más tarde.',
	},
	WGE0017: {
		message: 'Invalid user type',
		description: 'The type of user entered is invalid or does not correspond.',
		descriptionEs: 'El tipo de usuario ingresado es inválido o no corresponde.',
	},
	WGE00018: {
		message: 'Incomplete information',
		description:
			'The provided information is incomplete or missing required details.',
		descriptionEs:
			'La información proporcionada está incompleta o falta algún dato requerido.',
	},
	WGE00019: {
		message: 'Invalid request',
		description: 'The request contains invalid or unsupported data.',
		descriptionEs: 'La solicitud contiene datos inválidos o no admitidos.',
	},
	WGE00020: {
		message: 'Operation failed',
		description:
			'An error occurred during the operation. Please try again later.',
		descriptionEs:
			'Ocurrió un error durante la operación. Por favor, intente nuevamente más tarde.',
	},
	WGE0021: {
		message: 'Invalid access token',
		description:
			'The provided access token is invalid or has expired. Please provide a valid token and try again.',
		descriptionEs:
			'El token de acceso proporcionado es inválido o ha expirado. Por favor, proporcione un token válido e inténtelo de nuevo.',
	},
	WGE0022: {
		message: 'Inactive user',
		description: 'The user is inactive.',
		descriptionEs: 'El usuario se encuentra inactivo.',
	},
	WGE0023: {
		message: 'Invalid page',
		description: 'The page is invalid.',
		descriptionEs: 'La pagina es invalida.',
	},
	WGE0024: {
		message: 'Email update not allowed',
		description:
			'The account has already been validated, email update is not permitted.',
		descriptionEs:
			'La cuenta ya ha sido validada, no se permite la actualización del correo electrónico.',
	},
	WGE0025: {
		message: 'Add role failed',
		description: 'Failed to add role. Check info and retry.',
		descriptionEs:
			'Error al agregar el rol. Verifique la información y vuelva a intentarlo.',
	},
	WGE0026: {
		message: 'Edit role failed',
		description: 'Failed to edit role. Check inputs, then retry.',
		descriptionEs:
			'Error al editar el rol. Verifica los datos e inténtalo de nuevo.',
	},
	WGE0027: {
		message: 'Role not found',
		description: 'There is no role with the id provided',
		descriptionEs: 'No hay ningún rol asociado con el id ingresado.',
	},
	WGE0032: {
		message: `Doesn't exist roles`,
		description: `You haven't created any roles yet. Please click 'Add New Role' to get started`,
		descriptionEs: `Aún no has creado ningún rol. Por favor, haz clic en 'Agregar Nuevo Rol' para comenzar`,
	},
	WGE0033: {
		message: `Role not found`,
		description: `The role you are looking for does not exist. Please verify the role ID.`,
		descriptionEs: `El rol que estás buscando no existe. Por favor, verifica el ID del rol.`,
	},
	WGE0035: {
		message: `Failed to update access level`,
		description: `An error occurred while trying to update the access level. Please try again later.`,
		descriptionEs: `Se produjo un error al intentar actualizar el nivel de acceso. Por favor, inténtelo de nuevo más tarde.`,
	},
	WGE0036: {
		message: `Failed to create access level`,
		description: `An error occurred while trying to create the access level. Please try again later.`,
		descriptionEs: `Se produjo un error al intentar crear el nivel de acceso. Por favor, inténtelo de nuevo más tarde.`,
	},
	WGE0037: {
		message: `No modules available`,
		description: `There are no modules available to update for the specified role.`,
		descriptionEs: `No hay módulos disponibles para actualizar para el rol especificado.`,
	},
	WGE0038: {
		message: `No permission to perform this action`,
		description: `You do not have permission to perform this action.`,
		descriptionEs: `No tienes permiso para realizar esta acción.`,
	},
	WGE0039: {
		message: `No permission in the specified module`,
		description: `You do not have permission in the specified module.`,
		descriptionEs: `No tienes permisos en el módulo especificado.`,
	},
	WGE0070: {
		message: 'Failed to send OTP email',
		description:
			'There was an error while sending the OTP email. Please try again.',
		descriptionEs:
			'Hubo un error al enviar el correo electrónico con el OTP. Por favor, inténtelo de nuevo.',
	},
	WGE0073: {
		message: 'Wallet creation failed',
		description: 'An error has occurred. Please try again later.',
		descriptionEs: 'Ocurrió un error. Por favor, intente nuevamente más tarde.',
	},
	WGE0074: {
		message: 'Wallet not found',
		description: 'There is no wallet associated with the entered info.',
		descriptionEs:
			'No hay ninguna billetera asociada con la información ingresada.',
	},
	WGE0075: {
		message: 'Wallet update failed',
		description: 'An error has occurred. Please try again later.',
		descriptionEs: 'Ocurrió un error. Por favor, intente nuevamente más tarde.',
	},
	WGE0078: {
		message: 'Wallet returning error',
		description: 'An error has occurred. Please try again later.',
		descriptionEs: 'Ocurrió un error. Por favor, intente nuevamente más tarde.',
	},
	WGE0080: {
		message: 'AssetId not found',
		description: 'There is no asset with that id provided.',
		descriptionEs: 'No hay ningún asset asociado con el id ingresado.',
	},
	WGE0081: {
		message: 'Wallet address name is already taken',
		description:
			'This wallet address name is already in use. Please choose a different name.',
		descriptionEs:
			'Este nombre de dirección de la billetera ya está en uso. Por favor, elige un nombre diferente',
	},
	WGE0082: {
		message: 'Wallet creation failed',
		description: 'A user can have only one wallet address',
		descriptionEs: 'Un usuario solo puede tener una dirección de billetera.',
	},
};

export const successCodes = {
	WGE0009: {
		message: 'Password changed successfully',
		description: 'The password has been changed successfully.',
		descriptionEs: 'La contraseña ha sido cambiada con éxito.',
	},
	WGE0012: {
		message: 'Password reset successfully',
		description: 'The password has been reset successfully.',
		descriptionEs: 'La contraseña ha sido restablecida con éxito.',
	},
	WGE0013: {
		message: 'User registered successfully',
		description:
			'The user has been registered successfully. A verification email has been sent.',
		descriptionEs:
			'El usuario ha sido registrado con éxito. Se ha enviado un correo de verificación.',
	},
	WGE0014: {
		message: 'Login successful',
		description: 'The user has logged in successfully.',
		descriptionEs: 'El usuario ha iniciado sesión con éxito.',
	},
	WGE0018: {
		message: 'Success sending verification email',
		description: 'The verification code was sent successfully.',
		descriptionEs: 'El código de verificación fue enviado con éxito.',
	},
	WGE0019: {
		message: 'Success getting users',
		description: 'The users was getting succesffully.',
		descriptionEs: 'Los usuarios se han obtenido con éxito.',
	},
	WGE0020: {
		message: 'User updated successfully',
		description: 'The user information has been updated successfully.',
		descriptionEs: 'La información del usuario ha sido actualizada con éxito.',
	},
	WGE0021: {
		message: 'User deleted successfully',
		description: 'The user has been deleted successfully.',
		descriptionEs: 'El usuario ha sido eliminado con éxito.',
	},
	WGE0022: {
		message: 'Successfully returned user info',
		description: 'The user`s information has been successfully obtained.',
		descriptionEs: 'La información del usuario se ha obtenido con éxito.',
	},
	WGS0023: {
		message: 'Add role successful',
		description: 'The role has been added successfully.',
		descriptionEs: 'El rol ha sido añadido con éxito.',
	},
	WGS0024: {
		message: 'Edit role successful',
		description: 'The role has been edited successfully.',
		descriptionEs: 'El rol ha sido editado con éxito.',
	},
	WGS0031: {
		message: 'Success getting roles',
		description: 'The users was getting succesfully.',
		descriptionEs: 'Los roles se han obtenido con éxito.',
	},
	WGE0071: {
		message: 'OTP email sent successfully',
		description: 'The OTP email has been sent successfully.',
		descriptionEs:
			'El correo electrónico con el OTP ha sido enviado con éxito.',
	},
	WGE0072: {
		message: 'Sucessful Wallet Creation',
		description: 'The wallet $variable was Sucessfully created.',
		descriptionEs: 'La billetera $variable se creó correctamente.',
	},
	WGE0076: {
		message: 'Sucessful Wallet Update',
		description: 'The wallet $variable was Sucessfully updated.',
		descriptionEs: 'La billetera $variable se atualizó correctamente.',
	},
	WGE0077: {
		message: 'Sucessful returned wallets',
		description: 'The wallets was getting succesfully.',
		descriptionEs: 'Las billeteras se estaban procesando con éxito.',
	},
	WGS0080: {
		message: 'Sucessful wallet address creation',
		description:
			'Success! Your wallet address is ready. You can easily share it by checking your profile.',
		descriptionEs:
			'¡Creación Exitosa! Tu dirección de billetera está lista. Puedes compartirla fácilmente desde tu perfil.',
	},
};
