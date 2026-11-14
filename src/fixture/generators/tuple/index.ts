import { ZodTuple } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const TupleGenerator = Generator({
	schema: ZodTuple,
	output: ({ def, transform, context }) => {
		const known: unknown[] = [];

		def.items.forEach((type, idx) => {
			transform.utils.ifNotNever(type, (schema) => {
				known.push(
					transform.fromSchema(schema, {
						...context,
						path: [...context.path, idx],
					}),
				);
			});
		});

		const rest: unknown[] = [];

		transform.utils.ifNotNever(def.rest, (schema) => {
			if (transform.utils.atRecursionLimit) return;

			transform.utils.n(
				(idx) =>
					rest.push(
						transform.fromSchema(schema, {
							...context,
							path: [...context.path, known.length + idx],
						}),
					),
				1,
			);
		});

		return [...known, ...rest];
	},
});
