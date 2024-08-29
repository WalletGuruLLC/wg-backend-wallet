import { Injectable } from '@nestjs/common';
import { ApolloClientService } from './apollo-client.service';
import { gql } from '@apollo/client/core';

@Injectable()
export class GraphqlService {
	constructor(private readonly apolloClientService: ApolloClientService) {}

	async createWalletAddress(input: any) {
		const mutation = gql`
			mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
				createWalletAddress(input: $input) {
					walletAddress {
						id
						createdAt
						publicName
						url
						status
						asset {
							code
							createdAt
							id
							scale
							withdrawalThreshold
						}
						additionalProperties {
							key
							value
							visibleInOpenPayments
						}
					}
				}
			}
		`;

		const variables = { input };
		const client = this.apolloClientService.getClient();
		const result = await client.mutate({ mutation, variables });
		return result.data;
	}
}
