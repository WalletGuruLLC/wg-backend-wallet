function toPascalCase(str: string): string {
	return str.replace(/(^\w|_\w|\s\w)/g, match =>
		match.toUpperCase().replace(/_| /g, '')
	);
}

export function convertKeysToPascalCase(obj: any): any {
	if (Array.isArray(obj)) {
		return obj.map(item => convertKeysToPascalCase(item));
	} else if (obj !== null && typeof obj === 'object') {
		return Object.keys(obj).reduce((acc, key) => {
			const pascalCaseKey = toPascalCase(key);
			acc[pascalCaseKey] = convertKeysToPascalCase(obj[key]);
			return acc;
		}, {} as any);
	}
	return obj;
}
