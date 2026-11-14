import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { NumberGenerator } from '.';

describe('create numbers', () => {
	const transform = new ConstrainedTransformer().extend([NumberGenerator]);

	test('produces a valid number', () => {
		expect(transform).toReasonablySatisfy(z.number());
	});

	test(`creates a number between Number.MIN_SAFE_INTEGER and Number.MAX_SAFE_INTEGER`, () => {
		const result = transform.fromSchema(z.number());

		expect(result).toBeTypeOf('number');
		expect(result).toBeGreaterThanOrEqual(Number.MIN_SAFE_INTEGER);
		expect(result).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
	});

	test("creates a number that's an int", () => {
		expect(transform.fromSchema(z.number().int())).toBeTypeOf('number');
	});

	describe('min and max', () => {
		test('produces a valid number', () => {
			expect(transform).toReasonablySatisfy(z.number().min(10).max(20));
		});

		test('creates a number with a min value', () => {
			expect(transform.fromSchema(z.number().min(100))).toBeGreaterThanOrEqual(
				100,
			);
			expect(transform.fromSchema(z.number().gte(100))).toBeGreaterThanOrEqual(
				100,
			);
		});

		test('creates a number with a negative min value', () => {
			expect(transform.fromSchema(z.number().min(-10))).toBeGreaterThanOrEqual(
				-10,
			);
		});

		test('creates a number with a max value', () => {
			expect(transform.fromSchema(z.number().max(5))).toBeLessThanOrEqual(5);
			expect(transform.fromSchema(z.number().lte(5))).toBeLessThanOrEqual(5);
		});

		test('creates a number with a negative max value', () => {
			expect(transform.fromSchema(z.number().max(-5))).toBeLessThanOrEqual(-5);
		});

		test('creates a number with a negative max value', () => {
			const result = transform.fromSchema(z.number().min(-10).max(-5));
			expect(result).toBeGreaterThanOrEqual(-10);
			expect(result).toBeLessThanOrEqual(-5);
		});

		test('throws when min is greater than max', () => {
			expect(() =>
				transform.fromSchema(z.number().min(100).max(10)),
			).toThrowError();
		});
	});

	describe('positive and negative', () => {
		test('produces a valid positive number', () => {
			expect(transform).toReasonablySatisfy(z.number().positive());
		});

		test('creates a positive number', () => {
			expect(transform.fromSchema(z.number().positive())).toBeGreaterThan(0);
			expect(
				transform.fromSchema(z.number().nonnegative()),
			).toBeGreaterThanOrEqual(0);
		});

		test('produces a valid negative number', () => {
			expect(transform).toReasonablySatisfy(z.number().positive());
		});

		test('creates a negative number', () => {
			expect(transform.fromSchema(z.number().negative())).toBeLessThan(0);
			expect(
				transform.fromSchema(z.number().nonpositive()),
			).toBeLessThanOrEqual(0);
		});
	});

	describe('multipleOf', () => {
		test('produces a valid multipleOf number', () => {
			expect(transform).toReasonablySatisfy(z.number().multipleOf(33));
		});

		test("creates a number that's a multiple with min and max", () => {
			const schema = z.number().multipleOf(3).min(16).max(20);
			expect(transform).toReasonablySatisfy(schema);
			expect(transform.fromSchema(schema)).toBe(18);
		});

		test("creates a number that's a multiple of a decimal", () => {
			const schema = z.number().multipleOf(3.3).min(16).max(19);
			expect(transform).toReasonablySatisfy(schema);
			expect(transform.fromSchema(schema)).toBe(16.5);
		});
	});

	test('creates a finite number', () => {
		expect(
			isFinite(transform.fromSchema(z.number().finite()) as number),
		).toBeTruthy();
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	// BUG: a one-sided bound collides with the default for the other side.
	test.fails('respects a min above the default max', () => {
		expect(fixture).toReasonablySatisfy(z.number().min(1000));
	});

	test.fails('respects a max below the default min', () => {
		expect(fixture).toReasonablySatisfy(z.number().max(-500));
	});

	// BUG: exclusive float bounds are shifted by ±1.
	test.fails('respects exclusive bounds inside a unit interval', () => {
		expect(fixture).toReasonablySatisfy(z.number().gt(0).lt(1));
	});

	test.fails('respects positive() with a fractional max', () => {
		expect(fixture).toReasonablySatisfy(z.number().positive().max(0.5));
	});

	// BUG: only the first check of each kind is used.
	test.fails('respects the tightest of repeated min checks', () => {
		expect(fixture).toReasonablySatisfy(z.number().min(0).min(90).max(100));
	});

	// BUG: int() with a fractional min yields a non-integer.
	test.fails('respects int() with a fractional min', () => {
		expect(fixture).toReasonablySatisfy(z.number().int().min(0.5).max(10));
	});

	// BUG: an unsatisfiable multipleOf silently returns an out-of-range value.
	test.fails('throws for an unsatisfiable multipleOf', () => {
		expect(() =>
			fixture.fromSchema(z.number().int().multipleOf(7).min(1).max(6)),
		).toThrow();
	});
});
