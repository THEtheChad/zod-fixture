import { Fixture } from '@/fixture';
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
			      "subcategories": [
			        {
			          "name": "vvt-vicsnxxywcw",
			          "subcategories": null,
			        },
			        {
			          "name": "bxscqlszlofshid",
			          "subcategories": null,
			        },
			        {
			          "name": "wlaauq-ruihmvfc",
			          "subcategories": null,
			        },
			      ],
			    },
			    {
			      "name": "ychyhddoacsyfyh",
			      "subcategories": null,
			    },
			    {
			      "name": "bppqdzphsgcolzs",
			      "subcategories": null,
			    },
			  ],
			}
		`);
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	// BUG: the recursion guard counts visits, not depth, and omits required keys at the cap.
	test.fails('supports the recursive category schema from the Zod docs', () => {
		const baseCategorySchema = z.object({ name: z.string() });
		type Category = z.infer<typeof baseCategorySchema> & {
			subcategories: Category[];
		};
		const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
			subcategories: z.lazy(() => categorySchema.array()),
		});
		expect(fixture).toReasonablySatisfy(categorySchema);
	});

	test.fails('generates a recursive schema used by sibling keys', () => {
		type Tree = { value: string; children: Tree[] };
		const tree: z.ZodType<Tree> = z.lazy(() =>
			z.object({ value: z.string(), children: z.array(tree) }),
		);
		expect(fixture).toReasonablySatisfy(z.object({ left: tree, right: tree }));
	});

	test.fails('supports a non-recursive lazy schema reused across keys', () => {
		const lazy = z.lazy(() => z.string());
		expect(fixture).toReasonablySatisfy(
			z.object({ a: lazy, b: lazy, c: lazy }),
		);
	});

	// BUG: unbounded recursion returns invalid data instead of throwing.
	test.fails('throws for recursion that cannot terminate', () => {
		type Node = { children: Node[] };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.object({ children: z.array(node).min(1) }),
		);
		expect(() => fixture.fromSchema(node)).toThrow();
	});
});
