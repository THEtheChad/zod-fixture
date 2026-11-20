import RandExp from 'randexp';

/**
 * Generate regex matches of a chosen length.
 *
 * RandExp picks every quantifier's count on its own, so the length of its
 * output is a sum of independent random numbers: an exact length is rarely
 * hit. Here, the lengths each part of the pattern can produce are worked out
 * first, then a length is chosen and shared between the parts so they add
 * up to it. Characters still come from RandExp, so they stay seeded.
 */

/** Token types of `ret`, the regex parser RandExp uses (`ret`'s `types`). */
export const TokenType = {
	ROOT: 0,
	GROUP: 1,
	POSITION: 2,
	SET: 3,
	RANGE: 4,
	REPETITION: 5,
	REFERENCE: 6,
	CHAR: 7,
} as const;

/** The parts of `ret`'s tokens that length planning reads. */
export interface Token {
	type: number;
	stack?: Token[];
	options?: Token[][];
	followedBy?: boolean;
	notFollowedBy?: boolean;
	min?: number;
	max?: number;
	value?: unknown;
}

/** Sorted, disjoint, non-adjacent integer intervals `[from, to]`. */
type Lengths = [number, number][];

const NONE: Lengths = [];
const ZERO: Lengths = [[0, 0]];

function normalize(intervals: Lengths): Lengths {
	const sorted = intervals
		.filter(([from, to]) => from <= to)
		.sort((a, b) => a[0] - b[0]);
	const result: Lengths = [];
	for (const [from, to] of sorted) {
		const last = result[result.length - 1];
		if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
		else result.push([from, to]);
	}
	return result;
}

/** Every `a + b`, dropping sums above `limit`. */
function add(a: Lengths, b: Lengths, limit: number): Lengths {
	const sums: Lengths = [];
	for (const [aFrom, aTo] of a) {
		for (const [bFrom, bTo] of b) {
			if (aFrom + bFrom <= limit) {
				sums.push([aFrom + bFrom, Math.min(aTo + bTo, limit)]);
			}
		}
	}
	return normalize(sums);
}

function intersect(a: Lengths, b: Lengths): Lengths {
	const result: Lengths = [];
	for (const [aFrom, aTo] of a) {
		for (const [bFrom, bTo] of b) {
			const from = Math.max(aFrom, bFrom);
			const to = Math.min(aTo, bTo);
			if (from <= to) result.push([from, to]);
		}
	}
	return normalize(result);
}

/** Every `total - x` for `x` in `lengths`, keeping the non-negative ones. */
function remainders(lengths: Lengths, total: number): Lengths {
	return normalize(
		lengths.map(([from, to]) => [Math.max(0, total - to), total - from]),
	);
}

function contains(lengths: Lengths, length: number): boolean {
	return lengths.some(([from, to]) => from <= length && length <= to);
}

function equal(a: Lengths, b: Lengths): boolean {
	return (
		a.length === b.length &&
		a.every(([from, to], i) => from === b[i]?.[0] && to === b[i]?.[1])
	);
}

function isLookaround(token: Token): boolean {
	return (
		token.type === TokenType.GROUP &&
		!!(token.followedBy || token.notFollowedBy)
	);
}

/**
 * How much interval work planning one pattern may do. Patterns whose
 * lengths are sparse (like `(aa|bbbb)*`) need ever more intervals as the
 * limit grows; past this budget they're left to sampling.
 */
export const PLANNING_BUDGET = 200_000;

class Budget {
	private spent = 0;

	spend(amount: number) {
		this.spent += amount;
		if (this.spent > PLANNING_BUDGET) {
			throw new UnplannablePattern(
				'Planning the lengths of this pattern needs too much work.',
			);
		}
	}
}

/** The lengths a repetition can produce, by number of repeats. */
class Repeats {
	private memo: Lengths[] = [ZERO];
	/** Past this count, more repeats produce no new lengths. */
	last = Infinity;

	constructor(
		private item: Lengths,
		private limit: number,
		private budget: Budget,
	) {}

	/** The lengths of exactly `count` repeats. */
	at(count: number): Lengths {
		if (count > this.last) return this.at(this.last);
		const single = this.item.length === 1 ? this.item[0] : undefined;
		if (single) {
			// One interval repeated stays one interval.
			const [from, to] = single;
			return count * from > this.limit
				? NONE
				: [[count * from, Math.min(count * to, this.limit)]];
		}
		while (this.memo.length <= count) {
			const previous = this.memo[this.memo.length - 1] as Lengths;
			this.budget.spend(previous.length * this.item.length);
			const next = add(previous, this.item, this.limit);
			// Once repeats can be empty, the lengths only grow; stop when they
			// stop changing.
			if (contains(this.item, 0) && equal(next, previous)) {
				this.last = this.memo.length - 1;
				return this.at(Math.min(count, this.last));
			}
			this.memo.push(next);
		}
		return this.memo[count] as Lengths;
	}

	/**
	 * The highest count worth trying for lengths up to `length` (the limit by
	 * default), given `min` to `max` repeats.
	 */
	maxUseful(min: number, max: number, length = this.limit): number {
		// An item with no length within the limit can only repeat zero times.
		if (!this.item.length) return 0;
		const [from, to] = this.item[0] as [number, number];
		if (from > 0) return Math.min(max, Math.floor(length / from));
		// Some repeats can be empty, so the count isn't bounded by the
		// lengths: enough of the shortest non-empty repeats to reach the length
		// will do, and empty repeats make up the required minimum.
		const shortestNonEmpty = to > 0 ? 1 : this.item[1]?.[0];
		if (shortestNonEmpty === undefined) return Math.min(max, min);
		return Math.min(max, Math.max(min, Math.ceil(length / shortestNonEmpty)));
	}

	/** The lengths of `min` to `max` repeats. */
	union(min: number, max: number): Lengths {
		if (min > max) return NONE;
		const single = this.item.length === 1 ? this.item[0] : undefined;
		if (single) {
			const [from, to] = single;
			// `count` repeats of `[from, to]` give `[count * from, count * to]`.
			// Those intervals touch once `count * (to - from) >= from - 1`, so
			// only the counts before that need their own interval.
			const merged =
				to === from
					? from <= 1
						? min
						: Infinity
					: Math.max(min, Math.ceil((from - 1) / (to - from)));
			const all: Lengths = [];
			for (let count = min; count < Math.min(merged, max + 1); count++) {
				this.budget.spend(1);
				all.push([count * from, Math.min(count * to, this.limit)]);
			}
			if (merged <= max) {
				all.push([merged * from, Math.min(max * to, this.limit)]);
			}
			return normalize(all);
		}
		const all: Lengths = [];
		for (let count = min; count <= max; count++) {
			const lengths = this.at(count);
			if (!lengths.length && count > 0) break;
			this.budget.spend(lengths.length);
			all.push(...lengths);
			// More repeats add no new lengths.
			if (count >= this.last) break;
		}
		return normalize(all);
	}

	/** The lowest count that can reach `length`, given at least `min`. */
	minUseful(min: number, length: number): number {
		const longest = this.item[this.item.length - 1]?.[1] ?? 0;
		return longest > 0 ? Math.max(min, Math.ceil(length / longest)) : min;
	}
}

/**
 * Plans the lengths of one pattern's matches up to a limit, and generates
 * matches of a chosen length. The plan doesn't depend on randomness, so one
 * planner serves every seed; generation takes the seeded RandExp to use.
 */
export class LengthPlanner {
	private tokenLengths = new Map<Token, Lengths>();
	private suffixes = new Map<Token[], Lengths[]>();
	private repeats = new Map<Token, Repeats>();
	private budget = new Budget();
	/** RandExp's parse of the pattern; the plan is keyed by its tokens. */
	private parsed: RandExp;
	private root: Token;

	/** Throws `UnplannablePattern` when the pattern can't be planned. */
	constructor(
		pattern: RegExp,
		private limit: number,
	) {
		this.parsed = new RandExp(pattern);
		this.root = (this.parsed as unknown as { tokens: Token }).tokens;
		// The plan reads RandExp's internal parse; anything unexpected there
		// leaves the pattern to sampling rather than failing.
		if (this.root?.type !== TokenType.ROOT) {
			throw new UnplannablePattern('Unexpected RandExp tokens.');
		}
		this.lengths(this.root);
	}

	/** The lengths `token` can produce, up to the limit. */
	lengths(token: Token): Lengths {
		let result = this.tokenLengths.get(token);
		if (!result) {
			result = this.compute(token);
			this.tokenLengths.set(token, result);
		}
		return result;
	}

	private compute(token: Token): Lengths {
		switch (token.type) {
			case TokenType.ROOT:
			case TokenType.GROUP: {
				// RandExp generates nothing for lookarounds.
				if (isLookaround(token)) return ZERO;
				if (token.options) {
					return normalize(
						token.options.flatMap((option) => this.sequence(option)),
					);
				}
				return this.sequence(token.stack ?? []);
			}
			case TokenType.POSITION:
				return ZERO;
			case TokenType.SET:
				// A set that matches no character, like `[^\s\S]`, produces nothing.
				return this.parsed._expand(token as never).length ? [[1, 1]] : NONE;
			case TokenType.CHAR:
				return [[1, 1]];
			case TokenType.REPETITION: {
				const repeats = this.repeatsOf(token);
				const min = token.min ?? 0;
				return repeats.union(
					min,
					repeats.maxUseful(min, token.max ?? Infinity),
				);
			}
			case TokenType.REFERENCE:
				throw new UnplannablePattern(
					'Back-references depend on what a group generated earlier.',
				);
			default:
				throw new UnplannablePattern(`Unexpected token type ${token.type}.`);
		}
	}

	private repeatsOf(token: Token): Repeats {
		let repeats = this.repeats.get(token);
		if (!repeats) {
			repeats = new Repeats(
				this.lengths(token.value as Token),
				this.limit,
				this.budget,
			);
			this.repeats.set(token, repeats);
		}
		return repeats;
	}

	/** The lengths of `stack[i..]`, for every `i`. */
	private suffixLengths(stack: Token[]): Lengths[] {
		let suffixes = this.suffixes.get(stack);
		if (!suffixes) {
			suffixes = [];
			suffixes[stack.length] = ZERO;
			for (let i = stack.length - 1; i >= 0; i--) {
				const token = this.lengths(stack[i] as Token);
				const rest = suffixes[i + 1] as Lengths;
				this.budget.spend(token.length * rest.length);
				suffixes[i] = add(token, rest, this.limit);
			}
			this.suffixes.set(stack, suffixes);
		}
		return suffixes;
	}

	private sequence(stack: Token[]): Lengths {
		return this.suffixLengths(stack)[0] as Lengths;
	}

	/** A random length from `lengths`; every length is equally likely. */
	private pick(random: RandExp, lengths: Lengths): number {
		const total = lengths.reduce((sum, [from, to]) => sum + to - from + 1, 0);
		let index = random.randInt(0, total - 1);
		for (const [from, to] of lengths) {
			const size = to - from + 1;
			if (index < size) return from + index;
			index -= size;
		}
		// Planning guarantees a choice; if it ever doesn't, sample instead.
		throw new UnplannablePattern('No length to pick.');
	}

	/**
	 * A string generated from the pattern with a length in `[min, max]`
	 * (`max` at most the planner's limit), or `undefined` when the pattern
	 * produces no such length. `random` is a RandExp of the same pattern:
	 * it picks the lengths and characters.
	 */
	generateBetween(
		min: number,
		max: number,
		random: RandExp,
	): string | undefined {
		const lengths = intersect(this.lengths(this.root), [[min, max]]);
		if (!lengths.length) return undefined;
		return this.generate(random, this.root, this.pick(random, lengths));
	}

	/** A string generated from `token` that is exactly `length` long. */
	private generate(random: RandExp, token: Token, length: number): string {
		switch (token.type) {
			case TokenType.ROOT:
			case TokenType.GROUP: {
				if (isLookaround(token)) return '';
				const stack = token.options
					? random._randSelect(
							token.options.filter((option) =>
								contains(this.sequence(option), length),
							),
						)
					: token.stack ?? [];
				return this.generateSequence(random, stack, length);
			}
			case TokenType.REPETITION:
				return this.generateRepetition(random, token, length);
			case TokenType.SET:
			case TokenType.CHAR:
				// RandExp picks the character, honoring the case flag.
				return random._gen(token as never, []);
			default:
				return '';
		}
	}

	private generateSequence(
		random: RandExp,
		stack: Token[],
		length: number,
	): string {
		const suffixes = this.suffixLengths(stack);
		let result = '';
		let remaining = length;
		stack.forEach((token, i) => {
			// A length for this token that leaves one the rest can produce.
			const choice = this.pick(
				random,
				intersect(
					this.lengths(token),
					remainders(suffixes[i + 1] as Lengths, remaining),
				),
			);
			result += this.generate(random, token, choice);
			remaining -= choice;
		});
		return result;
	}

	private generateRepetition(
		random: RandExp,
		token: Token,
		length: number,
	): string {
		const repeats = this.repeatsOf(token);
		const item = token.value as Token;
		const min = token.min ?? 0;
		// Only counts that can add up to `length` are worth checking; scanning
		// up to the limit made every nested repetition cost O(limit).
		const max = Math.min(
			repeats.maxUseful(min, token.max ?? Infinity, length),
			// More repeats than this add only empty ones.
			Math.max(min, repeats.last),
		);
		const counts: Lengths = [];
		for (let count = repeats.minUseful(min, length); count <= max; count++) {
			if (contains(repeats.at(count), length)) counts.push([count, count]);
		}
		const count = this.pick(random, normalize(counts));

		let result = '';
		let remaining = length;
		for (let left = count; left > 0; left--) {
			const choice = this.pick(
				random,
				intersect(
					this.lengths(item),
					remainders(repeats.at(left - 1), remaining),
				),
			);
			result += this.generate(random, item, choice);
			remaining -= choice;
		}
		return result;
	}
}

/**
 * Thrown for patterns whose lengths can't be planned: back-references, or
 * patterns that need more than the planning budget.
 */
export class UnplannablePattern extends Error {}

/** Planners by pattern, then by limit; `null` when it can't be planned. */
const planners = new WeakMap<RegExp, Map<number, LengthPlanner | null>>();

/**
 * The planner for `pattern` up to `limit`, shared by every seed, or `null`
 * when the pattern can't be planned.
 */
export function plannerFor(pattern: RegExp, limit: number) {
	let byLimit = planners.get(pattern);
	if (!byLimit) {
		byLimit = new Map();
		planners.set(pattern, byLimit);
	}
	let planner = byLimit.get(limit);
	if (planner === undefined) {
		try {
			planner = new LengthPlanner(pattern, limit);
		} catch (error) {
			if (!(error instanceof UnplannablePattern)) throw error;
			planner = null;
		}
		byLimit.set(limit, planner);
	}
	return planner;
}
