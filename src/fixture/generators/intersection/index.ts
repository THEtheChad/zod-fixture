import type { AnyZodObject, ZodArray as ZodArraySchema } from 'zod';
import type { ZodTypeAny } from '@/internal/zod';
import { ZodArray, ZodIntersection, ZodObject } from '@/internal/zod';
import type { Context } from '@/transformer/generator';
import { Generator } from '@/transformer/generator';
import type { Runner } from '@/transformer/runner';

/** How many candidates to try before giving up on an intersection. */
const MAX_ATTEMPTS = 100;
/** How many merged candidates to try before generating from each side. */
const MAX_CANDIDATE_ATTEMPTS = 20;

// Schemas whose constraints all live in `_def.checks`, so the intersection of
// several of them is one schema carrying all of their checks.
const CHECKED_TYPES = new Set([
	'ZodString',
	'ZodNumber',
	'ZodBigInt',
	'ZodDate',
]);

/** How many inputs to try when the sides' outputs can't be merged. */
const MAX_OUTPUT_ATTEMPTS = 10;

export const IntersectionGenerator = Generator({
	schema: ZodIntersection,
	output: ({ schema, transform, context }) => {
		const schemas = conjuncts(transform, schema);

		// `intersect` builds an input every side accepts; Zod then parses it
		// with each side and merges the outputs, which fails when transformed
		// outputs disagree.
		for (let attempt = 0; attempt < MAX_OUTPUT_ATTEMPTS; attempt++) {
			const input = intersect(transform, schemas, context);
			const result = parse(schema, input);
			if (!result) return input;
			if (result.success) return result.data;
		}

		throw unsatisfiable(context);
	},
});

function unsatisfiable(context: Context): Error {
	const path = context.path.length ? ` at ${context.path.join('.')}` : '';
	return new Error(
		`Unable to generate a value${path} that satisfies every side of the intersection.`,
	);
}

/**
 * The schema describing `schema`'s input: transforms, preprocessors and
 * pipelines are parsed from their inner (or `in`) schema's values.
 */
function inputSchema(transform: Runner, schema: ZodTypeAny): ZodTypeAny {
	const def = schema._def;
	switch (def.typeName) {
		// Refinements, brands and the like don't change the shape to generate;
		// each side's full schema still checks the result.
		case 'ZodEffects':
			return inputSchema(transform, def.schema);
		case 'ZodPipeline':
			return inputSchema(transform, def.in);
		case 'ZodBranded':
			return inputSchema(transform, def.type);
		case 'ZodReadonly':
		case 'ZodDefault':
		case 'ZodCatch':
			return inputSchema(transform, def.innerType);
		default:
			return schema;
	}
}

/** Replace `schemas[index]` and intersect again. */
function replaceAt(
	transform: Runner,
	schemas: ZodTypeAny[],
	index: number,
	replacement: ZodTypeAny,
	context: Context,
): unknown {
	return intersect(
		transform,
		schemas.flatMap((schema, i) =>
			i === index ? conjuncts(transform, replacement) : [schema],
		),
		context,
	);
}

/**
 * A value every schema in `schemas` accepts as input, or an error when there
 * is none. Used for intersections and for pipelines.
 */
export function intersectInputs(
	transform: Runner,
	schemas: ZodTypeAny[],
	context: Context,
): unknown {
	return intersect(
		transform,
		schemas.flatMap((schema) => conjuncts(transform, schema)),
		context,
	);
}

/** Flatten nested intersections: `a.and(b).and(c)` → `[a, b, c]`. */
function conjuncts(transform: Runner, schema: ZodTypeAny): ZodTypeAny[] {
	return transform.utils.isType(ZodIntersection, schema)
		? [
				...conjuncts(transform, schema._def.left),
				...conjuncts(transform, schema._def.right),
			]
		: [schema];
}

/** Generate a value that every schema in `schemas` accepts. */
function intersect(
	transform: Runner,
	schemas: ZodTypeAny[],
	context: Context,
): unknown {
	const { utils } = transform;
	const acceptedByAll = (value: unknown) =>
		schemas.every((schema) => satisfies(schema, value));
	// Generate inputs: values each side can parse.
	const inputs = schemas.map((schema) => inputSchema(transform, schema));

	if (inputs.length === 1) {
		return transform.fromSchema(inputs[0] as ZodTypeAny, context);
	}

	// A lazy side: enter it (so the recursion limit applies) and intersect
	// what it resolves to.
	const lazyIndex = inputs.findIndex(
		(schema) => schema._def.typeName === 'ZodLazy',
	);
	if (lazyIndex !== -1) {
		const { getter } = (inputs[lazyIndex] as ZodTypeAny)._def;
		return utils.enterLazy(getter, context, () =>
			replaceAt(transform, schemas, lazyIndex, getter(), context),
		);
	}

	// Optional and nullable sides: when every side allows undefined (or
	// null), that's a valid result; otherwise intersect the inner types.
	for (const [typeName, empty] of [
		['ZodOptional', undefined],
		['ZodNullable', null],
	] as const) {
		const index = inputs.findIndex(
			(schema) => schema._def.typeName === typeName,
		);
		if (index === -1) continue;
		const all = inputs.every((schema) => schema._def.typeName === typeName);
		if (all && (utils.atRecursionLimit || !utils.random.boolean())) {
			return empty;
		}
		return replaceAt(
			transform,
			schemas,
			index,
			(inputs[index] as ZodTypeAny)._def.innerType,
			context,
		);
	}

	// A union intersects through one of its options: try them in random order.
	const unionIndex = inputs.findIndex((schema) =>
		['ZodUnion', 'ZodDiscriminatedUnion'].includes(schema._def.typeName),
	);
	if (unionIndex !== -1) {
		const union = inputs[unionIndex] as ZodTypeAny;
		const rest = schemas.filter((_, index) => index !== unionIndex);
		for (const option of utils.random.shuffle(
			union._def.options as ZodTypeAny[],
		)) {
			try {
				const value = intersect(
					transform,
					[...rest, ...conjuncts(transform, option)],
					context,
				);
				if (acceptedByAll(value)) return value;
			} catch {
				// Try the next option.
			}
		}
		throw unsatisfiable(context);
	}

	let candidate: (() => unknown) | undefined;
	if (inputs.every((schema) => utils.isType(ZodObject, schema))) {
		candidate = () =>
			intersectObjects(transform, inputs as AnyZodObject[], context);
	} else if (inputs.every((schema) => utils.isType(ZodArray, schema))) {
		candidate = () =>
			intersectArrays(
				transform,
				inputs as ZodArraySchema<ZodTypeAny>[],
				context,
			);
	} else {
		const merged = mergeChecks(inputs);
		if (merged) candidate = () => transform.fromSchema(merged, context);
	}

	// Merged candidates can still miss a refinement; try a few.
	for (
		let attempt = 0;
		candidate && attempt < MAX_CANDIDATE_ATTEMPTS;
		attempt++
	) {
		try {
			const value = candidate();
			if (acceptedByAll(value)) return value;
		} catch {
			// Fall back to generating from each side.
			break;
		}
	}

	// Generate from each side in turn until every side accepts the value.
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const source = inputs[attempt % inputs.length] as ZodTypeAny;
		const value = transform.fromSchema(source, context);
		if (acceptedByAll(value)) return value;
	}

	throw unsatisfiable(context);
}

/** Merge object schemas key by key; keys shared by several are intersected. */
function intersectObjects(
	transform: Runner,
	schemas: AnyZodObject[],
	context: Context,
): Record<string, unknown> {
	const keys = new Map<string, ZodTypeAny[]>();
	for (const schema of schemas) {
		for (const [key, value] of Object.entries(schema._def.shape())) {
			keys.set(key, [...(keys.get(key) ?? []), value as ZodTypeAny]);
		}
	}

	// A key one side doesn't declare still has to match that side's catchall.
	for (const [key, keySchemas] of keys) {
		for (const schema of schemas) {
			const { catchall } = schema._def;
			const declared = Object.prototype.hasOwnProperty.call(
				schema._def.shape(),
				key,
			);
			if (!declared && catchall._def.typeName !== 'ZodNever') {
				keySchemas.push(catchall);
			}
		}
	}

	const result: Record<string, unknown> = {};
	for (const [key, keySchemas] of keys) {
		const value = intersect(
			transform,
			keySchemas.flatMap((schema) => conjuncts(transform, schema)),
			{ ...context, path: [...context.path, key] },
		);

		// Leave optional keys out rather than setting them to undefined.
		if (value !== undefined) result[key] = value;
	}

	return result;
}

/** Intersect arrays item by item, within every length constraint. */
function intersectArrays(
	transform: Runner,
	schemas: ZodArraySchema<ZodTypeAny>[],
	context: Context,
): unknown[] {
	const values = (
		pick: (def: ZodArraySchema<ZodTypeAny>['_def']) => number | undefined,
	) =>
		schemas
			.map((schema) => pick(schema._def))
			.filter((value): value is number => value !== undefined);

	const exact = values((def) => def.exactLength?.value);
	const mins = [...exact, ...values((def) => def.minLength?.value)];
	const maxes = [...exact, ...values((def) => def.maxLength?.value)];
	const userMin = mins.length ? Math.max(...mins) : undefined;
	const userMax = maxes.length ? Math.min(...maxes) : undefined;

	const min = transform.utils.resolveValue({
		initial: userMin,
		fallback: transform.defaults.array.min,
		conflict: userMax,
		resolve: (options) => Math.min(options.fallback, options.conflict),
	});
	const max = transform.utils.resolveValue({
		initial: userMax,
		fallback: transform.defaults.array.max,
		conflict: userMin,
		resolve: (options) => Math.max(options.fallback, options.conflict),
	});

	if (min > max) {
		throw new Error(
			`Unable to generate an array that satisfies every side of the intersection: no length in [${min}, ${max}].`,
		);
	}

	const items = schemas.flatMap((schema) =>
		conjuncts(transform, schema._def.type),
	);
	// At the recursion limit, use the smallest length the schemas allow.
	const length = transform.utils.atRecursionLimit
		? userMin ?? 0
		: transform.utils.random.int({ min, max });

	try {
		return transform.utils.n(
			(index) =>
				intersect(transform, items, {
					...context,
					path: [...context.path, index],
				}),
			length,
		);
	} catch (error) {
		// Items no side can agree on still allow an empty array.
		if ((userMin ?? 0) === 0) return [];
		throw error;
	}
}

/** One schema of the shared type carrying the checks of every side. */
function mergeChecks(schemas: ZodTypeAny[]): ZodTypeAny | undefined {
	const [first] = schemas;
	const typeName = first?._def.typeName;
	if (
		!first ||
		!CHECKED_TYPES.has(typeName) ||
		schemas.some((schema) => schema._def.typeName !== typeName)
	) {
		return undefined;
	}

	// Build the schema with the input's own class so zod-fixture stays free of
	// a runtime Zod dependency.
	const Schema = first.constructor as new (def: unknown) => ZodTypeAny;
	return new Schema({
		...first._def,
		checks: schemas.flatMap((schema) => schema._def.checks),
	});
}

/** `schema.safeParse(value)`, or undefined when it can only parse async. */
function parse(schema: ZodTypeAny, value: unknown) {
	try {
		return schema.safeParse(value);
	} catch {
		return undefined;
	}
}

function satisfies(schema: ZodTypeAny, value: unknown): boolean {
	// Async refinements can't be checked synchronously; trust the generator.
	return parse(schema, value)?.success ?? true;
}
