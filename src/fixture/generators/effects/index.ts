import { ZodEffects } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

/** How many inputs to try when a transform rejects them with `addIssue`. */
const MAX_TRANSFORM_ATTEMPTS = 20;

/** Refinement schemas that have already logged their warning. */
const warnedRefinements = new WeakSet<object>();

export const TransformGenerator = Generator({
	schema: ZodEffects,
	filter: ({ def }) => def.effect.type === 'transform',
	output: ({ def, transform, context }) => {
		if (def.effect.type !== 'transform')
			throw new Error('Must be a transform effect.');

		const { effect } = def;
		for (let attempt = 0; attempt < MAX_TRANSFORM_ATTEMPTS; attempt++) {
			const input = transform.fromSchema(def.schema, context);
			let rejected = false;
			const output = effect.transform(input, {
				// A transform reports invalid input with `addIssue`; Zod then fails
				// the parse, so generate another input instead.
				addIssue: () => {
					rejected = true;
				},
				path: context.path,
			});
			if (!rejected) return output;
		}

		const path = context.path.length ? ` at ${context.path.join('.')}` : '';
		throw new Error(
			`Unable to generate a value${path}: the transform rejected all ${MAX_TRANSFORM_ATTEMPTS} generated inputs.`,
		);
	},
});

export const PreprocessGenerator = Generator({
	schema: ZodEffects,
	filter: ({ def }) => def.effect.type === 'preprocess',
	output: ({ def, transform, context }) => {
		if (def.effect.type !== 'preprocess')
			throw new Error('Must be a preprocess effect.');

		// We don't actually care about the preprocessor
		// when mocking data because we're not validating
		// input. We only care about the expected output.
		return transform.fromSchema(def.schema, context);
	},
});

export const RefinementGenerator = Generator({
	schema: ZodEffects,
	filter: ({ def }) => def.effect.type === 'refinement',
	output: ({ def, transform, context }) => {
		if (def.effect.type !== 'refinement')
			throw new Error('Must be a refinement effect.');

		const { schema } = def;

		if (!warnedRefinements.has(def)) {
			warnedRefinements.add(def);
			console.warn(
				`Because refinements use custom validations, we have no way to accurately manufacture acceptable values. Using the parent type (${schema._def.typeName}) to approximate the result.`,
			);
		}
		return transform.fromSchema(schema, context);
	},
});
