import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import {
	Body,
	Controller,
	Get,
	Query,
	HttpException,
	HttpStatus,
	Param,
	Put,
	Post,
	UseGuards,
	UsePipes,
	Res,
} from '@nestjs/common';
import {
	ApiBody,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';

import { errorCodes, successCodes } from '../../../utils/constants';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleService } from '../service/role.service';
import { CognitoAuthGuard } from '../../user/guard/cognito-auth.guard';
import { customValidationPipe } from '../../validation.pipe';

@ApiTags('role')
@Controller('api/v1/roles')
export class RoleController {
	constructor(private readonly roleService: RoleService) {}

	@UseGuards(CognitoAuthGuard)
	@Post()
	@UsePipes(customValidationPipe('WGE0025', errorCodes.WGE0025))
	@ApiCreatedResponse({
		description: 'The role has been successfully created.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async create(@Body() createRoleDto: CreateRoleDto) {
		try {
			const role = await this.roleService.create(createRoleDto);
			return {
				statusCode: HttpStatus.CREATED,
				customCode: 'WGS0023',
				customMessage: successCodes.WGS0023?.description,
				customMessageEs: successCodes.WGS0023?.descriptionEs,
				data: role,
			};
		} catch (error) {
			throw new HttpException(
				{
					customCode: 'WGE0025',
					...errorCodes.WGE0025,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Get()
	@ApiOkResponse({
		description: 'Roles have been successfully retrieved.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async findAllPaginated(
		@Query('providerId') providerId?: string,
		@Query('search') search = '',
		@Query('page') page = 1,
		@Query('items') items = 10
	) {
		try {
			const roles = await this.roleService.findAllPaginated(
				providerId,
				Number(page),
				Number(items)
			);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGS0031',
				customMessage: successCodes.WGS0031?.description,
				customMessageEs: successCodes.WGS0031?.descriptionEs,
				data: roles,
			};
		} catch (error) {
			//TODO: throw error only if no roles are found
			throw new HttpException(
				{
					customCode: 'WGE0032',
					...errorCodes.WGE0032,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Get('active')
	@ApiOkResponse({
		description: 'Active roles have been successfully retrieved.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async findAllActive(@Query('providerId') providerId?: string) {
		try {
			const roles = await this.roleService.findAllActive(providerId);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGS0031',
				customMessage: successCodes.WGS0031?.description,
				customMessageEs: successCodes.WGS0031?.descriptionEs,
				data: roles,
			};
		} catch (error) {
			throw new HttpException(
				{
					customCode: 'WGE0032',
					...errorCodes.WGE0032,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@Put(':id')
	@UsePipes(customValidationPipe('WGE0026', errorCodes.WGE0026))
	@ApiOkResponse({
		description: 'The role has been successfully updated.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
		try {
			const role = await this.roleService.update(id, updateRoleDto);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGS0024',
				customMessage: successCodes.WGS0024?.description,
				customMessageEs: successCodes.WGS0024?.descriptionEs,
				data: role,
			};
		} catch (error) {
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				throw new HttpException(
					{
						customCode: 'WGE0026',
						...errorCodes.WGE0026,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@UseGuards(CognitoAuthGuard)
	@ApiOperation({ summary: 'Crear un nuevo nivel de acceso para un módulo' })
	@ApiParam({ name: 'roleId', description: 'ID del rol', type: String })
	@ApiParam({ name: 'moduleId', description: 'ID del módulo', type: String })
	@ApiBody({ schema: { example: { accessLevel: 11 } } })
	@ApiResponse({
		status: 201,
		description: 'Nivel de acceso creado con éxito.',
	})
	@ApiResponse({ status: 404, description: 'Role not found' })
	@Post('/access-level/:roleId/:moduleId')
	async createAccessLevel(
		@Param('roleId') roleId: string,
		@Param('moduleId') moduleId: string,
		@Body('accessLevel') accessLevel: number,
		@Res() res
	) {
		try {
			const role = await this.roleService.findRole(roleId);
			if (!role) {
				throw new HttpException(
					{
						customCode: 'WGE0033',
						...errorCodes.WGE0033,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			await this.roleService.createAccessLevel(roleId, moduleId, accessLevel);

			const roleUpd = await this.roleService.getRoleInfo(roleId);

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				message: 'Role updated successfully',
				data: convertToCamelCase(roleUpd),
			});
		} catch (error) {
			throw new HttpException(
				{
					customCode: 'WGE0036',
					...errorCodes.WGE0036,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@ApiOperation({ summary: 'Editar un nivel de acceso para un módulo' })
	@ApiParam({ name: 'roleId', description: 'ID del rol', type: String })
	@ApiParam({ name: 'moduleId', description: 'ID del módulo', type: String })
	@ApiBody({ schema: { example: { accessLevel: 15 } } })
	@ApiResponse({
		status: 200,
		description: 'Nivel de acceso actualizado con éxito.',
	})
	@ApiResponse({
		status: 404,
		description: 'Role not found or Module not found in role',
	})
	@Put('/access-level/:roleId/:moduleId')
	async updateAccessLevel(
		@Param('roleId') roleId: string,
		@Param('moduleId') moduleId: string,
		@Body('accessLevel') accessLevel: number
	) {
		try {
			const role = await this.roleService.listAccessLevels(roleId);
			if (!role) {
				throw new HttpException(
					{
						customCode: 'WGE0033',
						...errorCodes.WGE0033,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			if (!role || !role[moduleId]) {
				throw new HttpException(
					{
						customCode: 'WGE0037',
						...errorCodes.WGE0037,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			await this.roleService.updateAccessLevel(roleId, moduleId, accessLevel);
			const roleUpd = await this.roleService.getRoleInfo(roleId);

			return {
				statusCode: HttpStatus.OK,
				message: 'Role updated successfully',
				data: roleUpd,
			};
		} catch (error) {
			throw new HttpException(
				{
					customCode: 'WGE0035',
					...errorCodes.WGE0035,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	@UseGuards(CognitoAuthGuard)
	@ApiOperation({ summary: 'Listar los niveles de acceso para un rol' })
	@ApiParam({ name: 'roleId', description: 'ID del rol', type: String })
	@ApiResponse({
		status: 200,
		description: 'Lista de niveles de acceso obtenida con éxito.',
	})
	@ApiResponse({ status: 404, description: 'Role not found' })
	@Get('/access-level/:roleId')
	async listAccessLevels(@Param('roleId') roleId: string) {
		try {
			const role = await this.roleService.findRole(roleId);
			if (!role) {
				throw new HttpException(
					{
						customCode: 'WGE0033',
						...errorCodes.WGE0033,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			const modulos = await this.roleService.listAccessLevels(role?.Id);
			return {
				statusCode: HttpStatus.OK,
				message: 'Access Levels returned successfully',
				data: modulos,
			};
		} catch (error) {
			console.log('error', error?.message);
			throw new HttpException(
				{
					customCode: 'WGE0037',
					...errorCodes.WGE0037,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
