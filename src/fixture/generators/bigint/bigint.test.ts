import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { BigIntGenerator, BigIntMultipleOfGenerator } from '.';

describe('create bigint', () => {
	const transform = new ConstrainedTransformer().extend([
		BigIntGenerator,
		BigIntMultipleOfGenerator,
	]);

	test('produces a valid bigint', () => {
		expect(transform).toReasonablySatisfy(z.bigint());
	});

	test('creates a bigint between Number.MIN_SAFE_INTEGER and Number.MAX_SAFE_INTEGER', () => {
		const result = transform.fromSchema(z.bigint());

		expect(result).toBeTypeOf('bigint');
		expect(result).toBeGreaterThanOrEqual(Number.MIN_SAFE_INTEGER);
		expect(result).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('respects a min above the default max', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().min(500n));
	});

	test('respects a max below the default min', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().max(-500n));
	});

	test('respects min equal to max', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().min(5n).max(5n));
	});

	test('respects exclusive bounds', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().gt(5n).lt(8n));
	});

	test('respects the tightest of repeated min checks', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().min(0n).min(90n).max(100n));
	});

	test('respects multipleOf with a min that is not a multiple', () => {
		expect(fixture).toReasonablySatisfy(
			z.bigint().multipleOf(7n).min(8n).max(20n),
		);
	});

	test('supports a multipleOf larger than the default range', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().multipleOf(1000n));
	});

	test('can produce an inclusive max', () => {
		const schema = z.bigint().min(5n).max(6n);
		const values = new Set(
			Array.from({ length: 50 }, (_, seed) =>
				fixture.fromSchema(schema, { seed }),
			),
		);
		expect(values).toEqual(new Set([5n, 6n]));
	});

	test('throws for an unsatisfiable multipleOf', () => {
		expect(() =>
			fixture.fromSchema(z.bigint().multipleOf(7n).min(1n).max(6n)),
		).toThrowError('Unable to generate a bigint: no multiple of 7 in [1, 6].');
	});

	test.each([
		['gt(100n)', z.bigint().gt(100n)],
		['lt(-100n)', z.bigint().lt(-100n)],
		['positive().multipleOf(1000n)', z.bigint().positive().multipleOf(1000n)],
		['gt(1n).multipleOf(1000n)', z.bigint().gt(1n).multipleOf(1000n)],
	])('respects %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});
});
