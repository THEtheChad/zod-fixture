import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { FunctionGenerator } from '.';

describe('create Functions', () => {
	const transform = new ConstrainedTransformer().extend([FunctionGenerator]);

	test('produces a valid function', () => {
		expect(transform).toReasonablySatisfy(z.function());
	});

	test('creates a function', () => {
		expect(transform.fromSchema(z.function())).toBeTypeOf('function');
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('returns a value matching returns()', () => {
		const schema = z.function().returns(z.number());
		const fn = schema.parse(fixture.fromSchema(schema));
		expect(() => fn()).not.toThrow();
	});

	test('returns an input for a transforming returns()', () => {
		const schema = z.function().returns(z.string().transform(() => 42));
		const fn = schema.parse(fixture.fromSchema(schema));
		expect(fn()).toBe(42);
	});

	test('throws when called for returns(never)', () => {
		const fn = fixture.fromSchema(
			z.function().returns(z.never()),
		) as () => never;
		expect(() => fn()).toThrowError('This function returns never.');
	});

	test('supports a return type that refers back to the schema', () => {
		type Node = { id: number; next: () => Node };
		const node: z.ZodType<Node> = z.lazy(() =>
			z.object({ id: z.number(), next: z.function().returns(node) }),
		);
		const parsed = node.parse(new Fixture().fromSchema(node));
		expect(parsed.next().next().id).toBeTypeOf('number');
	});
});
