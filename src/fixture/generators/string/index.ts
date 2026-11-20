import type { ZodStringDef, ZodTypeAny } from '@/internal/zod';
import { ZodString } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import type { Runner } from '@/transformer/runner';

/** How many candidates to try before settling for the last one. */
const MAX_ATTEMPTS = 20;

// Single code unit pictographs, used to fill odd emoji lengths.
const NARROW_EMOJI = [
	'☀',
	'☁',
	'☂',
	'☃',
	'☎',
	'☕',
	'♻',
	'⚡',
	'⛄',
	'❤',
];

type StringCheck = ZodStringDef['checks'][number];

/** Every string check folded into one set of constraints. */
interface Constraints {
	min?: number;
	max?: number;
	startsWith?: string;
	endsWith?: string;
	includes: { value: string; position: number }[];
}

function constraintsOf(def: ZodStringDef): Constraints {
	const result: Constraints = { includes: [] };
	const raise = (value: number) => {
		result.min = result.min === undefined ? value : Math.max(result.min, value);
	};
	const lower = (value: number) => {
		result.max = result.max === undefined ? value : Math.min(result.max, value);
	};

	for (const check of def.checks as StringCheck[]) {
		switch (check.kind) {
			case 'min':
				raise(check.value);
				break;
			case 'max':
				lower(check.value);
				break;
			case 'length':
				raise(check.value);
				lower(check.value);
				break;
			case 'startsWith':
				if (check.value.length > (result.startsWith?.length ?? -1)) {
					result.startsWith = check.value;
				}
				break;
			case 'endsWith':
				if (check.value.length > (result.endsWith?.length ?? -1)) {
					result.endsWith = check.value;
				}
				break;
			case 'includes':
				result.includes.push({
					value: check.value,
					position: check.position ?? 0,
				});
				break;
		}
	}

	return result;
}

function describe(constraints: Constraints) {
	const parts: string[] = [];
	if (constraints.min !== undefined)
		parts.push(`min length ${constraints.min}`);
	if (constraints.max !== undefined)
		parts.push(`max length ${constraints.max}`);
	if (constraints.startsWith !== undefined)
		parts.push(`startsWith ${JSON.stringify(constraints.startsWith)}`);
	if (constraints.endsWith !== undefined)
		parts.push(`endsWith ${JSON.stringify(constraints.endsWith)}`);
	for (const { value, position } of constraints.includes)
		parts.push(
			`includes ${JSON.stringify(value)}${position ? ` at ${position}+` : ''}`,
		);
	return parts.join(', ');
}

function unsatisfiable(format: string, constraints: Constraints): Error {
	return new Error(
		`Unable to generate a string${
			format ? ` in ${format} format` : ''
		} with ${describe(constraints)}.`,
	);
}

/**
 * Build candidates until one passes the schema. Builders throw when the
 * constraints provably can't be met; otherwise give up after `attempts`
 * candidates with Zod's reason.
 */
function generate(
	schema: ZodTypeAny,
	def: ZodStringDef,
	build: (attempt: number) => string,
	attempts = MAX_ATTEMPTS,
): string {
	const constraints = constraintsOf(def);
	let issue = '';
	for (let attempt = 0; attempt < attempts; attempt++) {
		// Candidates are inputs; Zod's output applies case and trim checks
		// in the order the schema declares them.
		const candidate = build(attempt);
		for (const value of [candidate, withAffixes(candidate, constraints)]) {
			const result = schema.safeParse(value);
			if (result.success) return result.data as string;
			issue ||= result.error.issues[0]?.message ?? '';
		}
	}
	throw new Error(`Unable to generate a valid string: ${issue}.`);
}

/**
 * `value` with its start and end replaced by the affixes, keeping its
 * length: formats like regexes, dates and CIDRs often still match.
 */
function withAffixes(value: string, constraints: Constraints): string {
	const { startsWith = '', endsWith = '' } = constraints;
	let result = value;
	if (startsWith && !result.startsWith(startsWith)) {
		result = startsWith + result.slice(startsWith.length);
	}
	if (endsWith && !result.endsWith(endsWith)) {
		result =
			result.slice(0, Math.max(0, result.length - endsWith.length)) + endsWith;
	}
	return result;
}

/** A length within the constraints, close to the format's natural range. */
function pickLength(
	transform: Runner,
	constraints: Constraints,
	natural: { min: number; max: number },
	required = 0,
): number | undefined {
	const lo = Math.max(constraints.min ?? 0, required);
	const hi = constraints.max ?? Infinity;
	if (lo > hi) return undefined;

	const min = Math.min(Math.max(natural.min, lo), hi);
	const max = Math.max(Math.min(natural.max, hi), min);
	// Don't consume randomness when the length is forced, so seeded output
	// for unconstrained formats stays the same.
	return min === max ? min : transform.utils.random.int({ min, max });
}

/** `value` with `pieces` inserted literally at increasing positions. */
function withIncludes(
	value: string,
	includes: Constraints['includes'],
	from: number,
): string {
	let result = value;
	let cursor = from;
	for (const { value: piece, position } of includes) {
		if (result.indexOf(piece, position) !== -1) continue;
		const at = Math.max(cursor, position);
		result = result.slice(0, at) + piece + result.slice(at);
		cursor = at + piece.length;
	}
	return result;
}

/**
 * Merge includes without a position into the shortest string containing
 * them all, greedily joining the pair with the largest overlap.
 */
function mergeOverlapping(
	includes: Constraints['includes'],
): Constraints['includes'] {
	const positioned = includes.filter(({ position }) => position > 0);
	let pieces = includes
		.filter(({ position }) => position === 0)
		.map(({ value }) => value);
	// Drop pieces contained in another.
	pieces = pieces.filter(
		(piece, i) =>
			!pieces.some(
				(other, j) =>
					j !== i && other.includes(piece) && (other !== piece || j < i),
			),
	);

	while (pieces.length > 1) {
		let best = { i: 0, j: 1, overlap: -1 };
		for (let i = 0; i < pieces.length; i++) {
			for (let j = 0; j < pieces.length; j++) {
				if (i === j) continue;
				const a = pieces[i] as string;
				const b = pieces[j] as string;
				for (let k = Math.min(a.length, b.length); k > best.overlap; k--) {
					if (a.endsWith(b.slice(0, k))) {
						best = { i, j, overlap: k };
						break;
					}
				}
			}
		}
		const merged =
			(pieces[best.i] as string) +
			(pieces[best.j] as string).slice(Math.max(best.overlap, 0));
		pieces = pieces.filter((_, k) => k !== best.i && k !== best.j);
		pieces.push(merged);
	}

	return [...pieces.map((value) => ({ value, position: 0 })), ...positioned];
}

/** `a` followed by `b`, sharing the longest suffix of `a` that starts `b`. */
function overlapJoin(a: string, b: string): string {
	if (a.includes(b)) return a;
	for (let overlap = Math.min(a.length, b.length); overlap > 0; overlap--) {
		if (a.endsWith(b.slice(0, overlap))) return a + b.slice(overlap);
	}
	return a + b;
}

/** A free-form string that meets the length, affix and includes checks. */
function freeform(transform: Runner, constraints: Constraints): string {
	const { startsWith = '', endsWith = '', includes } = constraints;

	if (!startsWith && !endsWith && !includes.length) {
		return transform.utils.random.string({
			min: constraints.min,
			max: constraints.max,
		});
	}

	// Includes already provided by an affix (at or after their position)
	// need no room of their own; overlapping ones share characters.
	const needed = mergeOverlapping(
		includes.filter(
			({ value, position }) =>
				startsWith.indexOf(value, position) === -1 &&
				!(position === 0 && endsWith.includes(value)),
		),
	);
	const positionGap = Math.max(
		0,
		...needed.map(({ position }) => position - startsWith.length),
	);
	const required =
		startsWith.length +
		positionGap +
		needed.reduce((sum, { value }) => sum + value.length, 0) +
		endsWith.length;

	const max = constraints.max ?? Infinity;
	// Short on room: let the affixes and includes overlap ("xyz" + "yz!").
	if (required > max && needed.every(({ position }) => position === 0)) {
		const joined = [startsWith, ...needed.map(({ value }) => value), endsWith]
			.filter(Boolean)
			.reduce((result, piece) => overlapJoin(result, piece), '');
		if (
			joined.startsWith(startsWith) &&
			joined.endsWith(endsWith) &&
			joined.length >= (constraints.min ?? 0) &&
			joined.length <= max
		) {
			return joined;
		}
	}

	const length = pickLength(
		transform,
		constraints,
		transform.defaults.string,
		required,
	);
	if (length === undefined) throw unsatisfiable('', constraints);

	const fillerLength =
		length -
		startsWith.length -
		endsWith.length -
		needed.reduce((sum, { value }) => sum + value.length, 0);
	const filler = transform.utils.random.string({
		min: fillerLength,
		max: fillerLength,
	});

	return (
		withIncludes(startsWith + filler, needed, startsWith.length) + endsWith
	);
}

export const StringGenerator = Generator({
	schema: ZodString,
	output: ({ schema, def, transform }) => {
		const constraints = constraintsOf(def);

		if (def.checks.some((check) => check.kind === 'emoji')) {
			return generate(schema, def, () => emoji(transform, constraints));
		}

		return generate(schema, def, () => freeform(transform, constraints));
	},
});

/** Emoji strings, measured in UTF-16 code units like Zod's length checks. */
function emoji(transform: Runner, constraints: Constraints): string {
	const { random } = transform.utils;

	if (constraints.min === undefined && constraints.max === undefined) {
		return random.string({}).replace(/./g, () => random.emoji());
	}

	const length = pickLength(transform, constraints, {
		min: 2,
		max: 2 * transform.defaults.string.max,
	});
	if (length === undefined || length === 0) {
		throw unsatisfiable('emoji', constraints);
	}

	let result = length % 2 ? random.from(NARROW_EMOJI) : '';
	while (result.length < length) result += random.emoji();
	return result;
}

export const UlidGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('ulid'),
	output: ({ schema, def, transform }) =>
		fixedFormat(schema, def, 'ulid', () => transform.utils.random.ulid()),
});

/** Formats with a fixed shape: their length can't be adjusted. */
function fixedFormat(
	schema: ZodTypeAny,
	def: ZodStringDef,
	kind: string,
	build: () => string,
): string {
	const constraints = constraintsOf(def);
	try {
		return generate(schema, def, build);
	} catch (error) {
		// Prefer saying that the format can't fit the length checks.
		const value = build();
		const tooShort = value.length < (constraints.min ?? 0);
		const tooLong = value.length > (constraints.max ?? Infinity);
		if (tooShort || tooLong) throw unsatisfiable(kind, constraints);
		throw error;
	}
}

export const UrlGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) => transform.utils.checks(def.checks).has('url'),
	output: ({ schema, def, transform }) => {
		const constraints = constraintsOf(def);
		const { startsWith = '', endsWith = '' } = constraints;
		const { random } = transform.utils;

		return generate(schema, def, () => {
			const word = random.lorem(1);
			// Honor a `startsWith` that is the start of the URL, or a scheme.
			let head = `https://${word}.com`;
			if (startsWith && !head.startsWith(startsWith)) {
				head = startsWith.includes('//')
					? `${startsWith}${word}.com`
					: `${startsWith.replace(/:?$/, '')}://${word}.com`;
			}
			const tail =
				!endsWith || head.endsWith(endsWith)
					? ''
					: /^[/?#]/.test(endsWith)
						? endsWith
						: `/${endsWith}`;
			const natural = head.length + tail.length;

			const length = pickLength(transform, constraints, {
				min: natural,
				max: natural,
			});
			if (length === undefined || length < 2) {
				throw unsatisfiable('url', constraints);
			}
			if (length === natural) return head + tail;

			if (length > natural) {
				// Longer URLs get a path before any `endsWith`.
				const fill = length - natural - 1;
				return `${head}/${random.string({ min: fill, max: fill })}${tail}`;
			}

			// Shorter ones use a minimal scheme ("a:bc").
			return `a:${random.string({ min: length - 2, max: length - 2 })}`;
		});
	},
});

export const UuidGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('uuid'),
	output: ({ schema, def, transform }) =>
		fixedFormat(schema, def, 'uuid', () => transform.utils.random.uuid()),
});

export const EmailGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('email'),
	output: ({ schema, def, transform }) => {
		const constraints = constraintsOf(def);
		const { startsWith = '', endsWith = '' } = constraints;
		const { random } = transform.utils;

		// A `startsWith` that contains "@" supplies the local part and the
		// start of the domain.
		if (startsWith.includes('@')) {
			const domainStart = startsWith.slice(startsWith.indexOf('@') + 1);
			return generate(schema, def, () => {
				if (domainStart) {
					if (/\.[a-z]{2,}$/i.test(domainStart)) return startsWith;
					return `${startsWith}${domainStart.endsWith('.') ? '' : '.'}co`;
				}
				const fill = Math.max(
					0,
					(pickLength(transform, constraints, { min: 15, max: 15 }) ?? 0) -
						startsWith.length -
						4,
				);
				return `${startsWith}${random
					.string({ min: fill, max: fill })
					.replace(/[^a-z0-9]/gi, 'x')}x.co`;
			});
		}

		// An `endsWith` that contains "@" supplies the whole domain.
		const domain = endsWith.includes('@')
			? endsWith.slice(endsWith.indexOf('@') + 1)
			: endsWith
				? `mail${endsWith.startsWith('.') ? '' : '.'}${endsWith}`
				: undefined;
		const suffix = endsWith.includes('@')
			? endsWith.slice(0, endsWith.indexOf('@'))
			: '';

		return generate(schema, def, () => {
			// A short domain leaves room for a tight max length.
			const host =
				domain ??
				(constraints.max !== undefined && constraints.max < 15
					? 'x.co'
					: 'email.com');
			// Includes not already covered go into the local part.
			const extra = constraints.includes
				.map(({ value }) => value)
				.filter((value) => !`${startsWith}${suffix}@${host}`.includes(value))
				.join('');
			const fixed =
				startsWith.length + extra.length + suffix.length + 1 + host.length;
			// The local part needs a character, unless an affix provides it.
			const length = pickLength(
				transform,
				constraints,
				{ min: 15, max: 15 },
				fixed + (startsWith || suffix || extra ? 0 : 1),
			);
			if (length === undefined) throw unsatisfiable('email', constraints);

			const localLength = length - fixed;
			const local =
				!startsWith && !suffix && !domain && !extra && localLength === 5
					? 'rando'
					: random
							.string({ min: localLength, max: localLength })
							.replace(/[^a-z0-9]/gi, 'x');
			return `${startsWith}${local}${extra}${suffix}@${host}`;
		});
	},
});

export const CuidGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('cuid'),
	output: ({ schema, def, transform }) =>
		fixedFormat(schema, def, 'cuid', () => transform.utils.random.cuid()),
});

function randomIp(transform: Runner, version: 'v4' | 'v6'): string {
	const { random } = transform.utils;
	if (version === 'v4') {
		return transform.utils
			.n(() => random.int({ min: 1, max: 255 }), 4)
			.join('.');
	}

	return transform.utils
		.n(() => random.int({ min: 0, max: 65535 }).toString(16), 8)
		.join(':');
}

/** An IPv4 address of exactly `length` (7–15) characters. */
function ipv4OfLength(transform: Runner, length: number): string {
	const { random } = transform.utils;
	// Size the octets (1–3 digits each) to fit.
	const digits = [1, 1, 1, 1];
	for (let extra = length - 7; extra > 0; extra--) {
		const open = digits.flatMap((count, index) => (count < 3 ? [index] : []));
		const index = random.from(open);
		digits[index] = (digits[index] as number) + 1;
	}
	const ranges = { 1: [0, 9], 2: [10, 99], 3: [100, 255] } as const;
	return digits
		.map((count) => {
			const [min, max] = ranges[count as 1 | 2 | 3];
			return random.int({ min, max });
		})
		.join('.');
}

export const IpGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) => transform.utils.checks(def.checks).has('ip'),
	output: ({ schema, def, transform }) => {
		const constraints = constraintsOf(def);
		const { random } = transform.utils;
		const requested = transform.utils.checks(def.checks).find('ip')?.version;

		return fixedFormat(schema, def, 'ip', () => {
			// An IPv6 address here is 39 characters; prefer IPv4 when it can't fit.
			const version =
				requested ??
				(constraints.max !== undefined && constraints.max < 39
					? 'v4'
					: random.from(['v4', 'v6']));

			if (version === 'v6') {
				return transform.utils
					.n(() => random.int({ min: 0, max: 65535 }).toString(16), 8)
					.join(':');
			}

			if (constraints.min === undefined && constraints.max === undefined) {
				return transform.utils
					.n(() => random.int({ min: 1, max: 255 }), 4)
					.join('.');
			}

			// Size the octets (1–3 digits each) to fit the length checks.
			const length = pickLength(transform, constraints, { min: 7, max: 15 });
			if (length === undefined || length < 7 || length > 15) {
				throw unsatisfiable('ip', constraints);
			}
			return ipv4OfLength(transform, length);
		});
	},
});

export const CidrGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('cidr'),
	output: ({ schema, def, transform }) => {
		const constraints = constraintsOf(def);
		const { random } = transform.utils;
		const requested = transform.utils.checks(def.checks).find('cidr')?.version;

		return fixedFormat(schema, def, 'cidr', () => {
			const constrained =
				constraints.min !== undefined || constraints.max !== undefined;
			// An IPv6 CIDR here is 41+ characters; prefer IPv4 when it can't fit.
			const version =
				requested ??
				(constraints.max !== undefined && constraints.max < 41
					? 'v4'
					: random.from(['v4', 'v6'] as const));

			if (version === 'v6' || !constrained) {
				const prefix = random.int({ min: 0, max: version === 'v4' ? 32 : 128 });
				return `${randomIp(transform, version)}/${prefix}`;
			}

			// "1.2.3.4/0" (9) to "255.255.255.255/32" (18).
			const length = pickLength(transform, constraints, { min: 9, max: 18 });
			if (length === undefined || length < 9 || length > 18) {
				throw unsatisfiable('cidr', constraints);
			}
			// A 1- or 2-digit prefix, leaving a 7–15 character address.
			const prefixDigits = random.from(
				[1, 2].filter((digits) => {
					const address = length - 1 - digits;
					return address >= 7 && address <= 15;
				}),
			);
			const prefix =
				prefixDigits === 1
					? random.int({ min: 0, max: 9 })
					: random.int({ min: 10, max: 32 });
			return `${ipv4OfLength(transform, length - 1 - prefixDigits)}/${prefix}`;
		});
	},
});

export const Cuid2Generator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('cuid2'),
	output: ({ schema, def, transform }) => {
		const constraints = constraintsOf(def);
		if (constraints.min === undefined && constraints.max === undefined) {
			return generate(schema, def, () => transform.utils.random.cuid2());
		}

		const length = pickLength(transform, constraints, { min: 24, max: 24 });
		if (length === undefined || length === 0) {
			throw unsatisfiable('cuid2', constraints);
		}
		return generate(schema, def, () =>
			transform.utils.random.regexp(`^[a-z][a-z0-9]{${length - 1}}$`),
		);
	},
});

/** `digits` random decimal digits. */
function randomDigits(transform: Runner, digits: number): string {
	let result = '';
	while (result.length < digits) {
		result += transform.utils.random.int({ min: 0, max: 9 });
	}
	return result;
}

/**
 * "HH:MM:SS" plus a fraction of `precision` digits. Without a precision the
 * milliseconds are kept, matching `Date#toISOString`.
 */
function timeOf(
	transform: Runner,
	iso: string,
	precision: number | null | undefined,
): string {
	const seconds = iso.slice(11, 19);
	const millis = iso.slice(20, 23);

	if (precision == null) return `${seconds}.${millis}`;
	if (precision === 0) return seconds;
	if (precision <= 3) return `${seconds}.${millis.slice(0, precision)}`;
	return `${seconds}.${millis}${randomDigits(transform, precision - 3)}`;
}

export const DateTimeGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('datetime'),
	output: ({ schema, def, transform }) => {
		const check = transform.utils.checks(def.checks).find('datetime');

		const { min, max } = constraintsOf(def);

		return fixedFormat(schema, def, 'datetime', () => {
			const iso = transform.utils.random.date().toISOString();
			if (check?.precision != null) {
				const time = timeOf(transform, iso, check.precision);
				return `${iso.slice(0, 10)}T${time}Z`;
			}
			if (min === undefined && max === undefined) return iso;

			// Without a precision, seconds and fraction digits are optional:
			// "…THH:MMZ" (17), "…THH:MM:SSZ" (20) or "…THH:MM:SS.f…Z" (22+).
			const length = Math.max(min ?? 0, Math.min(max ?? 24, 24));
			if (length < 20) return `${iso.slice(0, 16)}Z`;
			if (length < 22) return `${iso.slice(0, 19)}Z`;
			return `${iso.slice(0, 19)}.${randomDigits(transform, length - 21)}Z`;
		});
	},
});

export const DateStringGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('date'),
	output: ({ schema, def, transform }) =>
		fixedFormat(schema, def, 'date', () =>
			transform.utils.random.date().toISOString().slice(0, 10),
		),
});

export const TimeGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('time'),
	output: ({ schema, def, transform }) => {
		const precision = transform.utils
			.checks(def.checks)
			.find('time')?.precision;

		const { min, max } = constraintsOf(def);

		return fixedFormat(schema, def, 'time', () => {
			const iso = transform.utils.random.date().toISOString();
			if (precision != null || (min === undefined && max === undefined)) {
				return timeOf(transform, iso, precision);
			}

			// Without a precision, seconds and fraction digits are optional:
			// "HH:MM", "HH:MM:SS" or "HH:MM:SS.f…" fit most length checks.
			const length = Math.max(min ?? 0, Math.min(max ?? 12, 12));
			if (length < 8) return iso.slice(11, 16);
			if (length < 10) return iso.slice(11, 19);
			return `${iso.slice(11, 19)}.${randomDigits(transform, length - 9)}`;
		});
	},
});

export const DurationGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('duration'),
	output: ({ schema, def, transform }) =>
		fixedFormat(schema, def, 'duration', () => {
			const { min, max } = constraintsOf(def);
			const part = (max: number) => transform.utils.random.int({ min: 0, max });
			const full = `P${part(5)}Y${part(11)}M${part(27)}DT${part(23)}H${part(59)}M${part(59)}S`;
			if (full.length >= (min ?? 0) && full.length <= (max ?? Infinity)) {
				return full;
			}

			// A day count sized to fit: "P1D", "P12D", …
			const target = max !== undefined && max < full.length ? max : min ?? 3;
			const digits = Math.max(1, target - 2);
			return `P${randomDigits(transform, digits)}D`;
		}),
});

const BASE64 =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64URL =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Random characters from `alphabet`, at a length `valid` accepts. */
function encoded(
	transform: Runner,
	def: ZodStringDef,
	kind: string,
	alphabet: string,
	valid: (length: number) => boolean,
): string {
	const constraints = constraintsOf(def);
	const lo = constraints.min ?? 0;
	const hi = constraints.max ?? Infinity;
	const natural = Math.min(
		Math.max(lo, transform.utils.random.int({ min: 4, max: 8 }) * 4),
		hi,
	);

	// The nearest valid length to the natural one, within the bounds.
	let length: number | undefined;
	for (let delta = 0; delta <= 4 && length === undefined; delta++) {
		for (const candidate of [natural - delta, natural + delta]) {
			if (candidate >= lo && candidate <= hi && valid(candidate)) {
				length = candidate;
				break;
			}
		}
	}
	if (length === undefined) throw unsatisfiable(kind, constraints);

	let result = '';
	while (result.length < length)
		result += transform.utils.random.from(alphabet);
	return result;
}

export const Base64Generator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('base64'),
	output: ({ schema, def, transform }) =>
		generate(schema, def, () =>
			// Unpadded base64 is valid only in whole groups of four.
			encoded(transform, def, 'base64', BASE64, (length) => length % 4 === 0),
		),
});

export const Base64UrlGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('base64url'),
	output: ({ schema, def, transform }) =>
		generate(schema, def, () =>
			// A trailing group can't be a single character.
			encoded(
				transform,
				def,
				'base64url',
				BASE64URL,
				(length) => length % 4 !== 1,
			),
		),
});

export const NanoidGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('nanoid'),
	output: ({ schema, def, transform }) =>
		fixedFormat(schema, def, 'nanoid', () => {
			let result = '';
			while (result.length < 21)
				result += transform.utils.random.from(BASE64URL);
			return result;
		}),
});

function base64url(value: string): string {
	return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const JwtGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) => transform.utils.checks(def.checks).has('jwt'),
	output: ({ schema, def, transform }) => {
		const alg = transform.utils.checks(def.checks).find('jwt')?.alg ?? 'HS256';

		const constraints = constraintsOf(def);

		return fixedFormat(schema, def, 'jwt', () => {
			const header = base64url(JSON.stringify({ alg, typ: 'JWT' }));
			let payload = base64url(
				JSON.stringify({
					sub: transform.utils.random.uuid(),
					// Seconds since the epoch, between 2000 and 2030.
					iat: transform.utils.random.int({ min: 946684800, max: 1893456000 }),
				}),
			);

			// The signature may be any length (even empty), and the payload can
			// shrink to `{}`, so most length checks fit.
			let signatureLength = 43;
			const natural = header.length + payload.length + 2 + signatureLength;
			const length = pickLength(transform, constraints, {
				min: natural,
				max: natural,
			});
			if (length !== undefined && length !== natural) {
				if (length < natural - signatureLength) payload = base64url('{}');
				signatureLength = Math.max(
					0,
					length - header.length - payload.length - 2,
				);
			}

			let signature = '';
			while (signature.length < signatureLength) {
				signature += transform.utils.random.from(BASE64URL);
			}
			return `${header}.${payload}.${signature}`;
		});
	},
});

export const RegexGenerator = Generator({
	schema: ZodString,
	filter: ({ def, transform }) =>
		transform.utils.checks(def.checks).has('regex'),
	output: ({ schema, def, transform }) => {
		const patterns = def.checks.flatMap((check) =>
			check.kind === 'regex' ? [check.regex] : [],
		);
		if (!patterns.length) {
			throw new Error(`RegexGenerator: regex pattern not found`);
		}

		// With length checks, plan a match of an allowed length. Otherwise, or
		// when a pattern can't be planned, RandExp picks repetition counts at
		// random: cap them at the max length and retry until the length checks
		// and any further patterns match.
		const { min, max } = constraintsOf(def);
		const lengthChecked = min !== undefined || max !== undefined;
		const cap = max ?? Math.max(100, 2 * (min ?? 0));
		const repetition = (pattern: RegExp, attempt: number) => {
			// Several unbounded quantifiers (`+`, `*`, `{n,}`) multiply lengths:
			// share the cap between them and shrink it on later attempts.
			const unbounded = pattern.source.match(/[*+]|\{\d+,\}/g)?.length ?? 0;
			if (unbounded > 1) {
				return Math.max(1, Math.floor(cap / unbounded) >> attempt % 6);
			}
			// A single one needs the full cap for long exact lengths; every
			// fourth attempt still tries a smaller one.
			return attempt % 4 === 3
				? Math.max(1, cap >> (((attempt >> 2) % 6) + 1))
				: cap;
		};
		return generate(
			schema,
			def,
			// With several patterns, generate from each in turn.
			(attempt) => {
				const pattern = patterns[attempt % patterns.length] as RegExp;
				const planned = lengthChecked
					? transform.utils.random.regexpOfLength(pattern, min ?? 0, cap)
					: undefined;
				return (
					planned ??
					transform.utils.random.regexp(pattern, repetition(pattern, attempt))
				);
			},
			200,
		);
	},
});
