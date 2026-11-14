import { ZodDate } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import {
	lowerBound,
	resolveRange,
	upperBound,
} from '@/transformer/utils/bounds';

// The range of valid JavaScript dates, in milliseconds since the epoch.
const MAX_TIMESTAMP = 8.64e15;

export const DateGenerator = Generator({
	schema: ZodDate,
	output: ({ def, transform }) => {
		const checks = transform.utils.checks(def.checks);

		const lower = lowerBound(checks.findAll('min'));
		const upper = upperBound(checks.findAll('max'));
		const range = resolveRange(
			lower?.value,
			upper?.value,
			transform.defaults.date,
		);

		const min = Math.max(range.min, -MAX_TIMESTAMP);
		const max = Math.min(range.max, MAX_TIMESTAMP);

		if (min > max) {
			throw new Error(
				`Unable to generate a date: min ${new Date(
					range.min,
				).toISOString()} is after max ${new Date(range.max).toISOString()}.`,
			);
		}

		return new Date(transform.utils.random.int({ min, max }));
	},
});
