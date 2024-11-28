import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

// Solicita encabezados firmados para una URL específica
export const requestSigHeaders = async (
	url,
	method,
	headers,
	body,
	clientKey,
	clientPrivate
) => {
	try {
		const signaturePayload = {
			keyId: clientKey,
			base64Key: clientPrivate,
			request: { url, method, headers, body: JSON.stringify(body) },
		};

		const response = await fetch(process.env.SIGNATURE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(signaturePayload),
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`HTTP error! Status: ${response.status} - ${errorData}`);
		}

		return response.json();
	} catch (error) {
		console.error('Error requesting signature headers:', error);
		throw error;
	}
};

const convertKeysToLowerCase = inputJson =>
	Object.keys(inputJson).reduce((acc, key) => {
		acc[key.toLowerCase()] = inputJson[key];
		return acc;
	}, {});

export const addSignatureHeadersGrantGrant = async (
	req,
	body,
	headers,
	url,
	clientKey,
	clientPrivate
) => {
	return requestSigHeaders(
		url,
		req.method,
		headers,
		body,
		clientKey,
		clientPrivate
	);
};

export const addSignatureHeadersGrantOutgoing = async (
	method,
	body,
	headers,
	url,
	clientKey,
	clientPrivate
) => {
	return requestSigHeaders(
		url,
		method,
		headers,
		body,
		clientKey,
		clientPrivate
	);
};

export const getGrantForIncomingPayment = async (
	clientWalletAddress,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		const grantPayload = {
			access_token: {
				access: [
					{
						type: 'incoming-payment',
						actions: ['create', 'read', 'list', 'complete'],
					},
				],
			},
			client: clientWalletAddress,
		};

		const headers = await addSignatureHeadersGrantGrant(
			req,
			grantPayload,
			{ 'content-type': 'application/json' },
			process.env.RECEIVER_HOST,
			clientKey,
			clientPrivate
		);

		console.log('grant for incoming information', {
			headers: headers,
			body: grantPayload,
		});

		const { data } = await axios.post(process.env.RECEIVER_HOST, grantPayload, {
			headers: convertKeysToLowerCase(headers),
		});

		console.log('response grant for incoming', data);

		return data?.access_token?.value;
	} catch (error) {
		console.log('Error obtaining grant for incoming payment:', error?.message);
		//throw error;
	}
};

// Crea un pago entrante utilizando el access token generado
export const createIncomingPayment = async (
	senderWalletAddress,
	receiverWalletAddress,
	req,
	clientKey,
	clientPrivate,
	metadataIncoming,
	quoteDebitAmount,
	expirationDate
) => {
	try {
		console.log('quoteDebitAmount incoming payment', quoteDebitAmount);

		const accessToken = await getGrantForIncomingPayment(
			senderWalletAddress,
			req,
			clientKey,
			clientPrivate
		);

		const paymentPayload = {
			walletAddress: receiverWalletAddress,
			incomingAmount: quoteDebitAmount,
			expiresAt: expirationDate,
			metadata: metadataIncoming,
		};

		const headers = await addSignatureHeadersGrantGrant(
			req,
			paymentPayload,
			{
				Authorization: `GNAP ${accessToken}`,
				'content-type': 'application/json',
			},
			`${process.env.RECEIVER_INT_HOST}incoming-payments`,
			clientKey,
			clientPrivate
		);

		console.log('create incoming payment information', {
			headers: {
				Authorization: `GNAP ${accessToken}`,
				'content-type': 'application/json',
				...headers,
			},
			body: paymentPayload,
		});

		const { data } = await axios.post(
			`${process.env.RECEIVER_INT_HOST}incoming-payments`,
			paymentPayload,
			{
				headers: {
					Authorization: `GNAP ${accessToken}`,
					'content-type': 'application/json',
					...headers,
				},
			}
		);

		console.log('incomning response', data);

		return data?.id?.split('/')?.pop();
	} catch (error) {
		console.error('Error creating incoming payment:', error?.message);
	}
};
export const getGrantForQuote = async (
	clientWalletAddress,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		const grantPayload = {
			access_token: {
				access: [{ type: 'quote', actions: ['create', 'read'] }],
			},
			client: clientWalletAddress,
		};

		const headers = await addSignatureHeadersGrantGrant(
			req,
			grantPayload,
			{ 'content-type': 'application/json' },
			process.env.SENDER_HOST,
			clientKey,
			clientPrivate
		);

		console.log('grant quote information', {
			headers: headers,
			body: grantPayload,
		});

		const { data } = await axios.post(process.env.SENDER_HOST, grantPayload, {
			headers: convertKeysToLowerCase(headers),
		});

		console.log('response grant quote', data);

		return data?.access_token?.value;
	} catch (error) {
		console.error('Error obtaining grant for quote:', error);
		throw error;
	}
};

function extractIdFromUrl(url) {
	const regex = /\/quotes\/([a-zA-Z0-9-]+)/;
	const match = url.match(regex);
	return match ? match[1] : null; // Retorna el ID si existe, de lo contrario retorna null
}

export const createQuote = async (
	senderWalletAddress,
	incomingPaymentId,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		const accessToken = await getGrantForQuote(
			senderWalletAddress,
			req,
			clientKey,
			clientPrivate
		);

		const quotePayload = {
			walletAddress: senderWalletAddress,
			receiver: `${process.env.RECEIVER_INT_HOST}incoming-payments/${incomingPaymentId}`,
			method: 'ilp',
		};

		const headers = await addSignatureHeadersGrantGrant(
			req,
			quotePayload,
			{
				Authorization: `GNAP ${accessToken}`,
				'content-type': 'application/json',
			},
			`${process.env.SENDER_INT_HOST}quotes`,
			clientKey,
			clientPrivate
		);

		const options = {
			method: 'POST',
			url: `${process.env.SENDER_INT_HOST}quotes`,
			headers: {
				Authorization: `GNAP ${accessToken}`,
				'content-type': 'application/json',
				...headers,
			},
			data: quotePayload,
		};

		console.log('create quote', {
			headers: options?.headers,
			body: options?.data,
		});

		const { data } = await axios.request(options);
		console.log('quote response', data);

		return data;
	} catch (error) {
		console.error('Error creating quote:', error);
		throw error;
	}
};

export const getGrantForOutgoingPayment = async (
	senderWalletAddress,
	quoteDebitAmount,
	quoteReceiveAmount,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		const grantPayload = {
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
			client: senderWalletAddress,
			interact: {
				start: ['redirect'],
			},
		};

		const headers = await addSignatureHeadersGrantGrant(
			req,
			grantPayload,
			{ 'Content-Type': 'application/json' },
			process.env.SENDER_HOST,
			clientKey,
			clientPrivate
		);

		console.log('grant outgoing payment information', {
			headers: headers,
			body: grantPayload,
		});

		console.log(
			'grant outgoing payment access',
			grantPayload?.access_token?.access[0]
		);

		const { data } = await axios.post(process.env.SENDER_HOST, grantPayload, {
			headers: convertKeysToLowerCase(headers),
		});

		console.log('respons grant outgoing', JSON.stringify(data));

		return data;
	} catch (error) {
		console.log('Error obtaining grant for outgoing payment:', error?.message);
	}
};

async function makeRequestInteractions({
	url,
	interactId,
	additionalId,
	method = 'GET',
	params = {},
	body = {},
	headers = {},
}) {
	const fullUrl = `${url}${interactId ? `/${interactId}` : ''}${
		additionalId ? `/${additionalId}` : ''
	}`;

	const cookieJar = new CookieJar();

	const client = wrapper(
		axios.create({ jar: cookieJar, withCredentials: true })
	);

	const options = {
		method,
		url: fullUrl,
		params,
		data: method === 'POST' || method === 'PUT' ? body : undefined,
		headers,
	};

	try {
		await client.request(options);

		const cookiesInfo = cookieJar.toJSON();
		return cookiesInfo?.cookies;
	} catch (error) {
		console.log('Error:', error.response?.data || error.message);
		throw error;
	}
}

async function generalRequestInteractions({
	url,
	interactId,
	additionalId,
	method = 'GET',
	params = {},
	body = {},
	headers = {},
}) {
	const fullUrl = `${url}${interactId ? `/${interactId}` : ''}${
		additionalId ? `/${additionalId}` : ''
	}`;

	const cookieJar = new CookieJar();

	const client = wrapper(
		axios.create({ jar: cookieJar, withCredentials: true })
	);

	const options = {
		method,
		url: fullUrl,
		params,
		data: method === 'POST' || method === 'PUT' ? body : undefined,
		headers,
	};

	console.log('options', options);

	try {
		const response = await client.request(options);
		return response?.data;
	} catch (error) {
		console.log('Error:', error.response?.data || error.message);
	}
}

function parseUrl(url) {
	const urlObj = new URL(url);

	// Obtener el interactId del path
	const pathSegments = urlObj.pathname.split('/');
	const interactId = pathSegments[pathSegments.length - 2];

	// Obtener los parámetros clientName y clientUri
	const clientName = urlObj.searchParams.get('clientName');
	const clientUri = urlObj.searchParams.get('clientUri');

	return {
		interactId,
		clientName,
		clientUri,
	};
}

async function sendOutgoingPayment({
	accessToken,
	clientKey,
	clientPrivate,
	senderWalletAddress,
	quoteId,
	metadataOutgoing,
}) {
	const url = `${process.env.SENDER_INT_HOST}outgoing-payments`;

	const body = {
		walletAddress: senderWalletAddress,
		quoteId: `${senderWalletAddress}/quotes/${quoteId}`,
		metadata: metadataOutgoing,
	};

	const additionalHeaders = await addSignatureHeadersGrantOutgoing(
		'POST',
		body,
		{
			Authorization: `GNAP ${accessToken}`,
			'content-type': 'application/json',
		},
		url,
		clientKey,
		clientPrivate
	);

	const headers = {
		Authorization: `GNAP ${accessToken}`,
		'content-type': 'application/json',
		...additionalHeaders,
	};

	console.log('create outgoing payment', {
		headers: headers,
		body: body,
	});

	try {
		const response = await axios.post(url, body, { headers });

		console.log('Response Outgoing payment request:', response.data);
		return response.data;
	} catch (error) {
		console.log('Error outgoing payment', error);
		//console.error('Error outgoing payment:', error.response?.data || error.message);
	}
}

export const createOutgoingPayment = async (
	senderWalletAddress,
	quoteId,
	quoteInfo,
	req,
	clientKey,
	clientPrivate,
	metadataOutgoing
) => {
	try {
		const accessToken = await getGrantForOutgoingPayment(
			senderWalletAddress,
			quoteInfo?.debitAmount,
			quoteInfo?.receiveAmount,
			req,
			clientKey,
			clientPrivate
		);

		const infoRedirectInteract = parseUrl(accessToken?.interact?.redirect);

		const responseInteract = await makeRequestInteractions({
			url: accessToken?.interact?.redirect,
			interactId: '',
			additionalId: '',
			method: 'GET',
			params: {},
			headers: {
				'x-idp-secret': 'changeme',
				'content-type': 'application/json',
			},
		});

		console.log(
			'infoRedirectInteract',
			accessToken?.interact?.redirect,
			responseInteract
		);

		// Aceptar interacción
		const acceptInteraction = await generalRequestInteractions({
			url: `${process.env.SENDER_INTERACTIONS_HOST}grant`,
			interactId: infoRedirectInteract?.interactId,
			additionalId: `${accessToken?.interact?.finish}/accept`,
			method: 'POST',
			headers: {
				'x-idp-secret': 'changeme',
				'content-type': 'application/json',
			},
		});

		console.log('acceptInteraction', acceptInteraction);

		// Finalizar interacción
		const finishInteraction = await generalRequestInteractions({
			url: `${process.env.SENDER_HOST}interact`,
			interactId: infoRedirectInteract?.interactId,
			additionalId: `${accessToken?.interact?.finish}/finish`,
			method: 'GET',
			headers: {
				'x-idp-secret': 'changeme',
				'content-type': 'application/json',
				Cookie: `sessionId=${responseInteract?.[0]?.value}; sessionId.sig=${responseInteract?.[1]?.value}`,
			},
		});

		console.log('finishInteraction', finishInteraction);

		const delay = ms => new Promise(res => setTimeout(res, ms));

		await delay(10000);

		const headers = await addSignatureHeadersGrantGrant(
			req,
			{},
			{
				Authorization: `GNAP ${accessToken?.continue?.access_token?.value}`,
				'content-type': 'application/json',
			},
			accessToken?.continue?.uri,
			clientKey,
			clientPrivate
		);

		console.log('finishInteraction', finishInteraction);

		await generalRequestInteractions({
			url: accessToken?.continue?.uri,
			interactId: '',
			additionalId: '',
			method: 'POST',
			params: {},
			headers: {
				Authorization: `GNAP ${accessToken?.continue?.access_token?.value}`,
				'content-type': 'application/json',
				...headers,
			},
		}).then(async data => {
			console.log('response continuation req', data);
			const responseCreateOutgoing = await sendOutgoingPayment({
				accessToken: data?.access_token?.value,
				clientKey,
				clientPrivate,
				senderWalletAddress,
				quoteId,
				metadataOutgoing,
			});
			console.log('Create Outgoing Payment Response:', responseCreateOutgoing);
		});
	} catch (error) {
		console.error('Error creating outgoing payment:', error);
		throw error;
	}
};

export const unifiedProcess = async (
	authHost,
	paymentHost,
	receiverWalletAddress,
	senderWalletAddress,
	quoteDebitAmount,
	req,
	clientKey,
	clientPrivate,
	metadataIncoming,
	metadataOutgoing,
	expirationDate
) => {
	try {
		// 1. Crear Incoming Payment
		const incomingPayment = await createIncomingPayment(
			senderWalletAddress,
			receiverWalletAddress,
			req,
			clientKey,
			clientPrivate,
			metadataIncoming,
			quoteDebitAmount,
			expirationDate
		);

		// 2. Crear Quote
		const quote = await createQuote(
			senderWalletAddress,
			incomingPayment,
			req,
			clientKey,
			clientPrivate
		);

		const quoteId = await extractIdFromUrl(quote?.id);

		// 3. Crear Outgoing Payment
		const outgoingPayment = await createOutgoingPayment(
			senderWalletAddress,
			quoteId,
			quote,
			req,
			clientKey,
			clientPrivate,
			metadataOutgoing
		);

		return {
			outgoingPayment,
		};
	} catch (error) {
		console.error('Error in unified process:', error);
		throw error;
	}
};
