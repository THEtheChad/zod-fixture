import type { Defaults } from '../defaults';
import MersenneTwister from './MersenneTwister';
import { RegExCache } from './RegExCache';
import { UnplannablePattern, plannerFor } from './regexLength';

const LOREM =
	'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const PARAGRAPHS = [LOREM];
const SENTENCES = LOREM.replace(/\. /g, '.\n').split('\n');
const WORDS = LOREM.toLowerCase().replace(/[,.]/g, '').split(' ');

export class Randomization {
	mt: MersenneTwister;
	private regExCache = new RegExCache();
	regExRandInt: (min: number, max: number) => number;

	constructor(private defaults: Defaults) {
		this.mt = new MersenneTwister(defaults.seed);
		this.regExRandInt = function (
			this: Randomization,
			min: number,
			max: number,
		) {
			return this.int({ min, max });
		}.bind(this);
	}

	uuid() {
		let u = '';
		const m = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
		let i = 0;
		let rb = (this.unitInterval() * 0xffffffff) | 0;
		while (i++ < 36) {
			const c = m[i - 1],
				r = rb & 0xf,
				v = c == 'x' ? r : (r & 0x3) | 0x8;
			u += c == '-' || c == '4' ? c : v.toString(16);
			rb = i % 8 == 0 ? (this.unitInterval() * 0xffffffff) | 0 : rb >> 4;
		}
		return u;
	}

	// https://en.wikipedia.org/wiki/Unit_interval
	unitInterval() {
		return this.mt.random();
	}

	from<T>(list: T[] | readonly T[] | Set<T> | string): T {
		const options = list instanceof Set ? [...list] : list;

		const min = 0;
		const max = Math.max(min, options.length - 1);
		const target = this.int({ min, max });

		return options[target] as T;
	}

	shuffle<T>(values: T[]): T[] {
		const copy: (T | undefined)[] = [...values];

		for (let i = copy.length - 1; i > 0; i--) {
			const j = this.int({ min: 0, max: i });
			const temp = copy[i];
			copy[i] = copy[j];
			copy[j] = temp;
		}

		return copy as T[];
	}

	emoji() {
		const codePoint = this.int({ min: 0x1f601, max: 0x1f64f });
		return String.fromCodePoint(codePoint);
	}

	string(config: { min?: number; max?: number }) {
		let min = config.min ?? this.defaults.string.min;
		let max = config.max ?? this.defaults.string.max;

		if (min < 0)
			throw new Error(
				`Minimum length of a string can't be less than 0: ${min}`,
			);

		if (config.min && !config.max) max = config.min;
		if (config.max && !config.min) min = config.max;

		const length = this.int({ min, max });

		let result = '';
		for (let i = 0; i < length; i++) {
			result += this.from(this.defaults.string.characterSet);
		}

		return result;
	}

	float(config?: { min?: number; max?: number }): number {
		const min = config?.min ?? this.defaults.float.min;
		const max = config?.max ?? this.defaults.float.max;

		if (min > max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		const unit = this.unitInterval();
		const span = max - min;

		// Very wide ranges (e.g. ±Number.MAX_VALUE) overflow `max - min`.
		return Number.isFinite(span)
			? unit * span + min
			: unit * max + (1 - unit) * min;
	}

	int(config?: { min?: number; max?: number }): number {
		const min = config?.min ?? this.defaults.int.min;
		const max = config?.max ?? this.defaults.int.max;

		if (min > max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		return Math.floor(this.unitInterval() * (max - min + 1)) + min;
	}

	/** A bigint in `[min, max]`, both inclusive. */
	bigInt(config?: { min?: bigint; max?: bigint }): bigint {
		const min = config?.min ?? this.defaults.bigint.min;
		const max = config?.max ?? this.defaults.bigint.max;

		if (min > max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		// Scale `range` by a random fraction with as many decimal digits as
		// `range` has, built 15 digits at a time from the unit interval.
		const range = max - min + 1n;
		const digits = range.toString().length;
		let fraction = '';
		while (fraction.length < digits) {
			fraction += Math.floor(this.unitInterval() * 1e15)
				.toString()
				.padStart(15, '0');
		}

		const offset =
			(range * BigInt(fraction.slice(0, digits))) / 10n ** BigInt(digits);

		return min + offset;
	}

	lorem(length: number, type: 'word' | 'sentence' | 'paragraph' = 'word') {
		const target =
			type === 'word' ? WORDS : type === 'sentence' ? SENTENCES : PARAGRAPHS;

		return Array.from({ length }, () => this.from(target)).join(' ');
	}

	boolean() {
		return this.unitInterval() < 0.5;
	}

	date(config?: { min?: number; max?: number }): Date {
		const min = config?.min ?? this.defaults.date.min;
		const max = config?.max ?? this.defaults.date.max;

		if (min > max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		return new Date(this.int({ min, max }));
	}

	cuid() {
		return this.regexp(/^[c][a-z0-9]{8}0000[a-z]{4}[a-z0-9]{8}$/);
	}

	cuid2() {
		return this.regexp(/^[a-z][a-z0-9]{23}$/);
	}

	ulid() {
		return this.regexp(/01[0-9A-HJKMNP-TV-Z]{24}/);
	}

	/**
	 * A string matching `pattern`. `maxRepetition` caps unbounded quantifiers
	 * (`*`, `+`, `{n,}`); RandExp's default is 100.
	 */
	regexp(pattern: string | RegExp, maxRepetition = 100): string {
		const randexp = this.randExpFor(pattern);
		randexp.max = maxRepetition;
		return randexp.gen();
	}

	/**
	 * A string generated from `pattern` with a length in `[min, max]`, or
	 * `undefined` when the pattern produces no such length or can't be
	 * planned (back-references, or too complex); fall back to `regexp` then.
	 */
	regexpOfLength(
		pattern: RegExp,
		min: number,
		max: number,
	): string | undefined {
		try {
			return plannerFor(pattern, max)?.generateBetween(
				min,
				max,
				this.randExpFor(pattern),
			);
		} catch (error) {
			if (error instanceof UnplannablePattern) return undefined;
			throw error;
		}
	}

	private randExpFor(pattern: string | RegExp) {
		return this.regExCache.get(pattern, (instance) => {
			instance.randInt = this.regExRandInt;
			return instance;
		});
	}
}
