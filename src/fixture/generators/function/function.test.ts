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

	// BUG: the generated function is a noop, so returns() always fails.
	test.fails('returns a value matching returns()', () => {
		const schema = z.function().returns(z.number());
		const fn = schema.parse(fixture.fromSchema(schema));
		expect(() => fn()).not.toThrow();
	});
});
