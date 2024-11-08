export function calcularTotalCostoWalletGuru(
	base,
	comision,
	costo,
	porcentaje,
	escala = 2
) {
	const serviceProviderCost = costo * (porcentaje / 100) + comision + base;
	const multiplicador = Math.pow(10, escala);
	return Math.round(serviceProviderCost * multiplicador) / multiplicador;
}
