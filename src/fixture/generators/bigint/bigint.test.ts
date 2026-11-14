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

	// BUG: a one-sided bound collides with the default for the other side.
	test.fails('respects a min above the default max', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().min(500n));
	});

	test.fails('respects a max below the default min', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().max(-500n));
	});

	test.fails('respects min equal to max', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().min(5n).max(5n));
	});

	// BUG: bigint ignores gt/lt exclusivity.
	test.fails('respects exclusive bounds', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().gt(5n).lt(8n));
	});

	// BUG: only the first check of each kind is used.
	test.fails('respects the tightest of repeated min checks', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().min(0n).min(90n).max(100n));
	});

	// BUG: multipleOf uses truncating division and undershoots the min.
	test.fails('respects multipleOf with a min that is not a multiple', () => {
		expect(fixture).toReasonablySatisfy(
			z.bigint().multipleOf(7n).min(8n).max(20n),
		);
	});

	test.fails('supports a multipleOf larger than the default range', () => {
		expect(fixture).toReasonablySatisfy(z.bigint().multipleOf(1000n));
	});
});
