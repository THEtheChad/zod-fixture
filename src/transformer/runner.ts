import type { ZodTypeAny } from '@/internal/zod';
import type { Defaults, PartialDefaults } from './defaults';
import { mergeDefaults } from './defaults';
import type { Context } from './generator';
import type { Transformer } from './transformer';
import { Utils } from './utils';

export class Runner {
	readonly defaults: Defaults;
	readonly utils: Utils;

	constructor(
		public readonly transformer: Transformer,
		schemaDefaults?: PartialDefaults,
	) {
		this.defaults = mergeDefaults(
			transformer.transformerDefaults,
			transformer.instanceDefaults,
			schemaDefaults,
		);
		this.utils = new Utils(this);
	}

	fromSchema<TSchema extends ZodTypeAny>(
		schema: TSchema,
		context: Context = { path: [] },
	): unknown {
		// Zod 4 schemas (including `zod/mini`) have a different shape; say so
		// before matching generators, which read Zod 3's `_def.typeName`.
		if (isZod4Schema(schema)) throw zod4SchemaError(schema);

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const transform = this;
		const def = schema._def;
		const generator = this.transformer.generators.find((generator) => {
			if (
				generator.schema &&
				!transform.utils.isType(generator.schema, schema)
			) {
				return false;
			}

			if (
				generator.filter &&
				!generator.filter({ schema, def, transform, context })
			) {
				return false;
			}

			return true;
		});

		this.shouldHaveMatch(schema, generator);

		return generator.output({ schema, def, transform, context });
	}

	shouldHaveMatch(
		schema: ZodTypeAny,
		generator: unknown,
	): asserts generator is NonNullable<unknown> {
		if (!generator) throw this.transformer.missingGeneratorError(schema);
	}
}

// Zod 4 schemas carry their internals on `_zod` and identify themselves via
// `_def.type`; Zod 3 schemas (including `zod/v3` in Zod 4) use `_def.typeName`.
function isZod4Schema(
	schema: unknown,
): schema is { _zod: { def: { type: string } } } {
	return (
		typeof schema === 'object' &&
		schema !== null &&
		'_zod' in schema &&
		typeof (schema as { _zod?: { def?: { type?: unknown } } })._zod?.def
			?.type === 'string'
	);
}

function zod4SchemaError(schema: { _zod: { def: { type: string } } }) {
	return new Error(
		`Received a Zod 4 schema (${schema._zod.def.type}), but zod-fixture supports Zod 3 schemas only.`,
	);
}
