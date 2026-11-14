import { ZodNever, ZodNullable } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const NullableGenerator = Generator({
	schema: ZodNullable,
	output: ({ def, transform, context }) => {
		if (transform.utils.atRecursionLimit) return null;
		if (transform.utils.isType(ZodNever, def.innerType)) return null;

		return transform.utils.random.boolean()
			? transform.fromSchema(def.innerType, context)
			: null;
	},
});
