import { ZodString } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import type {
	Context,
	Defaults,
	Definition,
	PartialDefaults,
	Runner,
} from '@/public';
import { expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import { Fixture, createFixture } from './fixture';

const PersonSchema = z.object({
	name: z.string(),
	birthday: z.date(),
	address: z.object({
		street: z.string(),
		city: z.string(),
		state: z.string(),
	}),
	pets: z.array(z.object({ name: z.string(), breed: z.string() })),
	totalVisits: z.number(),
});

test('creates a fixture using a class instance', () => {
	const result = new Fixture().fromSchema(PersonSchema);
	expect(result.name).toBeTypeOf('string');
	expect(result.birthday).toBeInstanceOf(Date);
	expect(result.address).toBeTypeOf('object');
	expect(result.address.street).toBeTypeOf('string');
	expect(result.address.city).toBeTypeOf('string');
	expect(result.address.state).toBeTypeOf('string');
	expect(result.pets).toBeInstanceOf(Array);
	expect(result.pets[0]).toBeTypeOf('object');
	expect(result.pets[0]?.name).toBeTypeOf('string');
	expect(result.pets[0]?.breed).toBeTypeOf('string');
	expect(result.totalVisits).toBeTypeOf('number');
});

test('creates a fixture using createFixture', () => {
	const result = createFixture(PersonSchema);
	expect(result.name).toBeTypeOf('string');
	expect(result.birthday).toBeInstanceOf(Date);
	expect(result.address).toBeTypeOf('object');
	expect(result.address.street).toBeTypeOf('string');
	expect(result.address.city).toBeTypeOf('string');
	expect(result.address.state).toBeTypeOf('string');
	expect(result.pets).toBeInstanceOf(Array);
	expect(result.pets[0]).toBeTypeOf('object');
	expect(result.pets[0]?.name).toBeTypeOf('string');
	expect(result.pets[0]?.breed).toBeTypeOf('string');
	expect(result.totalVisits).toBeTypeOf('number');
});

test(`priotizes generators via extend`, () => {
	const nameGenerator = Generator({
		schema: ZodString,
		filter: ({ context }) => context.path.includes('name'),
		output: () => 'Fixed Name',
	});

	const result = new Fixture().extend(nameGenerator).fromSchema(PersonSchema);

	expect(result.name).toBe('Fixed Name');
	expect(result.birthday).toBeInstanceOf(Date);
	expect(result.address).toBeTypeOf('object');
	expect(result.address.street).toBeTypeOf('string');
	expect(result.address.street).not.toBe('Fixed Name');
	expect(result.address.city).toBeTypeOf('string');
	expect(result.address.state).toBeTypeOf('string');
	expect(result.pets).toBeInstanceOf(Array);
	expect(result.pets[0]).toBeTypeOf('object');
	expect(result.pets[0]?.name).toBeTypeOf('string');
	expect(result.pets[0]?.breed).toBeTypeOf('string');
	expect(result.totalVisits).toBeTypeOf('number');
});

test(`fixture has all the zod types`, () => {
	enum Fruits {
		Apple,
		Banana,
	}
	enum StringFruits {
		Apple = 'apple',
		Banana = 'banana',
		Cantaloupe = 3,
	}
	const constFruits = {
		Apple: 'apple',
		Banana: 'banana',
		Cantaloupe: 3,
	} as const;
	const Person = z.object({
		name: z.string(),
	});
	const Employee = z.object({
		role: z.string(),
	});

	const pxSchema = z.custom<`${number}px`>((val) => {
		return /^\d+px$/.test(val as string);
	});
	const CustomSchemaGenerator = Generator({
		schema: pxSchema,
		output: () => '100px',
	});

	class InstanceOfClass {}
	const instanceOfSchema = z.instanceof(InstanceOfClass);
	const InstanceOfSchemaGenerator = Generator({
		schema: instanceOfSchema,
		output: () => new InstanceOfClass(),
	});

	const errorSchema = z.instanceof(Error);
	const ErrorGenerator = Generator({
		schema: errorSchema,
		output: () => new Error(),
	});

	const schemaWithEverything = z.object({
		default: z.string().default('default'),
		string: z.string(),
		number: z.number(),
		bigint: z.bigint(),
		boolean: z.boolean(),
		date: z.date(),
		symbol: z.symbol(),
		undefined: z.undefined(),
		null: z.null(),
		void: z.void(),
		any: z.any(),
		unknown: z.unknown(),
		// this is by design, see the never generator for more info
		// never: z.never(),
		literal: z.literal('literal'),
		string_max: z.string().max(5),
		string_min: z.string().min(5),
		string_length: z.string().length(5),
		string_email: z.string().email(),
		string_url: z.string().url(),
		string_emoji: z.string().emoji(),
		string_uuid: z.string().uuid(),
		string_cuid: z.string().cuid(),
		string_cuid2: z.string().cuid2(),
		string_ulid: z.string().ulid(),
		string_regex: z.string().regex(/abc/),
		string_includes: z.string().includes('abc'),
		string_startsWith: z.string().startsWith('abc'),
		string_endsWith: z.string().endsWith('abc'),
		string_datetime: z.string().datetime(),
		string_datetimePrecision: z.string().datetime({ precision: 3 }),
		string_datetimeOffset: z.string().datetime({ offset: true }),
		string_ip: z.string().ip(),
		string_ipv4: z.string().ip({ version: 'v4' }),
		string_ipv6: z.string().ip({ version: 'v6' }),
		string_trim: z.string().trim(),
		toLowerCase: z.string().toLowerCase(),
		toUpperCase: z.string().toUpperCase(),
		number_gt: z.number().gt(5),
		number_gte: z.number().gte(5),
		number_lt: z.number().lt(5),
		number_lte: z.number().lte(5),
		number_int: z.number().int(),
		number_positive: z.number().positive(),
		number_nonnegative: z.number().nonnegative(),
		number_negative: z.number().negative(),
		number_nonpositive: z.number().nonpositive(),
		number_multipleOf: z.number().multipleOf(5),
		number_finite: z.number().finite(),
		number_safe: z.number().safe(),
		bigint_gt: z.bigint().gt(5n),
		bigint_gte: z.bigint().gte(5n),
		bigint_lt: z.bigint().lt(5n),
		bigint_lte: z.bigint().lte(5n),
		bigint_positive: z.bigint().positive(),
		bigint_nonnegative: z.bigint().nonnegative(),
		bigint_negative: z.bigint().negative(),
		bigint_nonpositive: z.bigint().nonpositive(),
		bigint_multipleOf: z.bigint().multipleOf(5n),
		nan: z.nan(),
		enum: z.enum(['Salmon', 'Tuna', 'Trout']),
		native_enum: z.nativeEnum(Fruits),
		string_enum: z.nativeEnum(StringFruits),
		const_enum: z.nativeEnum(constFruits),
		optional: z.optional(z.string()),
		nullable: z.nullable(z.string()),
		object: z.object({ name: z.string() }),
		array: z.array(z.string()),
		array_nonempty: z.string().array().nonempty(),
		array_min: z.string().array().min(5),
		array_max: z.string().array().max(5),
		array_length: z.string().array().length(5),
		tuples: z.tuple([
			z.string(),
			z.number(),
			z.object({
				pointsScored: z.number(),
			}),
		]),
		unions: z.union([z.string(), z.number()]),
		unions_or: z.string().or(z.number()),
		union_discriminated: z.discriminatedUnion('status', [
			z.object({ status: z.literal('success'), data: z.string() }),
			z.object({ status: z.literal('failed'), error: errorSchema }),
		]),
		record: z.record(z.number()),
		record_keytype: z.record(z.string().min(1), z.number()),
		map: z.map(z.string(), z.number()),
		set: z.set(z.number()),
		set_nonempty: z.set(z.number()).nonempty(),
		set_min: z.set(z.number()).min(5),
		set_max: z.set(z.number()).max(5),
		set_size: z.set(z.number()).size(5),
		intersection: z.intersection(Person, Employee),
		intersection_and: Person.and(Employee),
		promise: z.promise(z.number()),
		function: z.function(),
		custom: pxSchema,
		instanceof: instanceOfSchema,
	});

	const fixture = new Fixture().extend([
		CustomSchemaGenerator,
		InstanceOfSchemaGenerator,
		ErrorGenerator,
	]);

	expect(fixture).toReasonablySatisfy(schemaWithEverything);
	expect(fixture.fromSchema(schemaWithEverything, { seed: 1 }))
		.toMatchInlineSnapshot(`
			{
			  "any": "ZodAny",
			  "array": [
			    "fq-wyeuarbbnvqu",
			    "mio-cpdknofuysm",
			    "dbujfrcfcuebjhc",
			  ],
			  "array_length": [
			    "sfhlajfvaxzyvrn",
			    "agixooxvepctbol",
			    "apbmvjrbuktcg-b",
			    "hvxxbsrpfeomyjm",
			    "wpwidyoymgfclfm",
			  ],
			  "array_max": [
			    "-vkg-cqewfplqjh",
			    "psucxauvsyxaihs",
			    "mjkglakoidqple-",
			  ],
			  "array_min": [
			    "q-aejdcdsnaamzz",
			    "jamecindxvojhzj",
			    "yxgway-mlojvphd",
			    "zqiazqflgvxigyw",
			    "oefvpqbbalbskyp",
			  ],
			  "array_nonempty": [
			    "fzrpowyqhibttou",
			    "yezsalgtquzkzyp",
			    "yarzkhneqaomzvy",
			  ],
			  "bigint": 8n,
			  "bigint_gt": 42n,
			  "bigint_gte": 45n,
			  "bigint_lt": -10n,
			  "bigint_lte": -21n,
			  "bigint_multipleOf": -75n,
			  "bigint_negative": -45n,
			  "bigint_nonnegative": 43n,
			  "bigint_nonpositive": -57n,
			  "bigint_positive": 75n,
			  "boolean": false,
			  "const_enum": "apple",
			  "custom": "100px",
			  "date": 1984-04-04T07:51:12.441Z,
			  "default": "default",
			  "enum": "Tuna",
			  "function": [Function],
			  "instanceof": InstanceOfClass {},
			  "intersection": {
			    "name": "dmkzcfnhscmljcw",
			    "role": "bvksmutjywhlwwr",
			  },
			  "intersection_and": {
			    "name": "adtcqasbpmpdjaz",
			    "role": "-kkuwm-mpmsmcv-",
			  },
			  "literal": "literal",
			  "map": Map {
			    "--orovdmjxaoepu" => 83.49965941160917,
			    "ijtxvsmsnfwloph" => 97.95034169219434,
			    "fhgghruymfbxnmf" => 44.99602420255542,
			  },
			  "nan": NaN,
			  "native_enum": 0,
			  "null": null,
			  "nullable": "cvgqtapradbh-jp",
			  "number": 87.1078145224601,
			  "number_finite": 61.42103825695813,
			  "number_gt": 97.11159583879635,
			  "number_gte": 44.70302113564685,
			  "number_int": -97,
			  "number_lt": -41.09182692365721,
			  "number_lte": -61.37645974755287,
			  "number_multipleOf": 45,
			  "number_negative": -71.02399982977659,
			  "number_nonnegative": 80.06326730828732,
			  "number_nonpositive": -76.702572661452,
			  "number_positive": 81.29949716385454,
			  "number_safe": 2034691909615615,
			  "object": {
			    "name": "fbgeuefzpk-bwug",
			  },
			  "optional": undefined,
			  "promise": Promise {},
			  "record": {
			    "aiikxcwjoaxqzfw": 25.022317934781313,
			    "higgrsjvvnmqvb-": -10.780098894611001,
			    "icbrtsuqkvtapu-": 46.34571992792189,
			  },
			  "record_keytype": {
			    "-": 93.20931271649897,
			    "d": -28.087939182296395,
			    "o": 8.311875397339463,
			  },
			  "set": Set {
			    -39.42573582753539,
			    -40.53372307680547,
			    -2.19853981398046,
			  },
			  "set_max": Set {
			    57.51620144583285,
			    2.228294825181365,
			    80.72037338279188,
			    8.190361689776182,
			    -56.09518219716847,
			  },
			  "set_min": Set {
			    -82.27674816735089,
			    68.76808633096516,
			    -66.86207195743918,
			    -23.796775052323937,
			    0.599306495860219,
			  },
			  "set_nonempty": Set {
			    -59.265134297311306,
			  },
			  "set_size": Set {
			    47.62619361281395,
			    60.792179219424725,
			    -48.43942136503756,
			    -93.53538625873625,
			    12.841749051585793,
			  },
			  "string": "tzadi-dgckfkjsk",
			  "string_cuid": "cmznqaags0000cblm3awa44i0",
			  "string_cuid2": "cx7w9ahl1kkm5yl9p83jeyoh",
			  "string_datetime": "1947-08-23T20:40:23.737Z",
			  "string_datetimeOffset": "2081-07-29T19:12:38.072Z",
			  "string_datetimePrecision": "2053-05-06T06:01:17.059Z",
			  "string_email": "rando@email.com",
			  "string_emoji": "😅🙆😵😈😯😢😶🙌😡😫😐😷😗😙😌",
			  "string_endsWith": "qbdvzbmjpzlkabc",
			  "string_enum": "apple",
			  "string_includes": "abczjjpurtdxsqr",
			  "string_ip": "92dc:4d25:bc:c5d2:9dfd:2726:539f:9421",
			  "string_ipv4": "135.3.226.181",
			  "string_ipv6": "5b76:787b:e895:c3bc:9f94:77a7:40c:44dd",
			  "string_length": "ldzfv",
			  "string_max": "oflxg",
			  "string_min": "osylm",
			  "string_regex": "abc",
			  "string_startsWith": "abcjjuhjyulx-ar",
			  "string_trim": "wso-bemduzfsmbg",
			  "string_ulid": "01H1RH1N4GSY0JWWH4E4WSCCH5",
			  "string_url": "https://cupidatat.com",
			  "string_uuid": "b468ebfa-1c47-4c33-8aa5-f452c996c6a8",
			  "symbol": Symbol(ad),
			  "toLowerCase": "nufybtodeakacan",
			  "toUpperCase": "CXHOGO-WHDGHCPP",
			  "tuples": [
			    "itafngswbleqqgi",
			    -79.60654823109508,
			    {
			      "pointsScored": 78.10342367738485,
			    },
			  ],
			  "undefined": undefined,
			  "union_discriminated": {
			    "error": [Error],
			    "status": "failed",
			  },
			  "unions": 58.07470437139273,
			  "unions_or": "efqsoernd-udfbo",
			  "unknown": "ZodUnknown",
			  "void": undefined,
			}
		`);
});

test('exports the public types', () => {
	const defaults: PartialDefaults = { string: { min: 1 } };
	const context: Context = { path: ['a', 0] };

	expect(defaults.string?.min).toBe(1);
	expect(context.path).toHaveLength(2);
	expectTypeOf<Defaults['string']['characterSet']>().toEqualTypeOf<string>();
	expectTypeOf<Definition['output']>().parameter(0).toHaveProperty('transform');
	expectTypeOf<Runner['defaults']>().toEqualTypeOf<Defaults>();
});
