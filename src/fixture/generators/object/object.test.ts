import { Fixture, UnconstrainedFixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { ObjectGenerator, RecordGenerator } from '.';
import { AnyGenerator } from '../any';
import { ArrayGenerator } from '../array';
import { BigIntGenerator } from '../bigint';
import { BooleanGenerator } from '../boolean';
import { DateGenerator } from '../date';
import { MapGenerator } from '../map';
import { NanGenerator } from '../nan';
import { NullGenerator } from '../null';
import { NumberGenerator } from '../number';
import { PromiseGenerator } from '../promise';
import { SetGenerator } from '../set';
import { StringGenerator } from '../string';
import { SymbolGenerator } from '../symbol';
import { UndefinedGenerator } from '../undefined';

describe('create objects', () => {
	const transform = new ConstrainedTransformer().extend([
		ObjectGenerator,
		StringGenerator,
		NumberGenerator,
		AnyGenerator,
		UndefinedGenerator,
		NullGenerator,
		BooleanGenerator,
		BigIntGenerator,
		DateGenerator,
		SymbolGenerator,
		NanGenerator,
		ArrayGenerator,
		MapGenerator,
		SetGenerator,
		PromiseGenerator,
		RecordGenerator,
	]);

	test('produces a valid empty object', () => {
		expect(transform).toReasonablySatisfy(z.object({}));
	});

	test('creates an empty object', () => {
		expect(transform.fromSchema(z.object({}))).toBeTypeOf('object');
	});

	test('produces a valid object', () => {
		expect(transform).toReasonablySatisfy(
			z.object({
				str: z.string(),
				num: z.number(),
			}),
		);
	});

	test('creates an object', () => {
		const input = z.object({
			str: z.string(),
			num: z.number(),
		});

		type I = z.infer<typeof input>;

		const result = transform.fromSchema(input);

		expect(result).toBeTypeOf('object');
		expect((result as I).str).toBeTypeOf('string');
		expect((result as I).num).toBeTypeOf('number');
	});

	test('produces a valid nested object', () => {
		expect(transform).toReasonablySatisfy(
			z.object({
				str: z.string(),
				nested: z.object({
					num: z.number(),
					str: z.string(),
				}),
			}),
		);
	});

	test('creates a nested object', () => {
		const input = z.object({
			str: z.string(),
			nested: z.object({
				num: z.number(),
				str: z.string(),
			}),
		});

		type I = z.infer<typeof input>;

		const result = transform.fromSchema(input);
		expect(result).toBeTypeOf('object');
		expect((result as I).str).toBeTypeOf('string');
		expect((result as I).nested.num).toBeTypeOf('number');
	});

	test("creates an object with zod's api", () => {
		const BaseTeacher = z.object({ name: z.string() });
		const HasID = z.object({ id: z.string() });
		const Teacher = BaseTeacher.merge(HasID);

		type BaseTeacher = z.infer<typeof BaseTeacher>;
		type HasID = z.infer<typeof HasID>;

		const result = transform.fromSchema(Teacher);
		expect(result).toBeTypeOf('object');
		expect((result as HasID).id).toBeTypeOf('string');
		expect((result as BaseTeacher).name).toBeTypeOf('string');
	});

	test('creates an object with additional keys for passthrough', () => {
		const input = z
			.object({
				str: z.string(),
				num: z.number(),
			})
			.passthrough();

		type I = z.infer<typeof input>;

		const result = transform.fromSchema(input);

		expect(result).toBeTypeOf('object');
		expect((result as I).str).toBeTypeOf('string');
		expect((result as I).num).toBeTypeOf('number');
		expect(Object.keys(result as I).length).toBeGreaterThan(2);
	});
});

describe('create Records', () => {
	const transform = new ConstrainedTransformer().extend([
		RecordGenerator,
		StringGenerator,
		NumberGenerator,
	]);

	test('produces a valid record', () => {
		expect(transform).toReasonablySatisfy(z.record(z.number()));
	});

	test('creates a record with 3 entries', () => {
		const input = z.record(z.number());
		const result = transform.fromSchema(input);

		type I = z.infer<typeof input>;

		expect(Object.keys(result as I)).toHaveLength(3);
		expect(Object.keys(result as I)[0]).toBeTypeOf('string');
		expect(Object.values(result as I)[0]).toBeTypeOf('number');
	});

	test('creates a record with a defined key type', () => {
		const input = z.record(z.string(), z.string());
		const result = transform.fromSchema(input);

		type I = z.infer<typeof input>;

		expect(Object.keys(result as I)[0]).toBeTypeOf('string');
		expect(Object.values(result as I)[0]).toBeTypeOf('string');
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('never overwrites a declared key with a passthrough key', () => {
		expect(fixture).toReasonablySatisfy(
			z.object({ dolor: z.number() }).passthrough(),
		);
	});

	test('never overwrites a declared key with a catchall key', () => {
		expect(fixture).toReasonablySatisfy(
			z.object({ dolor: z.number() }).catchall(z.string()),
		);
	});

	test.each([
		['an enum', z.enum(['a', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', 'd', 'e']],
		[
			'a union of literals',
			z.union([z.literal('x'), z.literal('y')]),
			['x', 'y'],
		],
	])('fills a record keyed by %s with every key', (_, keyType, keys) => {
		const schema = z.record(keyType, z.number());
		for (const fixture of [new Fixture(), new UnconstrainedFixture()]) {
			for (let seed = 0; seed < 20; seed++) {
				expect(
					Object.keys(fixture.fromSchema(schema, { seed }) as object).sort(),
				).toEqual(keys);
			}
		}
	});

	test('uses lorem words without punctuation as passthrough keys', () => {
		for (let seed = 0; seed < 200; seed++) {
			const keys = Object.keys(
				fixture.fromSchema(z.object({}).passthrough(), { seed }) as object,
			);
			expect(keys).toHaveLength(1);
			expect(keys[0]).toMatch(/^[a-z]+$/);
		}
	});
});
