import { Injectable } from '@nestjs/common';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import fetch from 'cross-fetch';

@Injectable()
export class ApolloClientService {
	private client: ApolloClient<any>;

	constructor() {
		this.client = new ApolloClient({
			link: new HttpLink({
				uri:
					process.env.RAFIKI_GRAPHQL_URL || 'http://18.191.192.12:3001/graphql',
				fetch,
			}),
			cache: new InMemoryCache(),
			defaultOptions: {
				watchQuery: {
					fetchPolicy: 'no-cache', // Ignora la caché para las consultas en tiempo real
				},
				query: {
					fetchPolicy: 'no-cache', // Siempre obtiene los datos de la red
				},
				mutate: {
					fetchPolicy: 'no-cache', // No utiliza caché después de una mutación
				},
			},
		});
	}

	getClient(): ApolloClient<any> {
		return this.client;
	}
}
