export function calcularTotalCosto(base, comision, costo, porcentaje, escala) {
	const serviceProviderCost = costo * (porcentaje / 100) + comision + base;
	const value = costo - serviceProviderCost;
	const multiplicador = Math.pow(10, escala);
	return Math.round(value * multiplicador) / multiplicador;
}
