export function calcularTotalCosto(base, comision, costo, porcentaje, escala) {
	const value = costo;
	const multiplicador = Math.pow(10, escala);
	return Math.round(value * multiplicador) / multiplicador;
}
