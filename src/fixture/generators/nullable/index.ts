import { ZodNullable } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const NullableGenerator = Generator({
	schema: ZodNullable,
	output: ({ def, transform, context }) => {
		if (transform.utils.atRecursionLimit) return null;

		return transform.utils.random.boolean()
			? transform.fromSchema(def.innerType, context)
			: null;
	},
});
