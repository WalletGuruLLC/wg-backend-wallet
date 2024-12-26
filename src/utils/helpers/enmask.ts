export function enmaskAttribute(value) {
	return value.replace(/.(?=.{4})/g, '*');
}
