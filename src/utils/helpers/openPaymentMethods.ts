import axios from 'axios';

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

		console.log('signaturePayload', signaturePayload);
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

// Convierte las claves de un objeto JSON a minúsculas
const convertKeysToLowerCase = inputJson =>
	Object.keys(inputJson).reduce((acc, key) => {
		acc[key.toLowerCase()] = inputJson[key];
		return acc;
	}, {});

// Agrega encabezados con firma
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

// Obtiene un grant para pagos entrantes
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

		console.log('headers', headers);

		const { data } = await axios.post(process.env.RECEIVER_HOST, grantPayload, {
			headers: convertKeysToLowerCase(headers),
		});

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
	receiverAssetCode,
	receiverAssetScale,
	expirationDate,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		const accessToken = await getGrantForIncomingPayment(
			senderWalletAddress,
			req,
			clientKey,
			clientPrivate
		);

		console.log('accessToken incoming payment', accessToken);

		const paymentPayload = {
			walletAddress: senderWalletAddress,
			incomingAmount: {
				value: '10',
				assetCode: 'USD',
				assetScale: 6,
			},
			expiresAt: expirationDate,
			metadata: { description: 'Test!' },
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

		console.log(
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

		return data?.id?.split('/')?.pop();
	} catch (error) {
		console.error('Error creating incoming payment:', error?.message);
		//throw error;
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

		const { data } = await axios.post(process.env.SENDER_HOST, grantPayload, {
			headers: convertKeysToLowerCase(headers),
		});

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

		console.log('accessToken quote', accessToken);

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

		const { data } = await axios.request(options);
		console.log('Quote Created:', data);
		return extractIdFromUrl(data?.id);
	} catch (error) {
		console.error('Error creating quote:', error);
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
			client: clientWalletAddress,
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

		const { data } = await axios.post(process.env.SENDER_HOST, grantPayload, {
			headers: convertKeysToLowerCase(headers),
		});

		return data?.access_token?.value;
	} catch (error) {
		console.error('Error obtaining grant for outgoing payment:', error);
		throw error;
	}
};

export const createOutgoingPayment = async (
	senderWalletAddress,
	quoteId,
	req,
	clientKey,
	clientPrivate,
	quoteDebitAmount,
	quoteReceiveAmount
) => {
	try {
		const accessToken = await getGrantForOutgoingPayment(
			senderWalletAddress,
			senderWalletAddress,
			quoteDebitAmount,
			quoteReceiveAmount,
			req,
			clientKey,
			clientPrivate
		);

		console.log('accessToken outgoing', accessToken);

		// const options = {
		// 	method: 'POST',
		// 	url: `${process.env.SENDER_HOST}/outgoing-payments`,
		// 	headers: {
		// 		Authorization: `GNAP ${accessToken}`,
		// 		'Content-Type': 'application/json',
		// 	},
		// 	data: {
		// 		walletAddress: senderWalletAddress,
		// 		quoteId: `${senderWalletAddress}/quotes/${quoteId}`,
		// 		metadata: { description: 'Free Money!' },
		// 	},
		// };

		// const { data } = await axios.request(options);
		// console.log('Outgoing Payment Created:', data);
		// return data;
	} catch (error) {
		console.error('Error creating outgoing payment:', error);
		throw error;
	}
};

async function fetchRafikiDataInteraction() {
	const url =
		'https://dev.rafiki-auth.walletguru.co/interact/4454f141-ad39-4030-8e85-5bd7a843d31d/E5F5C20D60B65E1D?clientName=daniel4+gomez4&clientUri=https%3A%2F%2Fdev.walletguru.me%2Fd4gscrum';

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Error: ${response.status} - ${response.statusText}`);
		}

		const data = await response.json();
		console.log('Data fetched successfully:', data);
		return data;
	} catch (error) {
		console.error('Error fetching data:', error);
		throw error;
	}
}

export const unifiedProcess = async (
	receiverWalletAddress,
	receiverAssetCode,
	receiverAssetScale,
	senderWalletAddress,
	quoteDebitAmount,
	quoteReceiveAmount,
	expirationDate,
	req,
	clientKey,
	clientPrivate
) => {
	try {
		// 1. Crear Incoming Payment
		const incomingPayment = await createIncomingPayment(
			senderWalletAddress,
			receiverWalletAddress,
			receiverAssetCode,
			receiverAssetScale,
			expirationDate,
			req,
			clientKey,
			clientPrivate
		);
		console.log('Incoming Payment:', incomingPayment);

		// 2. Crear Quote
		const quote = await createQuote(
			senderWalletAddress,
			incomingPayment,
			req,
			clientKey,
			clientPrivate
		);
		console.log('Quote:', quote);

		// 3. Crear Outgoing Payment
		const outgoingPayment = await createOutgoingPayment(
			senderWalletAddress,
			quote,
			req,
			clientKey,
			clientPrivate,
			quoteDebitAmount,
			quoteReceiveAmount
		);
		console.log('Outgoing Payment:', outgoingPayment);

		// Retornar el resultado final
		return {
			incomingPayment,
			// quote,
			// outgoingPayment,
		};
	} catch (error) {
		console.error('Error in unified process:', error);
		throw error;
	}
};
