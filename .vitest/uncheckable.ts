import type { ZodTypeAny } from 'zod';

/**
 * Explains why `toReasonablySatisfy` can't check `schema`, or returns
 * `undefined` when it can.
 *
 * Fixtures are parse *outputs*, but the matcher validates them by parsing
 * them again, as *inputs*. That only works when output and input agree, so
 * any step that changes a value on its way through a parse (a transform, a
 * preprocess, a pipe into coercion) makes the check meaningless. A `.catch()`
 * at the root accepts every value, so that check could never fail.
 */
export function findUncheckable(schema: ZodTypeAny): string | undefined {
	if (unwrap(schema)._def.typeName === 'ZodCatch') {
		return 'every value parses against a .catch() schema, so the check could never fail';
	}
	return walk(schema, [], new Set(), false, 0);
}

/**
 * Schema factories (`z.lazy(() => makeSchema())`) build a new getter per
 * level, so a cycle can't always be spotted; stop descending past this depth.
 */
const MAX_DEPTH = 200;

/** Wrappers that don't change which values parse. */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
	const def = schema._def;
	switch (def.typeName) {
		case 'ZodBranded':
			return unwrap(def.type);
		case 'ZodReadonly':
			return unwrap(def.innerType);
		default:
			return schema;
	}
}

function walk(
	schema: ZodTypeAny,
	path: string[],
	seen: Set<unknown>,
	inPipeOutput: boolean,
	depth: number,
): string | undefined {
	if (depth > MAX_DEPTH) return undefined;
	const def = schema._def;
	const at = () => (path.length ? ` at ${path.join('.')}` : '');
	const changesValues = (what: string) =>
		`${what}${at()} changes values during a parse. Fixtures are parse ` +
		'outputs, so parsing them again as inputs is not a valid check';
	const child = (next: ZodTypeAny, segment?: string) =>
		walk(
			next,
			segment === undefined ? path : [...path, segment],
			seen,
			inPipeOutput,
			depth + 1,
		);
	const first = (
		entries: Iterable<[ZodTypeAny, string | undefined]>,
	): string | undefined => {
		for (const [next, segment] of entries) {
			const reason = child(next, segment);
			if (reason) return reason;
		}
		return undefined;
	};

	if (inPipeOutput && def.coerce) {
		return changesValues('.pipe() into a coercing schema');
	}

	switch (def.typeName) {
		case 'ZodEffects':
			if (def.effect.type === 'transform') return changesValues('.transform()');
			if (def.effect.type === 'preprocess')
				return changesValues('z.preprocess()');
			return child(def.schema);
		case 'ZodPipeline':
			return child(def.in) ?? walk(def.out, path, seen, true, depth + 1);
		case 'ZodLazy': {
			// Lazy schemas are the only way to build a cycle. Stop at the first
			// repeat (factories build a new schema per call, so key the getter).
			if (seen.has(def.getter)) return undefined;
			seen.add(def.getter);
			return child(def.getter());
		}
		case 'ZodObject':
			return first(
				Object.entries(def.shape() as Record<string, ZodTypeAny>)
					.map(([key, value]) => [value, key] as [ZodTypeAny, string])
					.concat([[def.catchall, '*']]),
			);
		case 'ZodArray':
			return child(def.type, '[]');
		case 'ZodSet':
			return child(def.valueType, '[]');
		case 'ZodTuple':
			return first(
				(def.items as ZodTypeAny[])
					.map((item, i) => [item, String(i)] as [ZodTypeAny, string])
					.concat(def.rest ? [[def.rest, '...']] : []),
			);
		case 'ZodRecord':
		case 'ZodMap':
			return first([
				[def.keyType, '<key>'],
				[def.valueType, '<value>'],
			]);
		case 'ZodUnion':
		case 'ZodDiscriminatedUnion':
			return first(
				(def.options as ZodTypeAny[]).map(
					(option) => [option, undefined] as [ZodTypeAny, undefined],
				),
			);
		case 'ZodIntersection':
			return first([
				[def.left, undefined],
				[def.right, undefined],
			]);
		case 'ZodOptional':
		case 'ZodNullable':
		case 'ZodDefault':
		case 'ZodCatch':
		case 'ZodReadonly':
			return child(def.innerType);
		case 'ZodBranded':
		case 'ZodPromise':
			return child(def.type);
		default:
			return undefined;
	}
}
