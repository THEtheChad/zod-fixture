import { Fixture } from '@/fixture';
import { ConstrainedTransformer } from '@/transformer/transformer';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import {
	Cuid2Generator,
	CuidGenerator,
	DateTimeGenerator,
	EmailGenerator,
	IpGenerator,
	RegexGenerator,
	StringGenerator,
	UlidGenerator,
	UrlGenerator,
	UuidGenerator,
} from '.';
import { ITERATIONS } from '../../../../.vitest/utils';
import { ObjectGenerator } from '../object';

describe('create strings', () => {
	const transform = new ConstrainedTransformer().extend([
		IpGenerator,
		UlidGenerator,
		UuidGenerator,
		CuidGenerator,
		Cuid2Generator,
		UrlGenerator,
		EmailGenerator,
		DateTimeGenerator,
		RegexGenerator,
		StringGenerator,
		ObjectGenerator,
	]);

	test('produces a valid string', () => {
		expect(transform).toReasonablySatisfy(z.string());
	});

	test('creates a string', () => {
		expect(transform.fromSchema(z.string())).toBeTypeOf('string');
	});

	test('produces a valid string with length', () => {
		expect(transform).toReasonablySatisfy(z.string().length(60));
	});

	test('creates a string with a fixed length', () => {
		expect(transform.fromSchema(z.string().length(5))).toHaveLength(5);
	});

	test('produces a valid string with min and max', () => {
		expect(transform).toReasonablySatisfy(z.string().min(3).max(9));
	});

	test('creates a string with a min length', () => {
		expect(
			(transform.fromSchema(z.string().min(100)) as string).length,
		).toBeGreaterThanOrEqual(100);
	});

	test('creates a string with a max length', () => {
		expect(
			(transform.fromSchema(z.string().max(2)) as string).length,
		).toBeLessThanOrEqual(2);
	});

	test('throws when min is greater than max', () => {
		expect(() =>
			transform.fromSchema(z.string().min(50).max(40)),
		).toThrowError();
	});

	test('throws when min is negative', () => {
		expect(() => transform.fromSchema(z.string().min(-1))).toThrowError();
	});

	test('produces a valid string that is a uuid', () => {
		expect(transform).toReasonablySatisfy(z.string().uuid());
	});

	test('creates a string that is a uuid', () => {
		expect(transform.fromSchema(z.string().uuid())).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});

	test('creates object with string property of length', () => {
		const schema = z.object({
			lastFour: z.string().length(4),
		});
		const fixture = transform.fromSchema(schema) as z.infer<typeof schema>;
		expect(fixture.lastFour).toHaveLength(4);
	});

	test('produces a valid string that is a cuid', () => {
		expect(transform).toReasonablySatisfy(z.string().cuid());
	});

	test('produces a valid string that is a cuid2', () => {
		expect(transform).toReasonablySatisfy(z.string().cuid2());
	});

	test('produces a valid string that is a email', () => {
		expect(transform).toReasonablySatisfy(z.string().email());
	});

	test('creates a string that is an email', () => {
		const email = transform.fromSchema(z.string().email());
		expect(email).include('@');
		expect(email).include('.');
	});

	test('produces a valid string that is a lowercase', () => {
		expect(transform).toReasonablySatisfy(z.string().toLowerCase());
	});

	test('creates a string is lowercase', () => {
		const lowercase = transform.fromSchema(z.string().toLowerCase());
		expect(lowercase).toMatch(/^[^A-Z]*$/);
	});

	test('produces a valid string that is a uppercase', () => {
		expect(transform).toReasonablySatisfy(z.string().toUpperCase());
	});

	test('creates a string is uppercase', () => {
		const uppercase = transform.fromSchema(z.string().toUpperCase());
		expect(uppercase).toMatch(/^[^a-z]*$/);
	});

	test('creates a valid ulid', () => {
		expect(transform).toReasonablySatisfy(z.string().ulid());
	});

	test('produces a valid string with a start and end', () => {
		expect(transform).toReasonablySatisfy(
			z.string().startsWith('begin').endsWith('end'),
		);
	});

	test('creates a string that startsWith', () => {
		const value = transform.fromSchema(
			z.string().startsWith('start_'),
		) as string;
		expect(value.startsWith('start_')).toBeTruthy();
	});

	test('creates a string that endsWith', () => {
		const value = transform.fromSchema(z.string().endsWith('_end')) as string;
		expect(value.endsWith('_end')).toBeTruthy();
	});

	test('creates a string that startsWith and endsWith', () => {
		const value = transform.fromSchema(
			z.string().startsWith('start_').endsWith('_end'),
		) as string;
		expect(value.startsWith('start_')).toBeTruthy();
		expect(value.endsWith('_end')).toBeTruthy();
	});

	test('produces a valid string that is a url', () => {
		expect(transform).toReasonablySatisfy(z.string().url());
	});

	test('creates a string that is an URL', () => {
		const url = transform.fromSchema(z.string().url());
		expect(url).toMatch(
			/(?:https?):\/\/(\w+:?\w*)?(\S+)(:\d+)?(\/|\/([\w#!:.?+=&%!\-/]))?/,
		);
	});

	test('creates a small string using length', () => {
		const value = transform.fromSchema(z.string().length(2));
		expect(value).toHaveLength(2);
	});

	test('creates a large string using length', () => {
		const value = transform.fromSchema(z.string().length(6000));
		expect(value).toHaveLength(6000);
	});

	test('creates a string with endsWith', () => {
		const value = transform.fromSchema(
			z.string().startsWith('foxy').includes('mama'),
		) as string;
		expect(value.startsWith('foxy')).toBeTruthy();
		expect(value.includes('mama')).toBeTruthy();
	});

	test('correctly trims string', () => {
		const value = transform.fromSchema(z.string().endsWith('     ').trim());
		expect(value).toHaveLength(10);
	});

	test('correctly creates an emoji string', () => {
		expect(transform).toReasonablySatisfy(z.string().emoji());
	});

	test('creates a large string using length with startsWith and endsWith', () => {
		const value = transform.fromSchema(
			z.string().length(6000).startsWith('start_').endsWith('_end'),
		) as string;
		expect(value).toHaveLength(6000);
		expect(value.startsWith('start_')).toBeTruthy();
		expect(value.endsWith('_end')).toBeTruthy();
	});

	test('creates a proper IP address', () => {
		expect(transform).toReasonablySatisfy(z.string().ip());
		expect(transform).toReasonablySatisfy(z.string().ip({ version: 'v4' }));
		expect(transform).toReasonablySatisfy(z.string().ip({ version: 'v6' }));
	});

	test('creates a large string using min and max', () => {
		const value = transform.fromSchema(
			z.string().min(6000).max(7000).startsWith('start_').endsWith('_end'),
		) as string;
		expect(value.length).toBeGreaterThanOrEqual(6000);
		expect(value.length).toBeLessThanOrEqual(7000);
		expect(value.startsWith('start_')).toBeTruthy();
		expect(value.endsWith('_end')).toBeTruthy();
	});

	test('produces a valid string that is a datetime', () => {
		expect(transform).toReasonablySatisfy(z.string().datetime());
	});

	test('produces a valid string that is a datetime', () => {
		expect(transform.fromSchema(z.string().datetime())).toBeTypeOf('string');
		expect(
			new Date(transform.fromSchema(z.string().datetime()) as string),
		).toBeInstanceOf(Date);
	});

	test('creates a string that follows a regexp', () => {
		expect(transform.fromSchema(z.string().regex(/aBc/))).toBeTypeOf('string');
		expect(transform.fromSchema(z.string().regex(/aBc/))).toBe('aBc');
	});

	test('regexp uses our seed', () => {
		const values = Array.from({
			length: ITERATIONS,
		}).map(() =>
			transform.fromSchema(z.string().regex(/(0|1|2)(aBc|123).?xyz/i), {
				seed: 3,
			}),
		);
		const uniques = new Set(values);
		expect(uniques.size).toBe(1);
	});

	test('produces a valid string that is a regexp', () => {
		expect(transform).toReasonablySatisfy(
			z
				.string()
				.regex(
					/^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/gm,
				),
		);
	});
});

describe('regressions', () => {
	const fixture = new Fixture();

	test('supports a regex inside an array', () => {
		expect(fixture).toReasonablySatisfy(z.array(z.string().regex(/^[a-z]+$/)));
	});

	test('supports one regex shared by two fields', () => {
		const pattern = /^[a-z]+$/;
		expect(fixture).toReasonablySatisfy(
			z.object({ a: z.string().regex(pattern), b: z.string().regex(pattern) }),
		);
	});

	test('keeps an email valid with a long min', () => {
		expect(fixture).toReasonablySatisfy(z.string().email().min(25));
	});

	test('keeps an email valid with a short max', () => {
		expect(fixture).toReasonablySatisfy(z.string().email().max(10));
	});

	test('keeps a url valid with a short max', () => {
		expect(fixture).toReasonablySatisfy(z.string().url().max(8));
	});

	test('keeps a regex match valid with a long min', () => {
		expect(fixture).toReasonablySatisfy(
			z
				.string()
				.regex(/^[a-z]+$/)
				.min(50),
		);
	});

	test('supports a startsWith longer than the default length', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().startsWith('abcdefghijklmnopqrst'),
		);
	});

	test('keeps an email valid with endsWith', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().email().endsWith('@acme.io'),
		);
	});

	test('treats affixes literally', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().startsWith('$&').endsWith('$$'),
		);
	});

	test('respects includes with a position', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().includes('abc', { position: 10 }),
		);
	});

	test('respects the tightest of repeated min checks', () => {
		expect(fixture).toReasonablySatisfy(z.string().min(1).min(20));
	});

	test('throws when includes cannot fit the length', () => {
		expect(() =>
			fixture.fromSchema(z.string().length(3).includes('abcd')),
		).toThrowError(
			'Unable to generate a string with min length 3, max length 3, includes "abcd".',
		);
	});

	test('throws when affixes cannot fit the length', () => {
		expect(() =>
			fixture.fromSchema(
				z.string().startsWith('abc').endsWith('xyz').length(4),
			),
		).toThrow();
	});

	test('throws when an ip cannot fit the max', () => {
		expect(() =>
			fixture.fromSchema(z.string().ip({ version: 'v4' }).max(5)),
		).toThrowError(
			'Unable to generate a string in ip format with max length 5.',
		);
	});

	test('supports date()', () => {
		expect(fixture).toReasonablySatisfy(z.string().date());
	});

	test('supports time()', () => {
		expect(fixture).toReasonablySatisfy(z.string().time());
	});

	test('supports duration()', () => {
		expect(fixture).toReasonablySatisfy(z.string().duration());
	});

	test('supports base64()', () => {
		expect(fixture).toReasonablySatisfy(z.string().base64());
	});

	test('supports nanoid()', () => {
		expect(fixture).toReasonablySatisfy(z.string().nanoid());
	});

	test('respects datetime precision 0', () => {
		expect(fixture).toReasonablySatisfy(z.string().datetime({ precision: 0 }));
	});

	test('respects datetime precision 6', () => {
		expect(fixture).toReasonablySatisfy(z.string().datetime({ precision: 6 }));
	});

	test('fills an odd emoji length', () => {
		expect(fixture).toReasonablySatisfy(z.string().emoji().length(5));
	});

	test('respects a cuid2 length', () => {
		expect(fixture).toReasonablySatisfy(z.string().cuid2().length(10));
	});

	test('upper-cases a uuid', () => {
		expect(fixture).toReasonablySatisfy(z.string().uuid().toUpperCase());
	});

	test('overlaps affixes to fit the length', () => {
		expect(
			fixture.fromSchema(
				z.string().startsWith('abc').endsWith('bcd').length(4),
			),
		).toBe('abcd');
	});

	test('fits a regex match to an exact length', () => {
		expect(fixture).toReasonablySatisfy(z.string().regex(/^\d+$/).length(8));
	});

	test('fits several includes within the max', () => {
		expect(fixture).toReasonablySatisfy(
			z.string().includes('foo').includes('bar').max(10),
		);
	});

	test('keeps an email valid with startsWith', () => {
		expect(fixture).toReasonablySatisfy(z.string().email().startsWith('admin'));
	});

	test('keeps the default email for an unconstrained schema', () => {
		expect(fixture.fromSchema(z.string().email())).toBe('rando@email.com');
	});

	test.each([
		[
			'includes at a position after an equal prefix',
			z.string().startsWith('abc').includes('abc', { position: 3 }).length(6),
		],
		[
			'overlapping includes',
			z.string().includes('abc').includes('bcd').length(4),
		],
		['url with endsWith', z.string().url().endsWith('/api')],
		['url with a host prefix', z.string().url().startsWith('https://api.')],
		['url with a scheme prefix', z.string().url().startsWith('ftp')],
		['long regex matches', z.string().regex(/^a+$/).min(150)],
		[
			'email whose prefix is the local part',
			z.string().email().startsWith('a').length(6),
		],
	])('supports %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test.each([
		['time() with precision 3', z.string().time({ precision: 3 })],
		['time() with precision 0', z.string().time({ precision: 0 })],
		[
			'datetime() with offset and precision',
			z.string().datetime({ offset: true, precision: 2 }),
		],
		['datetime() with local', z.string().datetime({ local: true })],
		['base64() with a length', z.string().base64().length(12)],
		['base64url()', z.string().base64url()],
		['base64url() with a max', z.string().base64url().max(6)],
		['jwt()', z.string().jwt()],
		['jwt() with an algorithm', z.string().jwt({ alg: 'RS256' })],
		['cidr()', z.string().cidr()],
		['cidr() v4', z.string().cidr({ version: 'v4' })],
		['cidr() v6', z.string().cidr({ version: 'v6' })],
	])('supports %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test('validates checks before trim, like Zod', () => {
		expect(fixture.fromSchema(z.string().endsWith('   ').trim())).toMatch(
			/^\S+$/,
		);
	});

	test('throws with the reason when no candidate passes', () => {
		expect(() =>
			fixture.fromSchema(z.string().toLowerCase().startsWith('AB')),
		).toThrowError(
			'Unable to generate a valid string: Invalid input: must start with "AB".',
		);
	});

	test.each([
		['an ipv4 address with max 7', z.string().ip({ version: 'v4' }).max(7)],
		[
			'an ipv4 address with length 9',
			z.string().ip({ version: 'v4' }).length(9),
		],
		['an ip of either version with max 12', z.string().ip().max(12)],
		['a url with length 2', z.string().url().length(2)],
		['an email whose prefix includes @', z.string().email().startsWith('a@')],
		[
			'an email whose prefix includes the domain',
			z.string().email().startsWith('a@ex.io'),
		],
		[
			'several regex checks',
			z
				.string()
				.regex(/^[a-z]+$/)
				.regex(/^z+$/)
				.max(5),
		],
	])('fits %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test.each([
		['an email with includes', z.string().email().includes('+')],
		[
			'an email whose prefix ends with @',
			z.string().email().startsWith('admin@'),
		],
		[
			'a regex with startsWith',
			z
				.string()
				.regex(/^[a-z]+$/)
				.startsWith('ab'),
		],
		[
			'a slug regex within a length range',
			z
				.string()
				.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
				.min(3)
				.max(64),
		],
		[
			'includes overlapping endsWith',
			z.string().includes('xyz').endsWith('yz!').max(5),
		],
		['a uuid with endsWith', z.string().uuid().endsWith('a')],
	])('generates %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test('throws when a nanoid cannot fit the length', () => {
		expect(() => fixture.fromSchema(z.string().nanoid().max(10))).toThrowError(
			'Unable to generate a string in nanoid format with max length 10.',
		);
	});

	test.each([
		['time() with length 5', z.string().time().length(5)],
		['time() with length 8', z.string().time().length(8)],
		['time() with length 14', z.string().time().length(14)],
		['duration() with max 3', z.string().duration().max(3)],
		['duration() with min 30', z.string().duration().min(30)],
	])('fits %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test.each([
		['datetime() with length 17', z.string().datetime().length(17)],
		['datetime() with length 20', z.string().datetime().length(20)],
		['datetime() with length 26', z.string().datetime().length(26)],
	])('fits %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});

	test.each([
		['jwt() with max 100', z.string().jwt().max(100)],
		['jwt() with min 300', z.string().jwt().min(300)],
		['cidr() v4 with max 10', z.string().cidr({ version: 'v4' }).max(10)],
		['cidr() v4 with length 18', z.string().cidr({ version: 'v4' }).length(18)],
		['cidr() with max 12', z.string().cidr().max(12)],
		[
			'cidr() with endsWith',
			z.string().cidr({ version: 'v4' }).endsWith('/24'),
		],
		['date() with endsWith', z.string().date().endsWith('-01')],
	])('fits %s', (_, schema) => {
		expect(fixture).toReasonablySatisfy(schema);
	});
});
