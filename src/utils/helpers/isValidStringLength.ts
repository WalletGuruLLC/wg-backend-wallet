export function isValidStringLength(input: string): boolean {
	const length = input?.length;
	return length >= 3 && length <= 20;
}
