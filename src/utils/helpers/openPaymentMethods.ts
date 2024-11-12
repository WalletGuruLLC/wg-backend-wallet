import axios from 'axios';
import { addSignatureHeaders } from './openPaymentSignature';
import {
	createAuthenticatedClient,
	createUnauthenticatedClient,
	isPendingGrant,
	OpenPaymentsClientError,
} from '@interledger/open-payments';

export const getGrantForIncomingPayment = async (
	clientWalletAddress,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		const headers = await addSignatureHeaders(req, clientKey, clientPrivate);
		// console.log({
		// 	walletAddressUrl: clientWalletAddress,
		// 	privateKey: clientPrivate,
		// 	keyId: clientKey,
		// });

		// const client = await createAuthenticatedClient({
		// 	walletAddressUrl: clientWalletAddress,
		// 	privateKey: clientPrivate,
		// 	keyId: clientKey,
		// });

		// const walletAddress = await client.walletAddress.get({
		// 	url: clientWalletAddress,
		// });

		// console.log(walletAddress);

		// const grant: any = await client.grant.request(
		// 	{
		// 		url: walletAddress?.authServer,
		// 	},
		// 	{
		// 		access_token: {
		// 			access: [
		// 				{
		// 					type: 'incoming-payment',
		// 					actions: ['list', 'read', 'read-all', 'complete', 'create'],
		// 				},
		// 			],
		// 		},
		// 	}
		// );
		// if (isPendingGrant(grant)) {
		// 	throw new Error('Expected non-interactive grant');
		// }
		// console.log('INCOMING_PAYMENT_ACCESS_TOKEN =', grant?.access_token?.value);
		// console.log(
		// 	'INCOMING_PAYMENT_ACCESS_TOKEN_MANAGE_URL = ',
		// 	grant?.access_token?.manage
		// );

		const url = process.env.RECEIVER_HOST;
		const options = {
			method: 'POST',
			url,
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
			data: {
				access_token: {
					access: [
						{
							type: 'incoming-payment',
							actions: ['create', 'read', 'list', 'complete'],
						},
					],
				},
				client: clientWalletAddress,
			},
		};

		console.log('Request Options:', options);

		const { data } = await axios(options);

		console.log('Grant Data:', data);

		return data;
	} catch (error) {
		if (error.response) {
			console.error('Error Response Data:', error.response.data); // Detalles del error
			console.error('Error Status Code:', error.response.status); // Código de estado
			console.error('Error Headers:', error.response.headers); // Encabezados de la respuesta
		} else if (error.request) {
			console.error('Error Request:', error.request); // Detalles de la solicitud fallida
		} else {
			console.error('Error Message:', error.message); // Mensaje del error
		}
		throw error;
	}
};

export const createIncomingPayment = async (
	accessToken,
	receiverWalletAddress,
	receiverAssetCode,
	receiverAssetScale,
	tomorrow,
	req,
	clientKey,
	clientPrivate
) => {
	await addSignatureHeaders(req, clientKey, clientPrivate);

	const options = {
		method: 'POST',
		url: `${process.env.RECEIVER_HOST}/incoming-payments`,
		headers: {
			Authorization: `GNAP ${accessToken}`,
			'content-type': 'application/json',
		},
		data: {
			walletAddress: receiverWalletAddress,
			incomingAmount: {
				value: '100',
				assetCode: receiverAssetCode,
				assetScale: receiverAssetScale,
			},
			expiresAt: tomorrow,
			metadata: {
				description: 'Free Money!',
			},
		},
	};

	try {
		const { data } = await axios.request(options);
		console.log(data);
		return data;
	} catch (error) {
		if (error.response) {
			// La solicitud se completó, pero el servidor respondió con un error (por ejemplo, 400 o 500)
			console.error('Error Response:', error.response.data); // Detalles del error en la respuesta
			console.error('Error Status:', error.response.status); // El código de estado HTTP (ej. 400, 500)
			console.error('Error Headers:', error.response.headers); // Los encabezados de la respuesta
		} else if (error.request) {
			// La solicitud se hizo pero no se recibió una respuesta
			console.error('Error Request:', error.request); // Detalles de la solicitud realizada
		} else {
			// Algo sucedió al configurar la solicitud que causó el error
			console.error('Error Message:', error.message); // Mensaje de error
		}
		throw error; // Re-lanzamos el error para manejarlo en otro lugar si es necesario
	}
};

export const getGrantForQuote = async (
	clientWalletAddress,
	req,
	clientKey,
	clientPrivate
) => {
	await addSignatureHeaders(req, clientKey, clientPrivate);

	const options = {
		method: 'POST',
		url: process.env.SENDER_HOST,
		headers: { 'content-type': 'application/json' },
		data: {
			access_token: {
				access: [{ type: 'quote', actions: ['create', 'read'] }],
			},
			client: clientWalletAddress,
		},
	};

	try {
		const { data } = await axios.request(options);
		console.log(data);
		return data;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const createQuote = async (
	accessToken,
	senderWalletAddress,
	receiverOpenPaymentsHost,
	incomingPaymentId,
	req,
	clientKey,
	clientPrivate
) => {
	await addSignatureHeaders(req, clientKey, clientPrivate);

	const options = {
		method: 'POST',
		url: `http://${process.env.SENDER_HOST}/quotes`,
		headers: {
			Authorization: `GNAP ${accessToken}`,
			'content-type': 'application/json',
		},
		data: {
			walletAddress: senderWalletAddress,
			receiver: `${receiverOpenPaymentsHost}/incoming-payments/${incomingPaymentId}`,
			method: 'ilp',
		},
	};

	try {
		const { data } = await axios.request(options);
		console.log(data);
		return data;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const getGrantForOutgoingPayment = async (
	clientWalletAddress,
	senderWalletAddress,
	quoteDebitAmount,
	quoteReceiveAmount,
	req,
	clientKey,
	clientPrivate
) => {
	await addSignatureHeaders(req, clientKey, clientPrivate);

	const options = {
		method: 'POST',
		url: process.env.SENDER_HOST,
		headers: { 'content-type': 'application/json' },
		data: {
			access_token: {
				access: [
					{
						type: 'outgoing-payment',
						actions: ['create', 'read', 'list'],
						identifier: senderWalletAddress,
						limits: {
							debitAmount: quoteDebitAmount,
							receiveAmount: quoteReceiveAmount,
						},
					},
				],
			},
			client: clientWalletAddress,
			interact: {
				start: ['redirect'],
			},
		},
	};

	try {
		const { data } = await axios.request(options);
		console.log(data);
		return data;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const createOutgoingPayment = async (
	accessToken,
	senderWalletAddress,
	quoteId,
	req,
	clientKey,
	clientPrivate
) => {
	await addSignatureHeaders(req, clientKey, clientPrivate);

	const options = {
		method: 'POST',
		url: `${process.env.SENDER_HOST}/outgoing-payments`,
		headers: {
			Authorization: `GNAP ${accessToken}`,
			'content-type': 'application/json',
		},
		data: {
			walletAddress: senderWalletAddress,
			quoteId: `${senderWalletAddress}/quotes/${quoteId}`,
			metadata: { description: 'Free Money!' },
		},
	};

	try {
		const { data } = await axios.request(options);
		console.log(data);
		return data;
	} catch (error) {
		console.error(error);
		throw error;
	}
};
