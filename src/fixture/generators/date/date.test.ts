import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { DateGenerator } from '.';

describe('create dates', () => {
	const transform = new ConstrainedTransformer().extend([DateGenerator]);

	test('produces a valid date', () => {
		expect(transform).toReasonablySatisfy(z.date());
	});

	test('creates a date', () => {
		const result = transform.fromSchema(z.date());
		expect(result).toBeInstanceOf(Date);
	});

	test('produces a valid date using min and max', () => {
		expect(transform).toReasonablySatisfy(
			z
				.date()
				.min(new Date(2020, 1, 1))
				.max(new Date(2022, 12, 31)),
		);
	});

	test('creates a date with a min value', () => {
		const result = transform.fromSchema(z.date().min(new Date(2050, 5, 16)));
		expect((result as Date).getTime()).toBeGreaterThanOrEqual(
			new Date(2050, 5, 16).getTime(),
		);
	});

	test('creates a date with a max value', () => {
		const result = transform.fromSchema(z.date().max(new Date(1991, 10, 20)));
		expect((result as Date).getTime()).toBeLessThanOrEqual(
			new Date(1991, 10, 20).getTime(),
		);
	});

	test('throws when min is greater then max', () => {
		expect(() =>
			transform.fromSchema(
				z
					.date()
					.min(new Date(2025, 1, 1))
					.max(new Date(1991, 10, 20)),
			),
		).toThrow();
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('respects a min above the default max', () => {
		expect(fixture).toReasonablySatisfy(z.date().min(new Date('2200-01-01')));
	});

	test('respects a max below the default min', () => {
		expect(fixture).toReasonablySatisfy(z.date().max(new Date('1800-01-01')));
	});

	test('respects the tightest of repeated min checks', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.date()
				.min(new Date('2000-01-01'))
				.min(new Date('2020-01-01'))
				.max(new Date('2021-01-01')),
		);
	});

	test('respects a min equal to the max', () => {
		const date = new Date('2024-02-29T12:00:00.000Z');
		expect(fixture.fromSchema(z.date().min(date).max(date))).toEqual(date);
	});
});
