import type RandExp from 'randexp';
import { describe, expect, test } from 'vitest';
import { RegExCache } from './RegExCache';

describe('RegExCache', () => {
	test('builds an instance on a miss and reuses it on a hit', () => {
		const cache = new RegExCache();
		const pattern = /^[a-z]+$/;
		let built = 0;
		const factory = (instance: RandExp) => {
			built++;
			return instance;
		};

		const first = cache.get(pattern, factory);
		const second = cache.get(pattern, factory);

		expect(second).toBe(first);
		expect(built).toBe(1);
	});

	test('caches string patterns', () => {
		const cache = new RegExCache();

		const first = cache.get('^[a-z]+$', (instance) => instance);

		expect(cache.get('^[a-z]+$')).toBe(first);
	});

	test('returns a cached instance without a factory', () => {
		const cache = new RegExCache();
		const pattern = /^[a-z]+$/;
		const first = cache.get(pattern, (instance) => instance);

		expect(cache.get(pattern)).toBe(first);
	});

	test('throws on a miss without a factory', () => {
		expect(() => new RegExCache().get(/^[a-z]+$/)).toThrowError(
			'No value for /^[a-z]+$/ and no fallback available.',
		);
	});
});
