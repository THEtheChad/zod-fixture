import type { Core } from './core';

const LOREM =
	'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const PARAGRAPHS = [LOREM];
const SENTENCES = LOREM.replace(/\. /g, '.\n').split('\n');
const WORDS = LOREM.toLowerCase().replace(/[,.]/, '').split(' ');

export class Utils {
	constructor(private core: Core) {}

	uuid() {
		let u = '',
			m = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
			i = 0,
			rb = (Math.random() * 0xffffffff) | 0;
		while (i++ < 36) {
			let c = m[i - 1],
				r = rb & 0xf,
				v = c == 'x' ? r : (r & 0x3) | 0x8;
			u += c == '-' || c == '4' ? c : v.toString(16);
			rb = i % 8 == 0 ? (Math.random() * 0xffffffff) | 0 : rb >> 4;
		}
		return u;
	}

	n<T>(
		factory: (index: number) => T,
		config: number | { min: number; max: number } = this.core.defaults.array,
	): Array<T> {
		const length = typeof config === 'number' ? config : this.randomInt(config);

		return Array.from({ length }, (_, i) => factory(i));
	}

	randomFrom<T extends unknown>(list: T[] | readonly T[] | Set<T>): T {
		const options = Array.from(list);

		const min = 0;
		const max = Math.max(min, options.length - 1);

		return options[this.randomInt({ min, max })] as T;
	}

	randomFloat(config?: { min?: number; max?: number }): number {
		const min = config?.min ?? this.core.defaults.float.min;
		const max = config?.max ?? this.core.defaults.float.max;

		if (min > max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		return Math.random() * (max - min) + min;
	}

	randomInt(config?: { min?: number; max?: number }): number {
		const min = config?.min ?? this.core.defaults.int.min;
		const max = config?.max ?? this.core.defaults.int.max;

		if (min > max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	randomBigInt(config?: { min?: bigint; max?: bigint }): bigint {
		const min = config?.min ?? BigInt(this.core.defaults.bigint.min);
		const max = config?.max ?? BigInt(this.core.defaults.bigint.max);

		if (min >= max) {
			throw new Error(`min ${min} can't be greater than max ${max}`);
		}

		const difference = max - min;
		const differenceLength = difference.toString().length;
		let multiplier = '';
		while (multiplier.length < differenceLength) {
			multiplier += Math.random().toString().split('.')[1];
		}
		multiplier = multiplier.slice(0, differenceLength);
		const divisor = '1' + '0'.repeat(differenceLength);

		const randomDifference =
			(difference * BigInt(multiplier)) / BigInt(divisor);

		return min + randomDifference;
	}

	lorem(length: number, type: 'word' | 'sentence' | 'paragraph' = 'word') {
		const target =
			type === 'word' ? WORDS : type === 'sentence' ? SENTENCES : PARAGRAPHS;

		return this.core.utils
			.n(() => this.core.utils.randomFrom(target), length)
			.join(' ');
	}

	filterChecks<TChecks extends { kind: string }[], TKind extends string>(
		checks: TChecks,
		kind: TKind,
	): Utils.FilterChecks<TChecks[number], TKind> | undefined {
		return checks.find(check => check.kind === kind) as
			| Utils.FilterChecks<TChecks[number], TKind>
			| undefined;
	}
}
