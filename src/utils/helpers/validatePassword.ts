export function validatePassword(password) {
	const minLength = 8;
	const maxLength = 12;
	const error = 'Password does not meet the required criteria';

	if (password.length < minLength || password.length > maxLength) {
		console.error(error);
		return false;
	}
	if (!/[a-z]/.test(password)) {
		console.error(error);
		return false;
	}
	if (!/[A-Z]/.test(password)) {
		console.error(error);
		return false;
	}
	if (!/\d/.test(password)) {
		console.error(error);
		return false;
	}
	if (!/[ !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/.test(password)) {
		console.error(error);
		return false;
	}

	return true;
}
