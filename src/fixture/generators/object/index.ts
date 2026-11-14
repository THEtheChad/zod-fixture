import type { InferZodType, ZodTypeAny } from '@/internal/zod';
import { ZodAny, ZodObject, ZodRecord } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const ObjectGenerator = Generator({
	schema: ZodObject,
	output: ({ def, transform, context }) => {
		const shape = def.shape();
		const result: Record<string, unknown> = {};

		for (const key in shape) {
			transform.utils.ifNotNever(shape[key], (schema) => {
				result[key] = transform.fromSchema(schema, {
					...context,
					path: [...context.path, key],
				});
			});
		}
		const passthrough =
			def.unknownKeys === 'passthrough' ||
			def.catchall._def.typeName !== 'ZodNever';

		if (passthrough) {
			// The extra key must not overwrite a declared one.
			const taken = (key: string) =>
				Object.prototype.hasOwnProperty.call(shape, key) ||
				Object.prototype.hasOwnProperty.call(result, key);
			let key = transform.utils.random.lorem(1, 'word');
			for (let attempt = 1; taken(key); attempt++) {
				key =
					attempt < 10
						? transform.utils.random.lorem(1, 'word')
						: `${key}_${attempt}`;
			}
			const type =
				def.catchall._def.typeName === 'ZodNever'
					? ZodAny.create()
					: def.catchall;
			result[key] = transform.fromSchema(type, {
				...context,
				path: [...context.path, key],
			});
		}

		return result;
	},
});

export const RecordGenerator = Generator({
	schema: ZodRecord,
	output: ({ def, transform, context }) => {
		const result: Record<
			InferZodType<typeof def.keyType>,
			InferZodType<typeof def.valueType>
		> = {};

		transform.utils.ifNotNever(def.keyType, (keyType) => {
			transform.utils.ifNotNever(def.valueType, (valueType) => {
				if (transform.utils.atRecursionLimit) return;

				// A finite key space (enum, literal) gets every key.
				const keys = finiteKeys(keyType);
				if (keys) {
					for (const key of keys) {
						result[key] = transform.fromSchema(valueType, {
							...context,
							path: [...context.path, key],
						});
					}
					return;
				}

				transform.utils.distinct(
					transform.utils.random.int(transform.defaults.array),
					() => transform.fromSchema(keyType, context) as string | number,
					(key) => {
						if (Object.prototype.hasOwnProperty.call(result, key)) return false;
						result[key] = transform.fromSchema(valueType, {
							...context,
							path: [...context.path, key],
						});
						return true;
					},
				);
			});
		});

		return result;
	},
});

/** Every value a record key schema accepts, when there are finitely many. */
function finiteKeys(schema: ZodTypeAny): (string | number)[] | undefined {
	const def = schema._def;
	switch (def.typeName) {
		case 'ZodEnum':
			return [...def.values];
		case 'ZodNativeEnum': {
			// Skip numeric enums' reverse mappings, as Zod does.
			const values = def.values as Record<string, string | number>;
			return Object.keys(values)
				.filter((key) => typeof values[values[key] as string] !== 'number')
				.map((key) => values[key] as string | number);
		}
		case 'ZodLiteral':
			return [def.value];
		case 'ZodUnion': {
			const keys = (def.options as ZodTypeAny[]).map(finiteKeys);
			return keys.every(Boolean)
				? (keys.flat() as (string | number)[])
				: undefined;
		}
		default:
			return undefined;
	}
}
