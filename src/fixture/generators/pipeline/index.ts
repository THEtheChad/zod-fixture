import { ZodPipeline } from '@/internal/zod';
import { Generator } from '@/transformer/generator';
import { intersectInputs } from '../intersection';

/** How many values to try before generating the output schema directly. */
const MAX_ATTEMPTS = 10;

/** Pipelines that have already logged their approximation warning. */
const warnedPipelines = new WeakSet<object>();

export const PipelineGenerator = Generator({
	schema: ZodPipeline,
	output: ({ def, transform, context }) => {
		// A pipeline parses its input with `in`, then parses that output with
		// `out`. Fixtures hold a schema's output, so a fixture of `in` is
		// already `in`'s output: run it through `out`.
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const intermediate = transform.fromSchema(def.in, context);
			try {
				const result = def.out.safeParse(intermediate);
				if (result.success) return result.data;
			} catch {
				// Async transforms or refinements can't run synchronously.
				break;
			}
		}

		// Without transforms in between, a pipeline is an intersection: find a
		// value both sides accept, then run it through.
		try {
			const value = intersectInputs(transform, [def.in, def.out], context);
			const intermediate = def.in.safeParse(value);
			if (intermediate.success) {
				const result = def.out.safeParse(intermediate.data);
				if (result.success) return result.data;
			}
		} catch {
			// No common value, or an async schema.
		}

		// The `out` schema describes the pipeline's output on its own, though
		// not every value of it is reachable through `in`.
		if (!warnedPipelines.has(def)) {
			warnedPipelines.add(def);
			console.warn(
				`No generated value of the pipeline's input passed its output schema (${def.out._def.typeName}); using the output schema to approximate the result.`,
			);
		}
		return transform.fromSchema(def.out, context);
	},
});
