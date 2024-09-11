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

	async createWalletAddressKey(input: any) {
		const mutation = gql`
			mutation CreateWalletAddressKey($input: CreateWalletAddressKeyInput!) {
				createWalletAddressKey(input: $input) {
					walletAddressKey {
						id
						revoked
						walletAddressId
						createdAt
						jwk {
							alg
							crv
							kid
							kty
							x
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

	async getAssets(
		after: string | null,
		before: string | null,
		first: number | null,
		last: number | null
	) {
		const query = gql`
			query GetAssets(
				$after: String
				$before: String
				$first: Int
				$last: Int
			) {
				assets(after: $after, before: $before, first: $first, last: $last) {
					edges {
						cursor
						node {
							code
							createdAt
							id
							scale
							withdrawalThreshold
							liquidityThreshold
							liquidity
							sendingFee {
								id
								type
								basisPoints
								fixed
							}
							receivingFee {
								id
								type
								basisPoints
								fixed
							}
						}
					}
					pageInfo {
						endCursor
						hasNextPage
						hasPreviousPage
						startCursor
					}
				}
			}
		`;

		const variables = { after, before, first, last };
		const client = this.apolloClientService.getClient();
		const result = await client.query({ query, variables });
		return result.data.assets.edges.map(edge => edge.node);
	}
}
