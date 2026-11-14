import { Fixture, UnconstrainedFixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { LazyGenerator } from '.';
import { ArrayGenerator } from '../array';
import { NullableGenerator } from '../nullable';
import { ObjectGenerator } from '../object';
import { StringGenerator } from '../string';

describe('create a lazy type', () => {
	const transform = new ConstrainedTransformer({ seed: 1 }).extend([
		LazyGenerator,
		StringGenerator,
		ObjectGenerator,
		ArrayGenerator,
		NullableGenerator,
	]);

	test('should handle recursive schemas', () => {
		const baseCategorySchema = z.object({
			name: z.string(),
		});

		type Category = z.infer<typeof baseCategorySchema> & {
			subcategories?: Category[] | null;
		};

		const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
			subcategories: z.lazy(() => categorySchema.array()).nullable(),
		});

		expect(() => transform.fromSchema(categorySchema)).not.toThrowError();
		expect(transform.fromSchema(categorySchema)).toMatchInlineSnapshot(`
			{
			  "name": "-tzadi-dgckfkjs",
			  "subcategories": [
			    {
			      "name": "lisoflxgaosylmp",
			      "subcategories": [],
			    },
			    {
			      "name": "zfvvt-vicsnxxyw",
			      "subcategories": [],
			    },
			    {
			      "name": "bhebxscqlszlofs",
			      "subcategories": [],
			    },
			  ],
			}
		`);
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('supports the recursive category schema from the Zod docs', () => {
		const baseCategorySchema = z.object({ name: z.string() });
		type Category = z.infer<typeof baseCategorySchema> & {
			subcategories: Category[];
		};
		const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
			subcategories: z.lazy(() => categorySchema.array()),
		});
		expect(fixture).toReasonablySatisfy(categorySchema);
	});

	test('generates a recursive schema used by sibling keys', () => {
		type Tree = { value: string; children: Tree[] };
		const tree: z.ZodType<Tree> = z.lazy(() =>
			z.object({ value: z.string(), children: z.array(tree) }),
		);
		expect(fixture).toReasonablySatisfy(z.object({ left: tree, right: tree }));
	});

	test('supports a non-recursive lazy schema reused across keys', () => {
		const lazy = z.lazy(() => z.string());
		expect(fixture).toReasonablySatisfy(
			z.object({ a: lazy, b: lazy, c: lazy }),
		);
	});

	test('throws for recursion that cannot terminate', () => {
		type Node = { children: Node[] };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.object({ children: z.array(node).min(1) }),
		);
		expect(() => fixture.fromSchema(node)).toThrow();
	});

	test('ends recursion through a union of a JSON-like schema', () => {
		const literal = z.union([z.string(), z.number(), z.boolean(), z.null()]);
		type Json = z.infer<typeof literal> | Json[] | { [key: string]: Json };
		const json: z.ZodType<Json> = z.lazy(() =>
			z.union([literal, z.array(json), z.record(json)]),
		);
		expect(fixture).toReasonablySatisfy(
			z.object({ meta: json, payload: json, extra: json }),
		);
	});

	test('supports a lazy schema reused across tuple items', () => {
		const lazy = z.lazy(() => z.string());
		expect(fixture).toReasonablySatisfy(z.tuple([lazy, lazy, lazy]));
	});

	test('supports recursion with the unconstrained fixture', () => {
		type Tree = { value: string; children: Tree[] };
		const tree: z.ZodType<Tree> = z.lazy(() =>
			z.object({ value: z.string(), children: z.array(tree) }),
		);
		expect(new UnconstrainedFixture()).toReasonablySatisfy(tree);
	});

	test('limits nesting to the configured recursion depth', () => {
		type Tree = { children: Tree[] };
		const tree: z.ZodType<Tree> = z.lazy(() =>
			z.object({ children: z.array(tree) }),
		);
		const depth = (node: Tree): number =>
			1 + Math.max(0, ...node.children.map(depth));

		for (let seed = 0; seed < 20; seed++) {
			const result = fixture.fromSchema(tree, {
				seed,
				recursion: { min: 3, max: 3 },
			}) as Tree;
			expect(depth(result)).toBe(3);
		}
	});

	test('explains recursion that cannot terminate', () => {
		type Node = { children: Node[] };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.object({ children: z.array(node).min(1) }),
		);
		expect(() => fixture.fromSchema(z.object({ root: node }))).toThrowError(
			'Unable to generate a fixture: the recursive schema at root never terminates.',
		);
	});

	test('ends recursion through a lazy union option that terminates', () => {
		const leaf = z.lazy(() => z.literal('leaf'));
		type Node = 'leaf' | { child: Node };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.union([leaf, z.object({ child: node })]),
		);
		expect(fixture).toReasonablySatisfy(node);
	});

	test('ends recursion through a discriminated union', () => {
		type Node = { type: 'leaf' } | { type: 'node'; child: Node };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.discriminatedUnion('type', [
				z.object({ type: z.literal('node'), child: node }),
				z.object({ type: z.literal('leaf') }),
			]),
		);
		expect(fixture).toReasonablySatisfy(node);
	});

	test('supports many distinct nested lazy schemas', () => {
		let schema: z.ZodTypeAny = z.string();
		for (let i = 0; i < 40; i++) {
			const inner = schema;
			schema = z.lazy(() => inner);
		}
		expect(fixture).toReasonablySatisfy(schema);
	});

	test('ends recursion built from a fresh lazy schema per level', () => {
		type Tree = { value: string; children: Tree[] };
		const tree = (): z.ZodType<Tree> =>
			z.lazy(() => z.object({ value: z.string(), children: z.array(tree()) }));
		expect(fixture).toReasonablySatisfy(tree(), 100);
	});

	test('explains required recursion built from fresh lazy schemas', () => {
		type Node = { child: Node };
		const node = (): z.ZodType<Node> =>
			z.lazy(() => z.object({ child: node() }));
		expect(() => fixture.fromSchema(z.object({ root: node() }))).toThrowError(
			'Unable to generate a fixture: the recursive schema at root never terminates.',
		);
	});

	test('ends recursion through a fresh lazy schema inside an array', () => {
		const tree = (): z.ZodTypeAny =>
			z.object({ name: z.string(), children: z.array(z.lazy(() => tree())) });
		expect(fixture).toReasonablySatisfy(tree(), 100);
		expect(new UnconstrainedFixture()).toReasonablySatisfy(tree(), 100);
	});
});
