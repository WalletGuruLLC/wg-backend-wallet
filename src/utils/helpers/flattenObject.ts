export function flattenObject(obj: any, prefix = ''): any {
	return Object.keys(obj).reduce((acc, key) => {
		const newKey = prefix ? `${prefix}.${key}` : key;
		const value = obj[key];

		if (typeof value === 'object' && value !== null) {
			Object.assign(acc, flattenObject(value, newKey));
		} else {
			acc[newKey] = value;
		}

		return acc;
	}, {});
}
