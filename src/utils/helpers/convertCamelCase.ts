function toCamelCase(str) {
	return str
		.replace(/([-_][a-zA-Z])/g, group =>
			group.toUpperCase().replace('-', '').replace('_', '')
		)
		.replace(/^[A-Z]/, firstLetter => firstLetter.toLowerCase());
}

export function convertToCamelCase(input) {
	if (typeof input !== 'object' || input === null) {
		return input;
	}

	if (Array.isArray(input)) {
		return input.map(item => convertToCamelCase(item));
	}

	return Object.keys(input).reduce((result, key) => {
		const camelCaseKey = toCamelCase(key);
		result[camelCaseKey] = convertToCamelCase(input[key]);
		return result;
	}, {});
}
