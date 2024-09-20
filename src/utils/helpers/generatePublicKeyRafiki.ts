import { generateKeyPairSync } from 'crypto';

export function generatePaisRafiki() {
	const generatedPairs = generateKeyPairSync('ed25519');
	return generatedPairs;
}

export async function generatePublicKeyRafiki() {
	const pairs = await generatePaisRafiki();

	const publicKey = pairs.publicKey;
	const privateKey = pairs.privateKey;

	const publicKeyPEM = publicKey
		.export({ type: 'spki', format: 'pem' })
		.toString();
	const privateKeyPEM = privateKey
		.export({ type: 'pkcs8', format: 'pem' })
		.toString();

	return {
		publicKey,
		privateKey,
		publicKeyPEM,
		privateKeyPEM,
	};
}
