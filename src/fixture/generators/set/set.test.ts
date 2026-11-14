import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { SetGenerator } from '.';
import { NumberGenerator } from '../number';

describe('create Sets', () => {
	const transform = new ConstrainedTransformer().extend([
		SetGenerator,
		NumberGenerator,
	]);

	test('produces a valid set', () => {
		expect(transform).toReasonablySatisfy(z.set(z.number()));
	});

	test('creates a Set with 3 entries', () => {
		const input = z.set(z.number());
		const result = transform.fromSchema(input);

		type I = z.infer<typeof input>;

		expect((result as I).size).toBe(3);
		expect([...(result as I).keys()][0]).toBeTypeOf('number');
		expect([...(result as I).values()][0]).toBeTypeOf('number');
	});

	test('should honor the constraints of the schema', () => {
		const schema = z.set(z.number()).min(5);
		const fixture = transform.fromSchema(schema);
		expect(() => schema.parse(fixture)).not.toThrowError();
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	// BUG: sets add n values once and dedupe, so they come out under-filled.
	test.fails('fills a set from a small value space', () => {
		expect(fixture).toReasonablySatisfy(z.set(z.boolean()).size(2));
	});

	test.fails('fills a set from an enum', () => {
		expect(fixture).toReasonablySatisfy(z.set(z.enum(['a', 'b', 'c'])).min(3));
	});

	test.fails('fills a set from a narrow int range', () => {
		expect(fixture).toReasonablySatisfy(
			z.set(z.number().int().min(0).max(3)).min(3),
		);
	});

	// BUG: an unsatisfiable set size silently returns an under-filled set.
	test.fails('throws when the value space is too small', () => {
		expect(() => fixture.fromSchema(z.set(z.boolean()).min(3))).toThrow();
	});
});
