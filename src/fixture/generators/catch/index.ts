import { ZodCatch } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const CatchGenerator = Generator({
	schema: ZodCatch,
	output: ({ def, transform, context }) => {
		// A value of the inner type parses without falling back to the catch
		// value; when the inner type can't be generated, the catch value is
		// what Zod would produce.
		try {
			return transform.fromSchema(def.innerType, context);
		} catch (error) {
			// Give the callback the ZodError Zod would: the inner type's issues.
			const parsed = def.innerType.safeParse(undefined);
			if (parsed.success) throw error;
			return def.catchValue({ error: parsed.error, input: undefined });
		}
	},
});
