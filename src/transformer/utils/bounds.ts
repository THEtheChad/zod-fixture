/**
 * Helpers that fold a schema's bound checks into a single interval.
 *
 * Zod allows any number of `min`/`max` checks (`.min(0).min(90)`), each of
 * which may be inclusive or exclusive. The value must satisfy all of them, so
 * the tightest bound on each side wins.
 */

type Numeric = number | bigint;

export interface Bound<T extends Numeric> {
	value: T;
	inclusive: boolean;
}

interface BoundCheck<T extends Numeric> {
	value: T;
	inclusive?: boolean;
}

/** The tightest (largest) lower bound; on a tie the exclusive bound wins. */
export function lowerBound<T extends Numeric>(
	checks: BoundCheck<T>[],
): Bound<T> | undefined {
	let result: Bound<T> | undefined;
	for (const check of checks) {
		const inclusive = check.inclusive ?? true;
		if (
			!result ||
			check.value > result.value ||
			(check.value === result.value && !inclusive)
		) {
			result = { value: check.value, inclusive };
		}
	}
	return result;
}

/** The tightest (smallest) upper bound; on a tie the exclusive bound wins. */
export function upperBound<T extends Numeric>(
	checks: BoundCheck<T>[],
): Bound<T> | undefined {
	let result: Bound<T> | undefined;
	for (const check of checks) {
		const inclusive = check.inclusive ?? true;
		if (
			!result ||
			check.value < result.value ||
			(check.value === result.value && !inclusive)
		) {
			result = { value: check.value, inclusive };
		}
	}
	return result;
}

/**
 * Resolve the interval to generate in. A side the schema leaves open comes
 * from the defaults, unless that would put it on the wrong side of the
 * explicit bound; then it is placed one default-span away from that bound.
 *
 * `min(1000)` (or `gt(100)`) with defaults `[-100, 100]` resolves to one
 * default span above the bound, e.g. `[1000, 1200]`.
 */
export function resolveRange<T extends Numeric>(
	min: T | undefined,
	max: T | undefined,
	fallback: { min: T; max: T },
): { min: T; max: T } {
	// `T` is either number or bigint; the arithmetic below never mixes them.
	const span = ((fallback.max as number) - (fallback.min as number)) as T;

	if (min !== undefined && max !== undefined) return { min, max };
	if (min !== undefined) {
		return {
			min,
			max:
				// Equal counts as outside: an exclusive bound there leaves no room.
				min < fallback.max
					? fallback.max
					: (((min as number) + (span as number)) as T),
		};
	}
	if (max !== undefined) {
		return {
			min:
				max > fallback.min
					? fallback.min
					: (((max as number) - (span as number)) as T),
			max,
		};
	}
	return { min: fallback.min, max: fallback.max };
}

const view = new DataView(new ArrayBuffer(8));

/** The smallest double greater than `value`. */
export function nextUp(value: number): number {
	if (Number.isNaN(value) || value === Infinity) return value;
	if (value === 0) return Number.MIN_VALUE;
	// Adjacent doubles have adjacent bit patterns: step the integer view
	// away from zero for positive values and toward zero for negative ones.
	view.setFloat64(0, value);
	view.setBigInt64(0, view.getBigInt64(0) + (value > 0 ? 1n : -1n));
	return view.getFloat64(0);
}

/** The largest double smaller than `value`. */
export function nextDown(value: number): number {
	return -nextUp(-value);
}

/** Number of decimal places in `value`, including exponent notation. */
export function decimalPlaces(value: number): number {
	if (!Number.isFinite(value)) return 0;
	const [mantissa = '', exponent] = value.toString().split('e');
	const fraction = mantissa.split('.')[1]?.length ?? 0;
	return Math.max(0, fraction - Number(exponent ?? 0));
}

function gcd(a: number, b: number): number {
	while (b) [a, b] = [b, a % b];
	return Math.abs(a);
}

function bigGcd(a: bigint, b: bigint): bigint {
	while (b) [a, b] = [b, a % b];
	return a < 0n ? -a : a;
}

/**
 * The least common multiple of `multipleOf` steps, fractional ones included
 * (`0.2` and `0.3` combine to `0.6`). Steps are scaled to integers by their
 * decimal places; if that isn't exact, the first step is returned.
 */
export function combineMultipleOf(values: number[]): number | undefined {
	const steps = values.map(Math.abs);
	const [first] = steps;
	if (first === undefined) return undefined;
	if (steps.some((step) => step === 0)) return 0;

	const decimals = Math.max(...steps.map(decimalPlaces));
	if (decimals > 15) return first;
	const scale = 10 ** decimals;

	let lcm = 1;
	for (const step of steps) {
		const scaled = Math.round(step * scale);
		lcm = (lcm / gcd(lcm, scaled)) * scaled;
		if (!Number.isSafeInteger(lcm)) return first;
	}
	return lcm / scale;
}

export function combineBigIntMultipleOf(values: bigint[]): bigint | undefined {
	return values.reduce<bigint | undefined>((acc, value) => {
		const step = value < 0n ? -value : value;
		if (acc === undefined) return step;
		return (acc / bigGcd(acc, step)) * step;
	}, undefined);
}

/** The smallest multiple of `step` that is also an integer. */
export function integerStep(step: number): number {
	return combineMultipleOf([step, 1]) ?? step;
}

export function ceilDiv(a: bigint, b: bigint): bigint {
	const quotient = a / b;
	return quotient * b < a ? quotient + 1n : quotient;
}

export function floorDiv(a: bigint, b: bigint): bigint {
	const quotient = a / b;
	return quotient * b > a ? quotient - 1n : quotient;
}
