import { ZodSet } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

import type { InferZodType } from '@/internal/zod';

export const SetGenerator = Generator({
	schema: ZodSet,
	output: ({ def, transform, context }) => {
		const userDefinedMin = def.minSize?.value;
		const userDefinedMax = def.maxSize?.value;

		const min = transform.utils.resolveValue({
			initial: userDefinedMin,
			fallback: transform.defaults.set.min,
			conflict: userDefinedMax,
			resolve: (options) => Math.min(options.fallback, options.conflict),
		});

		const max = transform.utils.resolveValue({
			initial: userDefinedMax,
			fallback: transform.defaults.set.max,
			conflict: userDefinedMin,
			resolve: (options) => Math.max(options.fallback, options.conflict),
		});

		const result = new Set<InferZodType<typeof def.valueType>>();

		transform.utils.ifNotNever(def.valueType, (valueType) => {
			// At the recursion limit, use the smallest size the schema allows.
			const size = transform.utils.atRecursionLimit
				? userDefinedMin ?? 0
				: transform.utils.random.int({ min, max });

			transform.utils.distinct(
				size,
				() =>
					transform.fromSchema(valueType, {
						...context,
						path: [...context.path, result.size],
					}),
				(value) => {
					if (result.has(value)) return false;
					result.add(value);
					return true;
				},
			);

			// Zod checks the size of the input set; transformed values can
			// collapse into fewer outputs, which is still a valid result.
			const transformed = valueType._def.typeName === 'ZodEffects';
			if (!transformed && result.size < (userDefinedMin ?? 0)) {
				throw new Error(
					`Unable to generate a set of at least ${userDefinedMin} distinct values: only found ${result.size}.`,
				);
			}
		});

		return result;
	},
});
