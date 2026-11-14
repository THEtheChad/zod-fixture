import type { ZodTypeAny } from '@/internal/zod';
import { ZodLazy } from '@/internal/zod';
import type { Context, ZodConstructorOrSchema } from '../generator';
import { isZodConstructor } from '../generator';
import type { Runner } from '../runner';
import { Checks } from './Checks';
import { Randomization } from './Randomization';

/**
 * How far past the maximum recursion depth generation may go before giving
 * up. Recursion only continues past the maximum when the schema requires it
 * (a required key, a tuple item, an array with a min length), so reaching
 * this means the recursion can never end.
 */
const RECURSION_HARD_LIMIT = 32;

/**
 * Recursion can also be built from a fresh `z.lazy` per level (a schema
 * factory), which per-schema depth can't see. Treat this many nested lazy
 * schemas beyond the maximum depth as the recursion limit too, and give up
 * past `MAX_ACTIVE_LAZIES` instead of overflowing the stack.
 */
const LAZY_NESTING_LIMIT = 4;
const MAX_ACTIVE_LAZIES = 200;

export class Utils {
	random: Randomization;

	/** Current nesting depth per lazy schema (keyed by its getter). */
	private lazyDepth = new Map<() => ZodTypeAny, number>();
	/** Where each lazy schema was first entered, for error messages. */
	private lazyPath = new Map<() => ZodTypeAny, Context['path']>();
	private rootLazyPath: Context['path'] = [];
	private activeLazies = 0;
	private maxDepth: number | undefined;

	constructor(private runner: Runner) {
		this.random = new Randomization(runner.defaults);
	}

	resolveValue<
		TInitial,
		TFallback extends NonNullable<TInitial>,
		TConflict extends NonNullable<TInitial>,
	>(
		config:
			| {
					initial: TInitial;
					fallback: TFallback;
			  }
			| {
					initial: TInitial;
					fallback: TFallback;
					conflict: TConflict;
					resolve: (config: {
						fallback: TFallback;
						conflict: TConflict;
					}) => NonNullable<TInitial>;
			  },
	): NonNullable<TInitial> {
		const { initial, fallback } = config;

		if (initial != null) return initial;

		if ('conflict' in config) {
			const { conflict, resolve } = config;

			return conflict != null ? resolve({ fallback, conflict }) : fallback;
		} else {
			return fallback;
		}
	}

	n<T>(
		factory: (index: number) => T,
		config: number | { min: number; max: number } = this.runner.defaults.array,
	): Array<T> {
		const length =
			typeof config === 'number' ? config : this.random.int(config);

		return Array.from({ length }, (_, i) => factory(i));
	}

	ifNotNever<TSchema extends ZodTypeAny>(
		schema: TSchema | null | undefined,
		action: (schema: TSchema) => unknown,
	) {
		if (!schema || schema._def.typeName === 'ZodNever') return;
		action(schema);
	}

	/**
	 * The maximum depth of a recursive schema, rolled once per fixture from
	 * `defaults.recursion` so every branch shares the same limit.
	 */
	get maxRecursionDepth(): number {
		this.maxDepth ??= this.random.int(this.runner.defaults.recursion);
		return this.maxDepth;
	}

	/**
	 * True while generating inside a recursive schema that has reached its
	 * maximum depth. Generators with a choice (optional, nullable, array
	 * length, union option, …) should then pick the smallest valid value so
	 * the recursion ends.
	 */
	get atRecursionLimit(): boolean {
		if (this.activeLazies === 0) return false;
		if (this.activeLazies >= this.maxRecursionDepth + LAZY_NESTING_LIMIT) {
			return true;
		}
		for (const depth of this.lazyDepth.values()) {
			if (depth >= this.maxRecursionDepth) return true;
		}
		return false;
	}

	/**
	 * Whether generating `schema` would have to re-enter a lazy schema that is
	 * already being generated, i.e. recurse without a way out. Optional,
	 * nullable, possibly-empty collections and unions with an exit don't.
	 */
	mustRecurse(schema: ZodTypeAny): boolean {
		const def = schema._def;
		switch (def.typeName) {
			case 'ZodLazy':
				return (this.lazyDepth.get(def.getter) ?? 0) > 0;
			case 'ZodObject':
				return Object.values(def.shape() as Record<string, ZodTypeAny>).some(
					(value) => this.mustRecurse(value),
				);
			case 'ZodTuple':
				return (def.items as ZodTypeAny[]).some((item) =>
					this.mustRecurse(item),
				);
			case 'ZodArray':
				return (
					(def.exactLength?.value ?? def.minLength?.value ?? 0) > 0 &&
					this.mustRecurse(def.type)
				);
			case 'ZodSet':
				return (def.minSize?.value ?? 0) > 0 && this.mustRecurse(def.valueType);
			case 'ZodIntersection':
				return this.mustRecurse(def.left) || this.mustRecurse(def.right);
			case 'ZodUnion':
			case 'ZodDiscriminatedUnion':
				return (def.options as ZodTypeAny[]).every((option) =>
					this.mustRecurse(option),
				);
			case 'ZodEffects':
				return this.mustRecurse(def.schema);
			case 'ZodBranded':
				return this.mustRecurse(def.type);
			case 'ZodReadonly':
			case 'ZodCatch':
				return this.mustRecurse(def.innerType);
			case 'ZodPromise':
				return this.mustRecurse(def.type);
			case 'ZodDefault':
				return this.mustRecurse(def.innerType);
			case 'ZodPipeline':
				return this.mustRecurse(def.in);
			default:
				return false;
		}
	}

	/** Run `action` one level deeper inside the lazy schema `getter`. */
	enterLazy<T>(getter: () => ZodTypeAny, context: Context, action: () => T): T {
		const depth = (this.lazyDepth.get(getter) ?? 0) + 1;
		// Only the same schema nesting inside itself can recurse forever;
		// distinct lazy schemas nested in each other are finite.
		if (this.activeLazies === 0) this.rootLazyPath = context.path;
		if (
			depth > this.maxRecursionDepth + RECURSION_HARD_LIMIT ||
			this.activeLazies >= MAX_ACTIVE_LAZIES
		) {
			const path =
				depth > 1
					? this.lazyPath.get(getter) ?? context.path
					: this.rootLazyPath;
			throw new Error(
				`Unable to generate a fixture: the recursive schema at ${
					path.length ? path.join('.') : '<root>'
				} never terminates. ` +
					'Make the recursive part optional, nullable, or allow an empty array.',
			);
		}

		if (depth === 1) this.lazyPath.set(getter, context.path);
		this.lazyDepth.set(getter, depth);
		this.activeLazies++;
		try {
			return action();
		} finally {
			this.lazyDepth.set(getter, depth - 1);
			this.activeLazies--;
		}
	}

	/**
	 * Skips `action` for a lazy schema once recursion has reached its limit.
	 * Only use this where leaving the value out is valid.
	 *
	 * @deprecated Check `atRecursionLimit` instead and generate the smallest
	 * valid value.
	 */
	recursionCheck<TSchema extends ZodTypeAny>(
		schema: TSchema,
		action: (schema: TSchema) => unknown,
	) {
		if (this.isType(ZodLazy, schema) && this.atRecursionLimit) return;
		action(schema);
	}

	isType<TSchema extends ZodTypeAny>(
		target: ZodConstructorOrSchema<TSchema>,
		schema: ZodTypeAny,
	): schema is TSchema {
		return isZodConstructor(target)
			? schema._def.typeName === target.name
			: // If our generator was created with an instance, make sure it matches
				// the schema we're trying to generate.
				// This is particularly important for z.custom schemas.
				schema === target;
	}

	checks<TChecks extends { kind: string }[]>(checks: TChecks) {
		return new Checks(checks);
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	noop() {}
}
