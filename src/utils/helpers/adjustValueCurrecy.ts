const currencyScales = {
	JPY: 0,
	MXN: 2,
	EUR: 2,
	USD: 2,
};

export function adjustValueByCurrency(num, code) {
	const scale = currencyScales[code] || 0;
	return num * Math.pow(10, scale);
}
