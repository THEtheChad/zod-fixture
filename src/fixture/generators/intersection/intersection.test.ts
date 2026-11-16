import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { IntersectionGenerator } from '.';
import { ArrayGenerator } from '../array';
import { BooleanGenerator } from '../boolean';
import { ObjectGenerator } from '../object';

describe('create intersections', () => {
	const transform = new ConstrainedTransformer().extend([
		IntersectionGenerator,
		ObjectGenerator,
		BooleanGenerator,
		ArrayGenerator,
	]);

	test('produces a valid intersection', () => {
		const left = z.object({
			left: z.boolean(),
		});

		const right = z.object({
			right: z.boolean(),
		});

		expect(transform).toReasonablySatisfy(z.intersection(left, right));
	});

	test('creates an intersection of objects', () => {
		const left = z.object({
			left: z.boolean(),
		});

		const right = z.object({
			right: z.boolean(),
		});

		const intersection = z.intersection(left, right);
		const result = transform.fromSchema(intersection);

		expect(result).toHaveProperty('left');
		expect(result).toHaveProperty('right');
		expect(result).toMatchObject({
			left: expect.any(Boolean),
			right: expect.any(Boolean),
		});
	});

	test('creates an intersection of arrays', () => {
		const left = z
			.object({
				left: z.boolean(),
			})
			.array();

		const right = z
			.object({
				right: z.boolean(),
			})
			.array();

		const intersection = z.intersection(left, right);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = transform.fromSchema(intersection) as any[];

		expect(result[0]).toHaveProperty('left');
		expect(result[0]).toHaveProperty('right');
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('intersects two string schemas', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().min(3).and(z.string().max(10)),
		);
	});

	test('intersects two number schemas', () => {
		expect(fixture).toReasonablySatisfy(
			z.number().min(0).and(z.number().max(10)),
		);
	});

	test('intersects objects that share a key', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.object({ a: z.string(), b: z.number() })
				.and(z.object({ a: z.string().min(1) })),
		);
	});

	test('intersects overlapping enums', () => {
		expect(fixture).toReasonablySatisfy(
			z.enum(['a', 'b', 'c']).and(z.enum(['b', 'c', 'd'])),
		);
	});

	test('intersects a union with a literal', () => {
		expect(fixture).toReasonablySatisfy(
			z.union([z.literal('x'), z.number()]).and(z.literal('x')),
		);
	});

	test('intersects nested objects that share a key', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.object({ user: z.object({ id: z.string(), age: z.number().min(18) }) })
				.and(
					z.object({
						user: z.object({ id: z.string().min(5), age: z.number().max(30) }),
					}),
				),
		);
	});

	test('intersects array lengths and items', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.array(z.object({ a: z.string() }))
				.min(2)
				.and(z.array(z.object({ b: z.number() })).max(4)),
		);
	});

	test('throws for an unsatisfiable intersection', () => {
		expect(() =>
			fixture.fromSchema(z.literal('a').and(z.literal('b'))),
		).toThrowError(
			'Unable to generate a value that satisfies every side of the intersection.',
		);
	});

	test('intersects a chain of objects', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.object({ a: z.string() })
				.and(z.object({ b: z.number() }))
				.and(z.object({ c: z.boolean() })),
		);
	});

	test('returns the merged output of transformed sides', () => {
		const length = z.string().transform((value) => value.length);
		expect(fixture.fromSchema(length.and(length))).toBeTypeOf('number');
		expect(
			fixture.fromSchema(
				z
					.object({ a: z.string().transform(Number) })
					.and(z.object({ b: z.number() })),
			),
		).toMatchObject({ a: expect.any(Number), b: expect.any(Number) });
	});

	test('throws when transformed outputs cannot be merged', () => {
		const schema = z
			.string()
			.transform(() => 'x')
			.and(z.string().transform(() => 'y'));
		expect(() => fixture.fromSchema(schema)).toThrowError(
			'Unable to generate a value that satisfies every side of the intersection.',
		);
	});

	test("respects the other side's catchall for declared keys", () => {
		expect(fixture).toReasonablySatisfy(
			z
				.object({})
				.catchall(z.literal('only'))
				.and(z.object({ a: z.string() })),
		);
	});

	test('falls back to an empty array when items cannot agree', () => {
		expect(
			fixture.fromSchema(z.array(z.literal('a')).and(z.array(z.literal('b')))),
		).toEqual([]);
	});

	test('ends recursion through an intersection of arrays', () => {
		type Node = Node[];
		const node: z.ZodType<Node> = z.lazy(() =>
			z.array(node).and(z.array(node)),
		);
		expect(fixture).toReasonablySatisfy(node);
	});

	test('intersects a union of objects with an object', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.union([z.object({ a: z.literal(1) }), z.object({ a: z.literal(2) })])
				.and(z.object({ b: z.string() })),
		);
	});

	test('intersects a discriminated union with an object', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.discriminatedUnion('type', [
					z.object({ type: z.literal('a'), a: z.string() }),
					z.object({ type: z.literal('b'), b: z.number() }),
				])
				.and(z.object({ id: z.string() })),
		);
	});

	test('intersects overlapping unions', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.union([z.literal('a'), z.literal('b')])
				.and(z.union([z.literal('b'), z.literal('c')])),
		);
	});

	test.each([
		['a refinement', z.object({ b: z.number() }).refine((v) => v.b > 0)],
		['a lazy schema', z.lazy(() => z.object({ b: z.number() }))],
		['a branded schema', z.object({ b: z.number() }).brand<'B'>()],
		['a readonly schema', z.object({ b: z.number() }).readonly()],
		['a default', z.object({ b: z.number() }).default({ b: 1 })],
	])('intersects an object with %s', (_, other) => {
		expect(fixture).toReasonablySatisfy(z.object({ a: z.string() }).and(other));
	});

	test('intersects an optional key with a required one', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.object({ u: z.object({ id: z.string() }).optional() })
				.and(z.object({ u: z.object({ name: z.string() }) })),
		);
	});

	test('ends recursion through an intersection of a lazy schema with itself', () => {
		type Node = { name: string; child?: Node };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.object({ name: z.string(), child: node.optional() }),
		);
		expect(fixture).toReasonablySatisfy(node.and(node));
	});
});
