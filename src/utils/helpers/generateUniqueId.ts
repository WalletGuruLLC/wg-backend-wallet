export function generateUniqueId(userType) {
	const datePart = new Date()
		.toLocaleDateString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
		.replace(/\//g, '');

	const randomPart = Math.floor(10000000 + Math.random() * 89999999).toString();

	let typePart = '';
	switch (userType) {
		case 'WALLET':
			typePart = 'WU';
			break;
		case 'PROVIDER':
			typePart = 'SP';
			break;
		case 'PLATFORM':
			typePart = 'WG';
			break;
		default:
			throw new Error('Invalid user type');
	}

	const uniqueId = `${datePart}${randomPart}${typePart}`;

	return uniqueId;
}
