export const requestHelper = {
	requestSigHeaders: async function (
		url,
		keyId,
		privateKey,
		method,
		headers,
		body
	) {
		try {
			const response = await fetch(process.env.SIGNATURE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					keyId: keyId,
					base64Key: privateKey,
					request: {
						url,
						method,
						headers,
						body: JSON.stringify(body),
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`Error al obtener firma: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			console.error('Error en requestSigHeaders:', error);
			throw error;
		}
	},

	setHeaders: function (req, headers) {
		for (const [key, value] of Object.entries(headers)) {
			req.setHeader(key, value);
		}
	},

	addSignatureHeaders: async function (req) {
		try {
			const url = this.sanitizeUrl(req.getUrl());
			const headers = this.sanitizeHeaders(req.getHeaders());
			const body = this.sanitizeBody(req.getBody());

			req.setBody(body);

			const signatureHeaders = await this.requestSigHeaders(
				url,
				req.getMethod(),
				headers,
				body
			);

			this.setHeaders(req, signatureHeaders);
		} catch (error) {
			console.error('Error en addSignatureHeaders:', error);
			throw error;
		}
	},

	sanitizeUrl: function (url) {
		return url?.trim();
	},

	sanitizeHeaders: function (headers) {
		return headers || {};
	},

	sanitizeBody: function (body) {
		return body || {};
	},
};
