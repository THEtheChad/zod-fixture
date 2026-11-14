import { Fixture } from '@/fixture';
import { ZodString } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { DefaultGenerator } from '.';
import { ArrayGenerator } from '../array';
import { StringGenerator } from '../string';

describe('create default', () => {
	const transform = new ConstrainedTransformer().extend([
		ArrayGenerator,
		DefaultGenerator,
		StringGenerator,
	]);

	const schema = z.string().default('test');

	test('produce deterministic results', () => {
		const result1 = transform.fromSchema(schema.array(), {
			seed: 1,
			array: { min: 20, max: 20 },
		});

		expect(result1).toStrictEqual([
			'zadi-dgckfkjskz',
			'lisoflxgaosylmp',
			'test',
			'test',
			'vvt-vicsnxxywcw',
			'test',
			'test',
			'test',
			'test',
			'cqlszlofshidsvw',
			'test',
			'test',
			'test',
			'-ruihmvfcbmmych',
			'ddoacsyfyhinpbp',
			'dzphsgcolzsnlob',
			'brdnvzapxyodmdy',
			'koerzjjpurtdxsq',
			'jjuhjyulx-arnqb',
			'test',
		]);

		const result2 = transform.fromSchema(schema.array(), {
			seed: 2,
			array: { min: 20, max: 20 },
		});

		expect(result2).toStrictEqual([
			'test',
			'test',
			'zlnliiefsqdinhr',
			'osdnnpetvgxonkw',
			'test',
			'test',
			'ibhldcednqpgfcu',
			'test',
			'emjfmrrnvnrkqv-',
			'eesx-nnfy-jipgl',
			'jumohzvovczjwwn',
			'test',
			'test',
			'test',
			'lbx-z-nvsqtumez',
			'test',
			'test',
			'jubz-tlnnxiohpk',
			'test',
			'taktajvfhjpxajr',
		]);
	});

	test('produces a valid fixture', () => {
		expect(transform).toReasonablySatisfy(schema);
	});
});

const NameGenerator = Generator({
	schema: ZodString,
	filter: ({ context }) => context.path.at(-1) === 'name',
	output: () => 'NAME',
});

describe('regressions', () => {
	test('passes path context to the inner type', () => {
		const fixture = new Fixture().extend(NameGenerator);
		const schema = z.object({ name: z.string().default('default') });
		for (let seed = 0; seed < 20; seed++) {
			expect(fixture.fromSchema(schema, { seed })).toMatchObject({
				name: expect.stringMatching(/^(NAME|default)$/),
			});
		}
	});

	test('runs the default through the inner schema', () => {
		const schema = z
			.string()
			.transform((value) => value.length)
			.default('four');

		for (let seed = 0; seed < 20; seed++) {
			expect(new Fixture().fromSchema(schema, { seed })).toBeTypeOf('number');
		}
	});

	test('passes the path when parsing the default', () => {
		const schema = z.object({
			name: z
				.string()
				.transform((_, ctx) => ctx.path.join('.'))
				.default('four'),
		});
		for (let seed = 0; seed < 20; seed++) {
			expect(new Fixture().fromSchema(schema, { seed })).toEqual({
				name: 'name',
			});
		}
	});
});
