import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as dynamoose from 'dynamoose';
import { Model } from 'dynamoose/dist/Model';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

import { RoleSchema } from '../entities/role.schema';
import { errorCodes } from '../../../utils/constants';
import { Role } from '../entities/role.entity';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

@Injectable()
export class RoleService {
	private readonly dbInstance: Model<Role>;

	constructor() {
		const tableName = 'Roles';
		this.dbInstance = dynamoose.model<Role>(tableName, RoleSchema, {
			create: false,
			waitForActive: false,
		});
	}

	async create(createRoleDto: CreateRoleDto) {
		const role = {
			Name: createRoleDto.name,
			Description: createRoleDto.description,
			ProviderId: createRoleDto.providerId,
		};

		const savedRole = await this.dbInstance.create(role);
		return this.mapRoleToResponse(savedRole);
	}

	async findAllPaginated(providerId?: string, page = 1, items = 10) {
		const skip = (page - 1) * items;
		let dbQuery;

		if (providerId) {
			dbQuery = this.dbInstance
				.query('ProviderId')
				.eq(providerId)
				.using('ProviderIdIndex');
		} else {
			dbQuery = this.dbInstance.scan();
		}

		const roles = await dbQuery.exec();

		if (roles.length === 0) {
			throw new Error();
		}

		roles.sort((a, b) => {
			if (a.Active === b.Active) {
				return a.Name.localeCompare(b.Name);
			}
			return a.Active ? -1 : 1;
		});

		const total = roles.length;

		const paginatedRoles = roles.slice(skip, skip + items);

		const transformedRoles = paginatedRoles.map(this.mapRoleToResponse);
		return { roles: transformedRoles, total };
	}

	async findAllActive(providerId?: string) {
		let query = this.dbInstance.scan('Active').eq(true);

		if (providerId) {
			query = query.and().filter('ProviderId').eq(providerId);
		}

		const result = await query.exec();
		return result.map(this.mapRoleToResponse);
	}

	async update(id: string, updateRoleDto: UpdateRoleDto) {
		await this.findOne(id);

		const updatedRole = await this.dbInstance.update({
			Id: id,
			Name: updateRoleDto.name,
			Description: updateRoleDto.description,
		});
		return this.mapRoleToResponse(updatedRole);
	}

	private async findOne(id: string): Promise<Role> {
		const role = await this.dbInstance.get(id);
		if (!role) {
			throw new HttpException(
				{
					customCode: 'WGE0027',
					...errorCodes.WGE0027,
				},
				HttpStatus.NOT_FOUND
			);
		}
		return role;
	}

	async remove(id: string): Promise<void> {
		await this.dbInstance.delete(id);
	}

	async createAccessLevel(
		roleId: string,
		moduleId: string,
		accessLevel: number
	) {
		const docClient = new DocumentClient();

		const params = {
			TableName: 'Roles',
			Key: { Id: roleId },
			UpdateExpression: 'SET #modules.#moduleId = :accessLevel',
			ExpressionAttributeNames: {
				'#modules': 'Modules',
				'#moduleId': moduleId,
			},
			ExpressionAttributeValues: {
				':accessLevel': accessLevel,
			},
			ReturnValues: 'ALL_NEW',
		};

		return await docClient.update(params).promise();
	}

	async updateAccessLevel(
		roleId: string,
		moduleId: string,
		accessLevel: number
	) {
		const docClient = new DocumentClient();

		const params = {
			TableName: 'Roles',
			Key: { Id: roleId },
			UpdateExpression: 'SET #modules.#moduleId = :accessLevel',
			ExpressionAttributeNames: {
				'#modules': 'Modules',
				'#moduleId': moduleId,
			},
			ExpressionAttributeValues: {
				':accessLevel': accessLevel,
			},
			ReturnValues: 'ALL_NEW',
		};

		await docClient.update(params).promise();
		return this.listAccessLevels(roleId);
	}

	async listAccessLevels(roleId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Roles',
			Key: { Id: roleId },
			ProjectionExpression: 'Modules',
		};

		const result = await docClient.get(params).promise();
		return result.Item?.Modules || {};
	}

	async getRoleInfo(roleId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Roles',
			Key: { Id: roleId },
		};

		const result = await docClient.get(params).promise();
		return result.Item;
	}

	async findRole(id: string): Promise<Role> {
		const role = await this.dbInstance.get(id);
		if (!role) {
			throw new HttpException(
				{
					customCode: 'WGE0027',
					...errorCodes.WGE0027,
				},
				HttpStatus.NOT_FOUND
			);
		}
		return role;
	}

	private mapRoleToResponse(role: Role) {
		return {
			id: role.Id,
			name: role.Name,
			description: role.Description,
			providerId: role.ProviderId,
			active: role.Active,
			modules: role.Modules,
			createDate: role.CreateDate,
			updateDate: role.UpdateDate,
		};
	}
}
