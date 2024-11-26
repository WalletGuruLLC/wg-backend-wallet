import { HttpStatus } from '../constants';
import { buscarValorPorClave } from './findKeyValue';

export function validarPermisos({
	role,
	requestedModuleId,
	requiredMethod,
	userId = null,
	serviceProviderId = null,
}) {
	const permissionModule = role.PlatformModules.find(
		module => module[requestedModuleId]
	);

	if (!permissionModule) {
		return {
			statusCode: HttpStatus.UNAUTHORIZED,
			customCode: 'WGE0131',
		};
	}

	if (userId && ['GET', 'PUT', 'PATCH'].includes(requiredMethod)) {
		const serviceProviderAccessLevel = buscarValorPorClave(
			permissionModule[requestedModuleId],
			serviceProviderId
		);

		if (!serviceProviderAccessLevel) {
			return {
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0132',
			};
		}

		const accessMap = {
			GET: 8,
			POST: 4,
			PUT: 2,
			PATCH: 1,
			DELETE: 1,
		};

		const requiredAccess = accessMap[requiredMethod];

		if ((serviceProviderAccessLevel & requiredAccess) !== requiredAccess) {
			return {
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0038',
			};
		}
	}

	return { hasAccess: true };
}
