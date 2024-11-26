export function buscarValorPorClave(objeto, claveBuscada) {
	if (objeto[claveBuscada]) {
		return objeto[claveBuscada];
	}
	return null;
}
