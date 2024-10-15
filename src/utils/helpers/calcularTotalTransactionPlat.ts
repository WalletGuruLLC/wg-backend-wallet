export function calcularTotalCosto(base, comision, costo, porcentaje) {
	const serviceProviderCost = costo * (porcentaje / 100) + comision + base;
	return costo - serviceProviderCost;
}
