import type RandExp from 'randexp';

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
	lookBehind?: boolean;
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
		!!(token.followedBy || token.notFollowedBy || token.lookBehind)
	);
}

/** The lengths a repetition can produce, by number of repeats. */
class Repeats {
	private memo: Lengths[] = [ZERO];
	/** Past this count, more repeats produce no new lengths. */
	private last = Infinity;

	constructor(
		private item: Lengths,
		private limit: number,
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

	/** The highest count worth trying, given at most `max` repeats. */
	maxUseful(max: number): number {
		// An item with no length within the limit can only repeat zero times.
		if (!this.item.length) return 0;
		const shortest = this.item[0]?.[0] ?? 0;
		const longest = this.item[this.item.length - 1]?.[1] ?? 0;
		if (shortest > 0) return Math.min(max, Math.floor(this.limit / shortest));
		// Empty repeats add nothing: enough repeats to reach the limit will do.
		if (longest === 0) return Math.min(max, 1);
		return Math.min(max, Math.ceil(this.limit / longest) + 1);
	}
}

/** Plans and generates matches of one pattern with lengths up to a limit. */
export class LengthPlanner {
	private tokenLengths = new Map<Token, Lengths>();
	private suffixes = new Map<Token[], Lengths[]>();
	private repeats = new Map<Token, Repeats>();

	constructor(
		private randexp: RandExp,
		private limit: number,
	) {}

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
			case TokenType.CHAR:
				return [[1, 1]];
			case TokenType.REPETITION: {
				const repeats = this.repeatsOf(token);
				const min = token.min ?? 0;
				const max = repeats.maxUseful(token.max ?? Infinity);
				const all: Lengths = [];
				for (let count = min; count <= max; count++) {
					const lengths = repeats.at(count);
					if (!lengths.length && count > 0) break;
					all.push(...lengths);
				}
				return normalize(all);
			}
			default:
				throw new UnplannablePattern(
					'Back-references depend on what a group generated earlier.',
				);
		}
	}

	private repeatsOf(token: Token): Repeats {
		let repeats = this.repeats.get(token);
		if (!repeats) {
			repeats = new Repeats(this.lengths(token.value as Token), this.limit);
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
				suffixes[i] = add(
					this.lengths(stack[i] as Token),
					suffixes[i + 1] as Lengths,
					this.limit,
				);
			}
			this.suffixes.set(stack, suffixes);
		}
		return suffixes;
	}

	private sequence(stack: Token[]): Lengths {
		return this.suffixLengths(stack)[0] as Lengths;
	}

	/** A random length from `lengths`; every length is equally likely. */
	private pick(lengths: Lengths): number {
		const total = lengths.reduce((sum, [from, to]) => sum + to - from + 1, 0);
		let index = this.randexp.randInt(0, total - 1);
		for (const [from, to] of lengths) {
			const size = to - from + 1;
			if (index < size) return from + index;
			index -= size;
		}
		throw new Error('Unable to pick a length from an empty set.');
	}

	/**
	 * A string generated from the pattern with a length in `[min, max]`
	 * (`max` at most the planner's limit), or `undefined` when the pattern
	 * produces no such length.
	 */
	generateBetween(min: number, max: number): string | undefined {
		const root = (this.randexp as unknown as { tokens: Token }).tokens;
		const lengths = intersect(this.lengths(root), [[min, max]]);
		if (!lengths.length) return undefined;
		return this.generate(root, this.pick(lengths));
	}

	/** A string generated from `token` that is exactly `length` long. */
	private generate(token: Token, length: number): string {
		switch (token.type) {
			case TokenType.ROOT:
			case TokenType.GROUP: {
				if (isLookaround(token)) return '';
				const stack = token.options
					? this.randexp._randSelect(
							token.options.filter((option) =>
								contains(this.sequence(option), length),
							),
						)
					: token.stack ?? [];
				return this.generateSequence(stack, length);
			}
			case TokenType.REPETITION:
				return this.generateRepetition(token, length);
			case TokenType.SET:
			case TokenType.CHAR:
				// RandExp picks the character, honoring the case flag.
				return this.randexp._gen(token as never, []);
			default:
				return '';
		}
	}

	private generateSequence(stack: Token[], length: number): string {
		const suffixes = this.suffixLengths(stack);
		let result = '';
		let remaining = length;
		stack.forEach((token, i) => {
			// A length for this token that leaves one the rest can produce.
			const choice = this.pick(
				intersect(
					this.lengths(token),
					remainders(suffixes[i + 1] as Lengths, remaining),
				),
			);
			result += this.generate(token, choice);
			remaining -= choice;
		});
		return result;
	}

	private generateRepetition(token: Token, length: number): string {
		const repeats = this.repeatsOf(token);
		const item = token.value as Token;
		const min = token.min ?? 0;
		const max = repeats.maxUseful(token.max ?? Infinity);
		const counts: Lengths = [];
		for (let count = min; count <= max; count++) {
			if (contains(repeats.at(count), length)) counts.push([count, count]);
		}
		const count = this.pick(normalize(counts));

		let result = '';
		let remaining = length;
		for (let left = count; left > 0; left--) {
			const choice = this.pick(
				intersect(
					this.lengths(item),
					remainders(repeats.at(left - 1), remaining),
				),
			);
			result += this.generate(item, choice);
			remaining -= choice;
		}
		return result;
	}
}

/** Thrown for patterns whose lengths can't be planned (back-references). */
export class UnplannablePattern extends Error {}
