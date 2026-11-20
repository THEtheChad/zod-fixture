import { Fixture } from '@/fixture';
import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

describe('create pipelines', () => {
	const fixture = new Fixture();

	test('produces a valid pipeline', () => {
		expect(fixture).toReasonablySatisfy(z.string().pipe(z.string().min(3)));
	});

	test('keeps the constraints of both sides', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().email().pipe(z.string().min(5)),
		);
	});

	test('returns the output of a transforming pipeline', () => {
		const schema = z
			.string()
			.transform(() => 42)
			.pipe(z.number());

		for (let seed = 0; seed < 20; seed++) {
			expect(fixture.fromSchema(schema, { seed })).toBe(42);
		}
	});

	test('runs the output of `in` through a transforming `out`', () => {
		const schema = z
			.string()
			.min(3)
			.pipe(z.string().transform((value) => value.length));

		for (let seed = 0; seed < 20; seed++) {
			expect(fixture.fromSchema(schema, { seed })).toBeGreaterThanOrEqual(3);
		}
	});

	test('falls back to the output schema when inputs keep failing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const output = z.number().int();
		const schema = z.string().pipe(z.coerce.number().int());

		for (let seed = 0; seed < 100; seed++) {
			expect(
				output.safeParse(fixture.fromSchema(schema, { seed })).success,
			).toBe(true);
		}
		// The fallback is an approximation, so it says so once.
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	test.each([
		[
			'int() into a narrow range',
			z.number().int().pipe(z.number().min(5).max(6)),
		],
		['a long string into email()', z.string().min(20).pipe(z.string().email())],
	])('finds a value both sides accept: %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});
});
