import type { ZodTypeAny } from '@/internal/zod';
import type { Defaults, PartialDefaults } from './defaults';
import { constrained, randomSeed, unconstrained } from './defaults';
import type { Definition } from './generator';
import { Runner } from './runner';

export abstract class Transformer {
	abstract readonly generators: Definition[];
	abstract readonly transformerDefaults: Defaults;

	constructor(readonly instanceDefaults?: PartialDefaults) {
		this.instanceDefaults = { seed: randomSeed(), ...instanceDefaults };
	}

	extend(generators: Definition | Definition[]) {
		const input = Array.isArray(generators) ? generators : [generators];
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore     We're allowed to update this internally
		this.generators = input.concat(this.generators);
		return this;
	}

	fromSchema<TSchema extends ZodTypeAny>(
		schema: TSchema,
		instanceDefaults?: PartialDefaults,
	): unknown {
		return new Runner(this, instanceDefaults).fromSchema(schema);
	}

	missingGeneratorError(schema: ZodTypeAny) {
		return new Error(`No generator found for ${schemaName(schema)}.`);
	}
}

export class ConstrainedTransformer extends Transformer {
	generators: Definition[] = [];
	transformerDefaults: Defaults = constrained;
}

export class UnconstrainedTransformer extends Transformer {
	generators: Definition[] = [];
	transformerDefaults: Defaults = unconstrained;
}

/**
 * The schema's Zod type name. Class names can be mangled by minifiers, so
 * prefer `_def.typeName`.
 */
export function schemaName(schema: ZodTypeAny): string {
	return schema._def?.typeName ?? schema.constructor.name;
}
