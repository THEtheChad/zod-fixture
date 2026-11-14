import { ZodOptional } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const OptionalGenerator = Generator({
	schema: ZodOptional,
	output: ({ def, transform, context }) => {
		if (transform.utils.atRecursionLimit) return undefined;

		return transform.utils.random.boolean()
			? transform.fromSchema(def.innerType, context)
			: undefined;
	},
});
