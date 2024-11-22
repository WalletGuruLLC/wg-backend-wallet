import { convertKeysToPascalCase } from './convertPascalCase';

export function buildFilterExpression(expressionFilter) {
	const attributeExpressionsKeys = {};
	const expressionAttributeValues: any = {};
	const expressionConvertedPascal = convertKeysToPascalCase(expressionFilter);
	let filterExpression = '';

	Object.keys(expressionConvertedPascal).forEach(expressionKey => {
		const attributeKey = `#${expressionKey.toLowerCase()}`;
		const attributeValue = `:${expressionKey.toLowerCase()}`;
		const attributeValueData = expressionConvertedPascal[expressionKey];

		if (attributeValueData !== undefined) {
			attributeExpressionsKeys[attributeKey] = expressionKey;
			expressionAttributeValues[attributeValue] = attributeValueData;

			filterExpression = !filterExpression
				? `${attributeKey} = ${attributeValue}`
				: filterExpression.concat(
						' AND ',
						`${attributeKey} = ${attributeValue}`
				  );
		}
	});

	return {
		attributeNames: attributeExpressionsKeys,
		expressionValues: expressionAttributeValues,
		filterExpression: filterExpression,
	};
}
