import { ZodDefault } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const DefaultGenerator = Generator({
	schema: ZodDefault,
	output: ({ def, transform, context }) => {
		if (!transform.utils.random.boolean()) {
			return transform.fromSchema(def.innerType, context);
		}

		// Zod parses the default with the inner schema, so its transforms apply
		// to the default too.
		try {
			const parsed = def.innerType.safeParse(def.defaultValue(), {
				path: context.path,
			});
			if (parsed.success) return parsed.data;
		} catch {
			// Async inner schemas can't be parsed synchronously.
		}
		// Generate the inner type instead, which is a valid output too.
		return transform.fromSchema(def.innerType, context);
	},
});
