import fetch from 'node-fetch';

export const toBase64 = input => {
	const buffer = Buffer.from(input, 'utf-8');
	return buffer.toString('base64');
};

export const sanitizeBody = req => {
	let requestBody = req.body;
	if (!(req.method === 'POST' && requestBody)) return undefined;
	if (typeof requestBody === 'object') {
		requestBody = JSON.stringify(requestBody);
	}
	return JSON.stringify(requestBody);
};
export const requestSigHeaders = async (
	url,
	method,
	headers,
	body,
	clientKey,
	clientPrivate
) => {
	try {
		const response = await fetch(process.env.SIGNATURE_URL, {
			method: 'post',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				keyId: clientKey,
				base64Key: clientPrivate,
				request: {
					url,
					method,
					headers,
					body: JSON.stringify(body),
				},
			}),
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(
				`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${errorData}`
			);
		}

		const valueResponse = await response.json();
		console.log('valueResponse', valueResponse);

		return valueResponse;
	} catch (error) {
		if (error instanceof Error) {
			console.log('Error signature:', error.message);
		} else {
			console.log('Error signature:', error);
		}
	}
};

export const setHeaders = (req, headers) => {
	for (const [key, value] of Object.entries(headers)) {
		req.setHeader(key, value);
	}
};

export const addSignatureHeaders = async (req, clientKey, clientPrivate) => {
	const urlValue = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
	const headers = req.headers;
	const signatureHeaders = await requestSigHeaders(
		urlValue,
		req.method,
		headers,
		req.body,
		clientKey,
		clientPrivate
	);
	return signatureHeaders;
};
