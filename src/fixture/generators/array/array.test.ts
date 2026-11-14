import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { ArrayGenerator } from '.';
import { NumberGenerator } from '../number';
import { StringGenerator } from '../string';

describe('create Arrays', () => {
	const transform = new ConstrainedTransformer().extend([
		ArrayGenerator,
		StringGenerator,
		NumberGenerator,
	]);

	test('produces a valid array', () => {
		expect(transform).toReasonablySatisfy(z.array(z.number()));
	});

	test('creates an array with the length of 3', () => {
		expect(transform.fromSchema(z.array(z.string()))).toHaveLength(3);
		expect(transform.fromSchema(z.number().array())).toHaveLength(3);
	});

	test('throws when min is greater than max', () => {
		expect(() =>
			transform.fromSchema(z.array(z.string()).min(10).max(5)),
		).toThrowError();
	});

	test('should honor the constraints of the schema', () => {
		const schema = z.string().array().min(5);
		const fixture = transform.fromSchema(schema);
		expect(() => schema.parse(fixture)).not.toThrowError();
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	// BUG: length can be overridden by min/max.
	test.fails('lets length win over min and max', () => {
		expect(fixture).toReasonablySatisfy(
			z.array(z.string()).min(1).max(10).length(5),
		);
	});
});
