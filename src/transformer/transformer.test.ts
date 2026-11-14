import { describe, expect, test } from 'vitest';
import { ZodNumber, z } from 'zod';
import { DEFAULT_FIXTURE_GENERATORS } from '../fixture/generators';
import { NumberGenerator } from '../fixture/generators/number';
import { ObjectGenerator } from '../fixture/generators/object';
import { StringGenerator } from '../fixture/generators/string';
import { Generator } from './generator';
import { ConstrainedTransformer } from './transformer';

describe('transform', () => {
	test('throws on invalid schema type', () => {
		const transform = new ConstrainedTransformer();
		const input = z.string();
		expect(() => transform.fromSchema(input)).toThrowError(input._def.typeName);
	});

	test.each([
		// Zod 4 classic: internals on `_zod`, `_def.type` instead of `typeName`.
		['zod', { _zod: { def: { type: 'string' } }, _def: { type: 'string' } }],
		// zod/mini: no `_def` at all.
		['zod/mini', { _zod: { def: { type: 'string' } } }],
	])('explains that %s 4 schemas are not supported', (_, zod4String) => {
		const transform = new ConstrainedTransformer().extend(
			DEFAULT_FIXTURE_GENERATORS,
		);

		expect(() =>
			transform.fromSchema(zod4String as unknown as z.ZodTypeAny),
		).toThrowError(
			'Received a Zod 4 schema (string), but zod-fixture supports Zod 3 schemas only.',
		);
	});

	test('creates a fixture', () => {
		const transform = new ConstrainedTransformer().extend(
			DEFAULT_FIXTURE_GENERATORS,
		);
		const PersonSchema = z.object({
			name: z.string(),
			birthday: z.date(),
			address: z.object({
				street: z.string(),
				city: z.string(),
				state: z.string(),
			}),
			pets: z.array(z.object({ name: z.string(), breed: z.string() })),
			totalVisits: z.number(),
		});

		expect(() => transform.fromSchema(PersonSchema)).not.toThrow();
	});

	test('throws when schema missing', () => {
		const generators = [...DEFAULT_FIXTURE_GENERATORS].filter(
			(g) => g !== StringGenerator,
		);
		const transform = new ConstrainedTransformer().extend(generators);
		const PersonSchema = z.object({
			name: z.string(),
			birthday: z.date(),
			address: z.object({
				street: z.string(),
				city: z.string(),
				state: z.string(),
			}),
			pets: z.array(z.object({ name: z.string(), breed: z.string() })),
			totalVisits: z.number(),
		});

		expect(() => transform.fromSchema(PersonSchema)).toThrow(
			/No generator found for ZodString/i,
		);
	});

	test('to reliably reproduces fixtures when using the same seed', () => {
		const transform = new ConstrainedTransformer().extend([NumberGenerator]);

		const results: unknown[] = [];

		results.push(transform.fromSchema(z.number(), { seed: 1 }));
		results.push(transform.fromSchema(z.number(), { seed: 1 }));
		results.push(transform.fromSchema(z.number(), { seed: 1 }));
		results.push(transform.fromSchema(z.number(), { seed: 1 }));

		expect(results.every((result) => result === results[0])).toEqual(true);
	});

	describe('order of generators', () => {
		test(`picks up the first matching generator`, () => {
			const FooNumberGenerator = Generator({
				schema: ZodNumber,
				filter: ({ context }) => context?.path?.includes('foo'),
				output: () => 4,
			});

			const transform = new ConstrainedTransformer().extend([
				ObjectGenerator,
				FooNumberGenerator,
				NumberGenerator,
			]);

			const schema = z.object({
				foo: z.number(),
				other: z.number(),
			});
			const result = transform.fromSchema(schema);
			type schemaType = z.infer<typeof schema>;

			expect((result as schemaType).foo).toBe(4);
			expect((result as schemaType).other).toBeTypeOf('number');
		});

		test(`picks up the first matching generator using extend`, () => {
			const FooNumberGenerator = Generator({
				schema: ZodNumber,
				filter: ({ context }) => context?.path?.includes('foo'),
				output: () => 4,
			});

			const transform = new ConstrainedTransformer().extend([ObjectGenerator]);
			transform.extend(NumberGenerator);
			transform.extend(FooNumberGenerator);

			const schema = z.object({
				foo: z.number(),
				other: z.number(),
			});
			const result = transform.fromSchema(schema);
			type schemaType = z.infer<typeof schema>;

			expect((result as schemaType).foo).toBe(4);
			expect((result as schemaType).other).toBeTypeOf('number');
		});
	});

	test('merges partial nested defaults with the transformer defaults', () => {
		const transform = new ConstrainedTransformer({
			string: { min: 3, max: 3 },
		});
		transform.extend(StringGenerator);

		const instance = transform.fromSchema(z.string());
		const schemaLevel = transform.fromSchema(z.string(), {
			string: { max: 5 },
		});

		expect(instance).toMatch(/^[a-z-]{3}$/);
		expect(schemaLevel).toMatch(/^[a-z-]{3,5}$/);
	});

	test('matches a generator for a Zod class with a minified name', () => {
		// Minifiers can rename classes; `e` stands in for a mangled ZodString.
		class e extends z.ZodString {}
		const transform = new ConstrainedTransformer().extend(
			Generator({ schema: e, output: () => 'matched' }),
		);

		expect(transform.fromSchema(new e(z.string()._def))).toBe('matched');
	});
});
