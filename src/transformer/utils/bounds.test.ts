import { describe, expect, test } from 'vitest';
import {
	ceilDiv,
	combineBigIntMultipleOf,
	combineMultipleOf,
	decimalPlaces,
	floorDiv,
	integerStep,
	lowerBound,
	nextDown,
	nextUp,
	resolveRange,
	upperBound,
} from './bounds';

describe('bounds', () => {
	test('lowerBound keeps the largest value, preferring exclusive on ties', () => {
		expect(
			lowerBound([
				{ value: 0, inclusive: true },
				{ value: 90, inclusive: true },
				{ value: 90, inclusive: false },
			]),
		).toEqual({ value: 90, inclusive: false });
		expect(lowerBound([])).toBeUndefined();
	});

	test('upperBound keeps the smallest value, preferring exclusive on ties', () => {
		expect(
			upperBound([
				{ value: 10n, inclusive: true },
				{ value: 5n, inclusive: true },
				{ value: 5n, inclusive: false },
			]),
		).toEqual({ value: 5n, inclusive: false });
	});

	test('resolveRange fills an open side without crossing the explicit bound', () => {
		const fallback = { min: -100, max: 100 };
		expect(resolveRange(undefined, undefined, fallback)).toEqual(fallback);
		expect(resolveRange(10, undefined, fallback)).toEqual({
			min: 10,
			max: 100,
		});
		// On the default edge, an exclusive bound would leave nothing.
		expect(resolveRange(100, undefined, fallback)).toEqual({
			min: 100,
			max: 300,
		});
		expect(resolveRange(undefined, -100, fallback)).toEqual({
			min: -300,
			max: -100,
		});
		expect(resolveRange(1000, undefined, fallback)).toEqual({
			min: 1000,
			max: 1200,
		});
		expect(resolveRange(undefined, -500, fallback)).toEqual({
			min: -700,
			max: -500,
		});
		expect(resolveRange(500n, undefined, { min: -100n, max: 100n })).toEqual({
			min: 500n,
			max: 700n,
		});
	});

	test('nextUp and nextDown step to the adjacent double', () => {
		expect(nextUp(0)).toBe(Number.MIN_VALUE);
		expect(nextDown(0)).toBe(-Number.MIN_VALUE);
		expect(nextUp(1)).toBe(1 + Number.EPSILON);
		expect(nextUp(-1)).toBeGreaterThan(-1);
		expect(nextDown(1)).toBeLessThan(1);
		expect(nextDown(-1)).toBeLessThan(-1);
	});

	test('decimalPlaces handles exponent notation', () => {
		expect(decimalPlaces(5)).toBe(0);
		expect(decimalPlaces(0.25)).toBe(2);
		expect(decimalPlaces(1e-7)).toBe(7);
		expect(decimalPlaces(1.5e-7)).toBe(8);
	});

	test('combineMultipleOf takes the lcm of every step', () => {
		expect(combineMultipleOf([])).toBeUndefined();
		expect(combineMultipleOf([4, 6])).toBe(12);
		expect(combineMultipleOf([-3])).toBe(3);
		expect(combineMultipleOf([0.2, 0.3])).toBe(0.6);
		expect(combineMultipleOf([0.5, 3])).toBe(3);
		expect(combineMultipleOf([0.1, 0])).toBe(0);
		expect(combineBigIntMultipleOf([4n, 6n])).toBe(12n);
	});

	test('integerStep finds the smallest integer multiple', () => {
		expect(integerStep(3)).toBe(3);
		expect(integerStep(0.5)).toBe(1);
		expect(integerStep(1.5)).toBe(3);
		expect(integerStep(0.4)).toBe(2);
	});

	test('ceilDiv and floorDiv round toward the correct side', () => {
		expect(ceilDiv(8n, 7n)).toBe(2n);
		expect(ceilDiv(-8n, 7n)).toBe(-1n);
		expect(floorDiv(8n, 7n)).toBe(1n);
		expect(floorDiv(-8n, 7n)).toBe(-2n);
	});
});
