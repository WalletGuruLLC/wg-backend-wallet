import { Injectable } from '@nestjs/common';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import fetch from 'cross-fetch';

@Injectable()
export class ApolloClientService {
	private client: ApolloClient<any>;

	constructor() {
		this.client = new ApolloClient({
			link: new HttpLink({
				uri: 'http://18.191.192.12:3001/graphql',
				fetch,
			}),
			cache: new InMemoryCache(),
		});
	}

	getClient(): ApolloClient<any> {
		return this.client;
	}
}
