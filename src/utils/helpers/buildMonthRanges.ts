import { Month } from '../../api/wallet/dto/month.enum';

export function getDateRangeForMonthEnum(month: Month) {
	const currentYear = new Date().getFullYear();

	const startDateMonth = month <= 12 ? month - 1 : month;

	const startDate = new Date(currentYear, startDateMonth, 1).getTime();

	const endDateMonth = month < 11 ? month + 1 : month;

	const endDate = new Date(currentYear, endDateMonth, 0).getTime();

	return { startDate, endDate };
}
