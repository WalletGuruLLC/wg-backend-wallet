import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';
import fetch from 'node-fetch';
import url from 'url';

interface Request {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: any;
}

interface SignatureHeaders {
	[key: string]: string;
}

export const resolveTemplateVariables = (
	string: string,
	vars: Record<string, string> = process.env
): string => {
	const VARIABLE_NAME_REGEX = /{{([A-Za-z]\w+)}}/g;
	return string.replace(VARIABLE_NAME_REGEX, (_, key) => vars[key] || '');
};

export const sanitizeUrl = (req: Request): string => {
	const sanitizedUrl = resolveTemplateVariables(req.url);

	try {
		new URL(sanitizedUrl);
	} catch (error) {
		console.error('Invalid URL format:', sanitizedUrl);
		throw new Error('Invalid URL format');
	}

	return sanitizedUrl;
};

export const sanitizeBody = (req: Request): any | undefined => {
	let requestBody = req.body;

	if (!(req.method === 'POST' && requestBody)) return undefined;

	if (typeof requestBody === 'object') {
		requestBody = JSON.stringify(requestBody);
	}

	return JSON.parse(resolveTemplateVariables(requestBody));
};

export const sanitizeHeaders = (req: Request): Record<string, string> => {
	return JSON.parse(resolveTemplateVariables(JSON.stringify(req.headers)));
};

export const requestSigHeaders = async (
	url: string,
	method: string,
	headers: Record<string, string>,
	body: any
): Promise<SignatureHeaders> => {
	const response = await fetch(process.env.SIGNATURE_URL as string, {
		method: 'post',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			keyId: process.env.CLIENT_KEY_ID,
			base64Key: process.env.CLIENT_PRIVATE_KEY,
			request: {
				url,
				method,
				headers,
				body: JSON.stringify(body),
			},
		}),
	});

	return await response.json();
};

export const setHeaders = (req: Request, headers: SignatureHeaders): void => {
	for (const [key, value] of Object.entries(headers)) {
		req.headers[key] = value;
	}
};

export const addSignatureHeaders = async (req: Request): Promise<void> => {
	try {
		const sanitizedUrl = sanitizeUrl(req);
		const headers = sanitizeHeaders(req);
		const body = sanitizeBody(req);

		req.body = body;

		const signatureHeaders = await requestSigHeaders(
			sanitizedUrl,
			req.method,
			headers,
			body
		);
		setHeaders(req, signatureHeaders);
	} catch (error) {
		console.error('Error adding signature headers:', error);
		throw new Error('Failed to add signature headers');
	}
};

export const generateAuthApiSignature = (body: any): string => {
	const version = process.env.AUTH_API_SIGNATURE_VERSION as string;
	const secret = process.env.AUTH_API_SIGNATURE_SECRET as string;
	const timestamp = Math.round(Date.now() / 1000);
	const payload = `${timestamp}.${canonicalize(body)}`;
	const hmac = createHmac('sha256', secret);
	hmac.update(payload);
	const digest = hmac.digest('hex');

	return `t=${timestamp}, v=${version}=${digest}`;
};

export const generateBackendApiSignature = (body: any): string => {
	const version = process.env.BACKEND_API_SIGNATURE_VERSION as string;
	const secret = process.env.BACKEND_API_SIGNATURE_SECRET as string;
	const timestamp = Math.round(Date.now() / 1000);
	const payload = `${timestamp}.${canonicalize(body)}`;
	const hmac = createHmac('sha256', secret);
	hmac.update(payload);
	const digest = hmac.digest('hex');

	return `t=${timestamp}, v=${version}=${digest}`;
};

export async function addApiSignatureHeader(
	req: Request,
	body: any
): Promise<void> {
	const formattedBody = { ...body };
	if (body?.variables) {
		formattedBody.variables = JSON.parse(body?.variables);
	}
	const signature = generateBackendApiSignature(formattedBody);
	req.headers['signature'] = signature;
}

export async function addHostHeader(
	req: any,
	hostVarName?: string
): Promise<void> {
	const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
	const requestUrl = new URL(fullUrl);
	//const requestUrl = url.parse(fullUrl);

	if (hostVarName) {
		const hostVarValue = `${requestUrl.protocol}//${requestUrl.host}`;
		process.env[hostVarName] = hostVarValue;
	}

	if (requestUrl.hostname === 'localhost') {
		const hostHeader =
			requestUrl.port === '3000' ? 'localhost:3000' : 'localhost:4000';

		if (hostHeader) {
			req.headers.host = hostHeader;
		}
	}
}
