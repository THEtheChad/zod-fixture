import type { InferZodType } from '@/internal/zod';
import { ZodMap } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const MapGenerator = Generator({
	schema: ZodMap,
	output: ({ def, transform, context }) => {
		const key = def.keyType;
		const value = def.valueType;

		const map = new Map<InferZodType<typeof key>, InferZodType<typeof value>>();

		transform.utils.ifNotNever(key, (keySchema) => {
			transform.utils.ifNotNever(value, (valueSchema) => {
				if (transform.utils.atRecursionLimit) return;

				transform.utils.distinct(
					transform.utils.random.int(transform.defaults.map),
					() => transform.fromSchema(keySchema, context) as string | number,
					(k) => {
						if (map.has(k)) return false;
						map.set(
							k,
							transform.fromSchema(valueSchema, {
								...context,
								path: [...context.path, k],
							}),
						);
						return true;
					},
				);
			});
		});

		return map;
	},
});
