import type { ZodTypeAny } from '@/internal/zod';
import { ZodDiscriminatedUnion, ZodNever, ZodUnion } from '@/internal/zod';
import { Generator } from '@/transformer/generator';

export const UnionGenerator = Generator({
	schema: ZodUnion,
	output: ({ def, transform, context }) => {
		// A never option can't produce a value.
		let options = (def.options as readonly ZodTypeAny[]).filter(
			(option) => !transform.utils.isType(ZodNever, option),
		);
		if (!options.length) {
			const path = context.path.length ? ` at ${context.path.join('.')}` : '';
			throw new Error(
				`Unable to generate a value${path}: every option of the union is never.`,
			);
		}

		if (transform.utils.atRecursionLimit) {
			// Prefer options that can end the recursion.
			const terminal = options.filter(
				(option) => !transform.utils.mustRecurse(option),
			);
			if (terminal.length) options = terminal;
		}

		const type = transform.utils.random.from(options);

		return transform.fromSchema(type, context);
	},
});

export const DiscriminatedUnionGenerator = Generator({
	schema: ZodDiscriminatedUnion,
	output: ({ def, transform, context }) => {
		let options = def.options as readonly ZodTypeAny[];

		if (transform.utils.atRecursionLimit) {
			const terminal = options.filter(
				(option) => !transform.utils.mustRecurse(option),
			);
			if (terminal.length) options = terminal;
		}

		const type = transform.utils.random.from(options);

		return transform.fromSchema(type, context);
	},
});
