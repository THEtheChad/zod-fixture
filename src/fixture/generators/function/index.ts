import type { ZodTypeAny } from '@/internal/zod';
import { ZodFunction, ZodUnknown } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

/**
 * Zod's function wrapper parses the return value with `.returns()`, so the
 * function must return that schema's input: generate past transforms,
 * preprocessors and pipelines.
 */
function inputSchema(schema: ZodTypeAny): ZodTypeAny {
	const def = schema._def;
	if (def.typeName === 'ZodEffects' && def.effect.type !== 'refinement') {
		return inputSchema(def.schema);
	}
	if (def.typeName === 'ZodPipeline') return inputSchema(def.in);
	return schema;
}

export const FunctionGenerator = Generator({
	schema: ZodFunction,
	output: ({ def, transform, context }) => {
		// Without `.returns()`, the return type is unknown.
		if (transform.utils.isType(ZodUnknown, def.returns)) {
			return transform.utils.noop;
		}

		// A function returning never can only throw.
		if (def.returns._def.typeName === 'ZodNever') {
			return () => {
				throw new Error('This function returns never.');
			};
		}

		// Generate the return value on the first call, so a return type that
		// refers back to this schema doesn't recurse forever.
		let value: unknown;
		let generated = false;
		return () => {
			if (!generated) {
				value = transform.fromSchema(inputSchema(def.returns), context);
				generated = true;
			}
			return value;
		};
	},
});
