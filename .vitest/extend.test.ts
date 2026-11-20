import { Fixture } from '@/fixture';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { findUncheckable } from './uncheckable';

describe('toReasonablySatisfy', () => {
	const fixture = new Fixture();

	test.each([
		['a transform', z.string().transform((s) => s.length), /\.transform\(\)/],
		[
			'a nested transform, with its path',
			z.object({ user: z.object({ age: z.string().transform(Number) }) }),
			/\.transform\(\) at user\.age/,
		],
		['a preprocess', z.preprocess((v) => v, z.string()), /z\.preprocess\(\)/],
		[
			'a pipe into coercion',
			z.string().pipe(z.coerce.number()),
			/\.pipe\(\) into a coercing schema/,
		],
		['a root catch', z.string().catch('fallback'), /\.catch\(\)/],
		[
			'a branded root catch',
			z.string().catch('fallback').brand('x'),
			/\.catch\(\)/,
		],
	])('refuses %s', (_name, schema, message) => {
		expect(() => expect(fixture).toReasonablySatisfy(schema, 1)).toThrow(
			message,
		);
	});

	test('refuses .not', () => {
		expect(() =>
			expect(fixture).not.toReasonablySatisfy(z.string(), 1),
		).toThrow(/does not support \.not/);
	});

	test.each([
		['a refinement', z.string().refine(() => true)],
		['a pipe without transforms', z.string().pipe(z.string().min(3))],
		['coercion at the root', z.coerce.number()],
		['a nested catch', z.object({ name: z.string().catch('fallback') })],
		['a default', z.string().default('x')],
	])('accepts %s', (_name, schema) => {
		expect(findUncheckable(schema)).toBeUndefined();
		expect(fixture).toReasonablySatisfy(schema, 10);
	});

	test('terminates on recursive schemas', () => {
		type Node = { children: Node[] };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.object({ children: z.array(node) }),
		);
		expect(findUncheckable(node)).toBeUndefined();

		const makeNode = (): z.ZodTypeAny =>
			z.lazy(() => z.object({ children: z.array(makeNode()) }));
		expect(findUncheckable(makeNode())).toBeUndefined();
	});

	test('finds transforms behind recursion', () => {
		type Node = { name: number; children: Node[] };
		const node: z.ZodType<Node, z.ZodTypeDef, unknown> = z.lazy(() =>
			z.object({
				name: z.string().transform(Number),
				children: z.array(node),
			}),
		);
		expect(findUncheckable(node)).toMatch(/\.transform\(\) at name/);
	});
});
