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

	async listWalletInfo(walletAddressId: string) {
		const query = gql`
			query WalletAddress($walletAddressId: String!) {
				walletAddress(id: $walletAddressId) {
					id
					publicName
					url
					asset {
						code
						id
						liquidity
						scale
						__typename
					}
				}
			}
		`;

		const variables = { walletAddressId };
		const client = this.apolloClientService.getClient();
		return await client.query({ query, variables });
	}

	async listTransactions(id: string) {
		const query = gql`
			query WalletAddress($id: String!) {
				walletAddress(id: $id) {
					outgoingPayments {
						edges {
							node {
								id
								walletAddressId
								state
								receiveAmount {
									value
									assetCode
									assetScale
								}
								receiver
								metadata
								sentAmount {
									value
									assetCode
									assetScale
								}
								createdAt
							}
							cursor
						}
						pageInfo {
							endCursor
							hasNextPage
							hasPreviousPage
							startCursor
						}
					}
				}
			}
		`;

		// const variables = { walletAddressId };
		const variables = { id };
		const client = this.apolloClientService.getClient();
		return await client.query({ query, variables });
	}

	async createReceiver(input: any) {
		const mutation = gql`
			mutation CreateReceiver($input: CreateReceiverInput!) {
				createReceiver(input: $input) {
					receiver {
						completed
						createdAt
						expiresAt
						metadata
						id
						incomingAmount {
							assetCode
							assetScale
							value
						}
						walletAddressUrl
						receivedAmount {
							assetCode
							assetScale
							value
						}
						updatedAt
					}
				}
			}
		`;

		const variables = { input };
		const client = this.apolloClientService.getClient();
		const result = await client.mutate({ mutation, variables });
		return result.data;
	}

	async createQuote(input: any) {
		const mutation = gql`
			mutation CreateQuote($input: CreateQuoteInput!) {
				createQuote(input: $input) {
					quote {
						createdAt
						expiresAt
						id
						walletAddressId
						receiveAmount {
							assetCode
							assetScale
							value
						}
						receiver
						debitAmount {
							assetCode
							assetScale
							value
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

	async createOutgoingPayment(input: any) {
		const mutation = gql`
			mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
				createOutgoingPayment(input: $input) {
					payment {
						createdAt
						error
						metadata
						id
						walletAddressId
						receiveAmount {
							assetCode
							assetScale
							value
						}
						receiver
						debitAmount {
							assetCode
							assetScale
							value
						}
						sentAmount {
							assetCode
							assetScale
							value
						}
						state
						stateAttempts
					}
				}
			}
		`;

		const variables = { input };
		const client = this.apolloClientService.getClient();
		const result = await client.mutate({ mutation, variables });
		return result.data;
	}

	async getOutgoingPayment(id: string) {
		const query = gql`
			query GetOutgoingPayment($id: String!) {
				outgoingPayment(id: $id) {
					createdAt
					error
					metadata
					id
					grantId
					walletAddressId
					quote {
						id
					}
					receiveAmount {
						assetCode
						assetScale
						value
					}
					receiver
					debitAmount {
						assetCode
						assetScale
						value
					}
					sentAmount {
						assetCode
						assetScale
						value
					}
					state
					stateAttempts
				}
			}
		`;

		const variables = { id };
		const client = this.apolloClientService.getClient();
		const result = await client.query({ query, variables });
		return result.data;
	}

	async createDepositOutgoingMutation(input: any) {
		const mutation = gql`
			mutation DepositOutgoingPaymentLiquidity(
				$input: DepositOutgoingPaymentLiquidityInput!
			) {
				depositOutgoingPaymentLiquidity(input: $input) {
					success
				}
			}
		`;

		const variables = { input };
		const client = this.apolloClientService.getClient();
		const result = await client.mutate({ mutation, variables });
		return result.data;
	}

	async getInconmingPayment(id: string) {
		const query = gql`
			query IncomingPayment($id: String!) {
				incomingPayment(id: $id) {
					id
					walletAddressId
					incomingAmount {
						assetScale
						assetCode
						value
					}
					metadata
					createdAt
					state
				}
			}
		`;

		const variables = { id };
		const client = this.apolloClientService.getClient();
		const result = await client.query({ query, variables });
		return result.data?.incomingPayment;
	}

	async getWalletAddressAsset(id: string) {
		const query = gql`
			query WalletAddress($id: String!) {
				walletAddress(id: $id) {
					id
					asset {
						id
						code
						scale
						liquidity
					}
				}
			}
		`;

		const variables = { id };

		const client = this.apolloClientService.getClient();
		const result = await client.query({ query, variables });

		return result.data?.walletAddress?.asset;
	}

	async getIncomingPayment(id: string) {
		const query = gql`
			query GetIncomingPayment($id: String!) {
				incomingPayment(id: $id) {
					id
					walletAddressId
					client
					state
					expiresAt
					incomingAmount {
						value
						assetCode
						assetScale
					}
					receivedAmount {
						value
						assetCode
						assetScale
					}
					metadata
					createdAt
				}
			}
		`;

		const variables = { id };

		const client = this.apolloClientService.getClient();
		const result = await client.query({ query, variables });

		return result.data?.incomingPayment;
	}

	async cancelOutgoingPayment(input: any) {
		const mutation = gql`
			mutation CancelOutgoingPayment($input: CancelOutgoingPaymentInput!) {
				cancelOutgoingPayment(input: $input) {
					payment {
						createdAt
						error
						metadata
						id
						walletAddressId
						quote {
							createdAt
							expiresAt
							highEstimatedExchangeRate
							id
							lowEstimatedExchangeRate
							maxPacketAmount
							minExchangeRate
							walletAddressId
							receiveAmount {
								assetCode
								assetScale
								value
							}
							receiver
							debitAmount {
								assetCode
								assetScale
								value
							}
						}
						receiveAmount {
							assetCode
							assetScale
							value
						}
						receiver
						debitAmount {
							assetCode
							assetScale
							value
						}
						sentAmount {
							assetCode
							assetScale
							value
						}
						state
						stateAttempts
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
