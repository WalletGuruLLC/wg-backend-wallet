import { Month } from '../../api/wallet/dto/month.enum';

export function getDateRangeForMonthEnum(month: Month) {
	const now = new Date();

	const startDate = new Date(
		Date.UTC(now.getUTCFullYear(), month - 1, 1, 0, 0, 0, 0)
	).getTime()

	const endDate = new Date(
		Date.UTC(now.getUTCFullYear(), month, 0, 23, 59, 59, 999)
	).getTime()

	return { startDate, endDate };
}
