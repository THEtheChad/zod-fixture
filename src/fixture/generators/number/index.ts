import { ZodNumber } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import {
	combineMultipleOf,
	decimalPlaces,
	integerStep,
	lowerBound,
	nextDown,
	nextUp,
	resolveRange,
	upperBound,
} from '@/transformer/utils/bounds';

export const NumberGenerator = Generator({
	schema: ZodNumber,
	output: ({ schema, def, transform }) => {
		const checks = transform.utils.checks(def.checks);
		const isInt = checks.has('int');
		const isFinite = checks.has('finite');

		const lower = lowerBound(checks.findAll('min'));
		const upper = upperBound(checks.findAll('max'));
		const range = resolveRange(
			lower?.value,
			upper?.value,
			transform.defaults.float,
		);

		let min = range.min;
		let max = range.max;
		if (isInt) {
			min = lower && !lower.inclusive ? Math.floor(min) + 1 : Math.ceil(min);
			max = upper && !upper.inclusive ? Math.ceil(max) - 1 : Math.floor(max);
		} else {
			if (lower && !lower.inclusive) min = nextUp(min);
			if (upper && !upper.inclusive) max = nextDown(max);
		}

		const describe = () =>
			`${lower?.inclusive === false ? '(' : '['}${range.min}, ${range.max}${
				upper?.inclusive === false ? ')' : ']'
			}`;

		const steps = checks.findAll('multipleOf').map((check) => check.value);
		const multipleOf = combineMultipleOf(steps);
		if (multipleOf === 0) {
			throw new Error(
				'Unable to generate a number: multipleOf(0) never matches.',
			);
		}

		// Generate within the finite doubles; ±Infinity bounds don't change that.
		min = Math.max(min, -Number.MAX_VALUE);
		max = Math.min(max, Number.MAX_VALUE);

		let result: number;
		if (multipleOf !== undefined) {
			const step = isInt ? integerStep(multipleOf) : multipleOf;
			const decimals = Math.min(decimalPlaces(step), 100);
			const at = (k: number) =>
				decimals > 0 ? Number((k * step).toFixed(decimals)) : k * step;

			// Zod checks multiples on the value's shortest decimal form. For that
			// to land exactly on a multiple, the gap between adjacent doubles must
			// stay well below the step's last decimal place; integers are exact up
			// to MAX_SAFE_INTEGER.
			// Zod checks each step separately, using that step's decimal places.
			const checkDecimals = Math.min(
				Math.max(...steps.map(decimalPlaces)),
				100,
			);
			const maxMagnitude =
				checkDecimals > 0
					? 2 ** 50 / 10 ** checkDecimals
					: Number.MAX_SAFE_INTEGER;
			const kLimit = Math.floor(maxMagnitude / step);
			const clamp = (k: number) => Math.min(Math.max(k, -kLimit), kLimit);

			// Division can be off by a little in floating point: correct both
			// ways, a bounded number of times.
			let kMin = clamp(Math.ceil(min / step));
			let kMax = clamp(Math.floor(max / step));
			for (let i = 0; i < 4; i++) {
				if (kMin > -kLimit && at(kMin - 1) >= min) kMin--;
				else if (at(kMin) < min) kMin++;
				if (kMax < kLimit && at(kMax + 1) <= max) kMax++;
				else if (at(kMax) > max) kMax--;
			}

			// A side the schema leaves open can move to the nearest multiple.
			if (kMin > kMax && !upper) kMax = kMin;
			if (kMin > kMax && !lower) kMin = kMax;

			if (
				kMin > kMax ||
				(lower && at(kMin) < min) ||
				(upper && at(kMax) > max)
			) {
				throw new Error(
					`Unable to generate a number: no ${
						isInt ? 'integer ' : ''
					}multiple of ${step} in ${describe()}.`,
				);
			}

			const pick = () =>
				at(transform.utils.random.int({ min: kMin, max: kMax }));
			result = pick();
			if (!schema.safeParse(result).success) {
				result = acceptedMultiple(
					(value) => schema.safeParse(value).success,
					pick,
					at,
					kMin,
					kMax,
					() =>
						`Unable to generate a number: Zod's ${steps
							.map((value) => `multipleOf(${value})`)
							.join(' and ')} check rejects every ${
							isInt ? 'integer' : 'multiple'
						} in ${describe()}. Zod 3 counts decimal places from a number's string form, so a step below 1e-6 (like 1e-7) only matches values of at least 1e-6 whose last decimal isn't 0.`,
				);
			}
		} else {
			if (min > max) {
				throw new Error(
					`Unable to generate a number: no ${
						isInt ? 'integer ' : 'value '
					}in ${describe()}.`,
				);
			}

			result = isInt
				? transform.utils.random.int({ min, max })
				: Math.min(transform.utils.random.float({ min, max }), max);
		}

		if (isFinite) {
			if (result === Infinity) {
				result = Number.MAX_VALUE;
			} else if (result === -Infinity) {
				result = -Number.MAX_VALUE;
			}
		}

		return result;
	},
});

/** Random multiples to try after Zod rejects the first one. */
const RETRIES = 20;
/** Multiples to check one by one, from the lowest, after that. */
const SCAN = 1000;

/**
 * A multiple that Zod's `multipleOf` check accepts. Zod 3 counts decimal
 * places from a number's string form, and steps below 1e-6 print in
 * exponent form (`"1e-7"`), so it rejects some exact multiples:
 * `multipleOf(1e-7)` rejects `0.5`, `3` and `3e-7`.
 */
function acceptedMultiple(
	accepts: (value: number) => boolean,
	pick: () => number,
	at: (k: number) => number,
	kMin: number,
	kMax: number,
	error: () => string,
): number {
	for (let i = 0; i < RETRIES; i++) {
		const value = pick();
		if (accepts(value)) return value;
	}
	for (let k = kMin; k <= Math.min(kMax, kMin + SCAN); k++) {
		const value = at(k);
		if (accepts(value)) return value;
	}
	throw new Error(error());
}
