import { ZodEnum, ZodNativeEnum } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const EnumGenerator = Generator({
	schema: ZodEnum,
	output: ({ def, transform }) => transform.utils.random.from(def.values),
});

export const NativeEnumGenerator = Generator({
	schema: ZodNativeEnum,
	output: ({ def, transform }) => {
		const enumerable = def.values ?? {};

		// Numeric TypeScript enums map values back to keys (`E[0] === 'A'`).
		// Skip those reverse-mapping keys the way Zod does, rather than every
		// numeric-looking key, so `{ '0': 'zero' }` keeps its value.
		const values = Object.keys(enumerable)
			.filter(
				(key) => typeof enumerable[enumerable[key] as string] !== 'number',
			)
			.map((key) => enumerable[key]);

		return transform.utils.random.from(values);
	},
});
