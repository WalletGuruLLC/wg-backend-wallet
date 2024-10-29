export function calcularTotalCosto(base, comision, costo, porcentaje) {
	const serviceProviderCost = costo * (porcentaje / 100) + comision + base;
	const value = costo - serviceProviderCost;
	return Math.round(value * 100) / 100;
}
