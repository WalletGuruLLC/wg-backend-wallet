export function generateStrongPassword(length = 16) {
	const upperCaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const lowerCaseChars = 'abcdefghijklmnopqrstuvwxyz';
	const numberChars = '0123456789';
	const specialChars = '!@#$%^&*()_+[]{}|;:,.<>?';

	const allChars = upperCaseChars + lowerCaseChars + numberChars + specialChars;

	let password = '';

	password += upperCaseChars[Math.floor(Math.random() * upperCaseChars.length)];
	password += lowerCaseChars[Math.floor(Math.random() * lowerCaseChars.length)];
	password += numberChars[Math.floor(Math.random() * numberChars.length)];
	password += specialChars[Math.floor(Math.random() * specialChars.length)];

	for (let i = 4; i < length; i++) {
		password += allChars[Math.floor(Math.random() * allChars.length)];
	}

	password = password
		.split('')
		.sort(() => 0.5 - Math.random())
		.join('');

	return password;
}
