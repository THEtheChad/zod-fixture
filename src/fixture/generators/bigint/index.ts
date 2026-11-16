import type { ZodBigIntCheck } from 'zod';
import { ZodBigInt } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import {
	ceilDiv,
	combineBigIntMultipleOf,
	floorDiv,
	lowerBound,
	resolveRange,
	upperBound,
} from '@/transformer/utils/bounds';

/** Fold every min/max check into an inclusive `[min, max]` range. */
function bigIntRange(
	checks: ZodBigIntCheck[],
	fallback: { min: bigint; max: bigint },
) {
	const lower = lowerBound(
		checks.flatMap((check) => (check.kind === 'min' ? [check] : [])),
	);
	const upper = upperBound(
		checks.flatMap((check) => (check.kind === 'max' ? [check] : [])),
	);
	const range = resolveRange(lower?.value, upper?.value, fallback);

	const min = lower && !lower.inclusive ? range.min + 1n : range.min;
	const max = upper && !upper.inclusive ? range.max - 1n : range.max;
	const describe = () =>
		`${lower?.inclusive === false ? '(' : '['}${range.min}, ${range.max}${
			upper?.inclusive === false ? ')' : ']'
		}`;

	if (min > max) {
		throw new Error(`Unable to generate a bigint: no value in ${describe()}.`);
	}

	return { min, max, describe, lower, upper };
}

export const BigIntGenerator = Generator({
	schema: ZodBigInt,
	filter: ({ def, transform }) =>
		!transform.utils.checks(def.checks).has('multipleOf'),
	output: ({ def, transform }) => {
		const { min, max } = bigIntRange(def.checks, transform.defaults.bigint);

		return transform.utils.random.bigInt({ min, max });
	},
});

export const BigIntMultipleOfGenerator = Generator({
	schema: ZodBigInt,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('multipleOf'),
	output: ({ def, transform }) => {
		const { min, max, describe, lower, upper } = bigIntRange(
			def.checks,
			transform.defaults.bigint,
		);
		const step = combineBigIntMultipleOf(
			def.checks.flatMap((check) =>
				check.kind === 'multipleOf' ? [check.value] : [],
			),
		);

		if (step === undefined || step === 0n) {
			return transform.utils.random.bigInt({ min, max });
		}

		let kMin = ceilDiv(min, step);
		let kMax = floorDiv(max, step);

		// A side the schema leaves open can move to the nearest multiple.
		if (kMin > kMax && !upper) kMax = kMin;
		if (kMin > kMax && !lower) kMin = kMax;

		if (kMin > kMax) {
			throw new Error(
				`Unable to generate a bigint: no multiple of ${step} in ${describe()}.`,
			);
		}

		return transform.utils.random.bigInt({ min: kMin, max: kMax }) * step;
	},
});
