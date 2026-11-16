import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import {
	PreprocessGenerator,
	RefinementGenerator,
	TransformGenerator,
} from '.';
import { StringGenerator } from '../string';

describe('usage with effects', () => {
	const transform = new ConstrainedTransformer().extend([
		PreprocessGenerator,
		RefinementGenerator,
		TransformGenerator,
		StringGenerator,
	]);

	test('does invoke transform', () => {
		const value = 0;
		const spy = vi.fn(() => value);
		const result = transform.fromSchema(z.string().transform(spy));
		expect(spy).toBeCalled();
		expect(result).toBeTypeOf(typeof value);
	});

	test('does not invoke preprocess', () => {
		const spy = vi.fn(() => 0);
		const result = transform.fromSchema(z.preprocess(spy, z.string()));
		expect(spy).not.toBeCalled();
		expect(result).toBeTypeOf('string');
	});

	test('does not invoke refine', () => {
		const spy = vi.fn(() => 0);
		const result = transform.fromSchema(z.string().refine(spy));
		expect(spy).not.toBeCalled();
		expect(result).toBeTypeOf('string');
	});

	test('does not invoke superRefine', () => {
		const spy = vi.fn(() => 0);
		const result = transform.fromSchema(z.string().superRefine(spy));
		expect(spy).not.toBeCalled();
		expect(result).toBeTypeOf('string');
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('regenerates inputs a transform rejects with addIssue', () => {
		const schema = z
			.number()
			.int()
			.transform((value, ctx) => {
				if (value % 2) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'odd' });
					return z.NEVER;
				}
				return value / 2;
			});

		for (let seed = 0; seed < 100; seed++) {
			expect(Number.isInteger(fixture.fromSchema(schema, { seed }))).toBe(true);
		}
	});

	test('passes the path to the transform context', () => {
		const paths: (string | number)[][] = [];
		fixture.fromSchema(
			z.object({
				name: z.string().transform((value, ctx) => {
					paths.push(ctx.path);
					return value;
				}),
			}),
		);
		expect(paths).toEqual([['name']]);
	});

	test('explains a transform that rejects every input', () => {
		const schema = z.object({
			name: z.string().transform((_, ctx) => {
				ctx.addIssue({ code: z.ZodIssueCode.custom });
				return z.NEVER;
			}),
		});

		expect(() => fixture.fromSchema(schema)).toThrowError(
			'Unable to generate a value at name: the transform rejected all 20 generated inputs.',
		);
	});

	test('warns once per refinement', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const schema = z.string().refine(() => true);

		for (let seed = 0; seed < 10; seed++) fixture.fromSchema(schema, { seed });

		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});
});
