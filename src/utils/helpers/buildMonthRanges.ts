import { Month } from '../../api/wallet/dto/month.enum';

export function getDateRangeForMonthEnum(month: Month) {
	const now = new Date();

	const startDate = Date.UTC(now.getUTCFullYear(), month - 1, 1, 0, 0, 0, 0);

	const endDate = Date.UTC(now.getUTCFullYear(), month, 0, 23, 59, 59, 999);

	return { startDate, endDate };
}
