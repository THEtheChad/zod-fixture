import { Fixture, UnconstrainedFixture } from '@/fixture';
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

	test('respects a min above the default max', () => {
		expect(fixture).toReasonablySatisfy(z.number().min(1000));
	});

	test('respects a max below the default min', () => {
		expect(fixture).toReasonablySatisfy(z.number().max(-500));
	});

	test('respects exclusive bounds inside a unit interval', () => {
		expect(fixture).toReasonablySatisfy(z.number().gt(0).lt(1));
	});

	test('respects positive() with a fractional max', () => {
		expect(fixture).toReasonablySatisfy(z.number().positive().max(0.5));
	});

	test('respects the tightest of repeated min checks', () => {
		expect(fixture).toReasonablySatisfy(z.number().min(0).min(90).max(100));
	});

	test('respects int() with a fractional min', () => {
		expect(fixture).toReasonablySatisfy(z.number().int().min(0.5).max(10));
	});

	test('throws for an unsatisfiable multipleOf', () => {
		expect(() =>
			fixture.fromSchema(z.number().int().multipleOf(7).min(1).max(6)),
		).toThrowError(
			'Unable to generate a number: no integer multiple of 7 in [1, 6].',
		);
	});

	test.each([
		['a step below 1e-6', z.number().multipleOf(1e-7)],
		['a fractional step below 1e-6', z.number().multipleOf(2.5e-8)],
		[
			'a step below 1e-6 in a narrow range',
			z.number().multipleOf(1e-7).min(0).max(2e-6),
		],
	])('creates a number Zod accepts for %s', (_, schema) => {
		// Zod 3 rejects some exact multiples of these steps, like 0.5 and 3.
		expect(z.number().multipleOf(1e-7).safeParse(0.5).success).toBe(false);
		expect(fixture).toReasonablySatisfy(schema);
	});

	test.each([
		[
			'integers',
			z.number().int().multipleOf(1e-7),
			"Zod's multipleOf(1e-7) check rejects every integer in [-100, 100].",
		],
		[
			'values below 1e-6',
			z.number().multipleOf(1e-7).min(0).lt(1e-6),
			"Zod's multipleOf(1e-7) check rejects every multiple in [0, 0.000001).",
		],
	])('throws when Zod rejects every multiple: %s', (_, schema, message) => {
		expect(() => fixture.fromSchema(schema)).toThrowError(message);
	});

	test('respects a fractional multipleOf with exclusive bounds', () => {
		expect(fixture).toReasonablySatisfy(
			z.number().multipleOf(0.1).gt(0.3).lt(0.6),
		);
	});

	test('combines int() with a fractional multipleOf', () => {
		expect(fixture).toReasonablySatisfy(z.number().int().multipleOf(1.5));
	});

	test('respects a min equal to the max', () => {
		expect(fixture.fromSchema(z.number().min(5).max(5))).toBe(5);
	});

	test('supports bounds near the limits of a double', () => {
		expect(fixture).toReasonablySatisfy(
			z.number().min(-Number.MAX_VALUE).max(Number.MAX_VALUE),
		);
	});

	test('throws for an empty exclusive range', () => {
		expect(() => fixture.fromSchema(z.number().gt(5).lt(5))).toThrowError(
			'Unable to generate a number: no value in (5, 5).',
		);
	});

	test.each([
		['gt(100)', z.number().gt(100)],
		['lt(-100)', z.number().lt(-100)],
		['int().gt(100)', z.number().int().gt(100)],
		['min(1).multipleOf(1000)', z.number().min(1).multipleOf(1000)],
		['positive().multipleOf(1000)', z.number().positive().multipleOf(1000)],
		['negative().multipleOf(1000)', z.number().negative().multipleOf(1000)],
		['gte(100).multipleOf(7)', z.number().gte(100).multipleOf(7)],
		[
			'multipleOf(0.1) in [0.3, 0.3]',
			z.number().multipleOf(0.1).min(0.3).max(0.3),
		],
		[
			'multipleOf(0.1) in [0.25, 0.3]',
			z.number().multipleOf(0.1).min(0.25).max(0.3),
		],
		[
			'multipleOf(0.01) in [0.07, 0.07]',
			z.number().multipleOf(0.01).min(0.07).max(0.07),
		],
		['multipleOf(0.5).multipleOf(3)', z.number().multipleOf(0.5).multipleOf(3)],
		[
			'multipleOf(0.2).multipleOf(0.3)',
			z.number().multipleOf(0.2).multipleOf(0.3),
		],
		['min(-Infinity).max(Infinity)', z.number().min(-Infinity).max(Infinity)],
		[
			'multipleOf(0.1) up to 1e308',
			z.number().multipleOf(0.1).min(0).max(1e308),
		],
	])('respects %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test.each([
		['multipleOf(0.3)', z.number().multipleOf(0.3)],
		['int().multipleOf(1.5)', z.number().int().multipleOf(1.5)],
		[
			'multipleOf(0.125).multipleOf(0.5)',
			z.number().multipleOf(0.125).multipleOf(0.5),
		],
		['multipleOf(0.001) with a max', z.number().multipleOf(0.001).max(1e9)],
	])('respects %s with the unconstrained fixture', (_, schema) => {
		expect(new UnconstrainedFixture()).toReasonablySatisfy(schema);
	});

	test('throws for multipleOf(0)', () => {
		expect(() => fixture.fromSchema(z.number().multipleOf(0))).toThrowError(
			'Unable to generate a number: multipleOf(0) never matches.',
		);
	});
});
