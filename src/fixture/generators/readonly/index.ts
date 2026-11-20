import { ZodReadonly } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const ReadonlyGenerator = Generator({
	schema: ZodReadonly,
	output: ({ transform, def, context }) => {
		const result = transform.fromSchema(def.innerType, context);
		return Object.freeze(result);
	},
});
