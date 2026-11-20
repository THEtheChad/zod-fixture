import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { MapGenerator } from '.';
import { NumberGenerator } from '../number';
import { StringGenerator } from '../string';

describe('create Maps', () => {
	const transform = new ConstrainedTransformer().extend([
		MapGenerator,
		StringGenerator,
		NumberGenerator,
	]);

	test('produces a valid map', () => {
		expect(transform).toReasonablySatisfy(z.map(z.string(), z.number()));
	});

	test('creates a Map with 3 entries', () => {
		const input = z.map(z.string(), z.number());
		const result = transform.fromSchema(input);

		type I = z.infer<typeof input>;

		expect((result as I).size).toBe(3);
		expect([...(result as I).keys()][0]).toBeTypeOf('string');
		expect([...(result as I).values()][0]).toBeTypeOf('number');
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('fills a map with distinct keys', () => {
		const schema = z.map(z.boolean(), z.number());
		for (let seed = 0; seed < 20; seed++) {
			const keys = [
				...(
					fixture.fromSchema(schema, { seed }) as Map<boolean, number>
				).keys(),
			];
			expect(keys.sort()).toEqual([false, true]);
		}
	});
});
