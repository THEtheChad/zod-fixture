import { expect } from 'vitest';
import type { ZodTypeAny } from 'zod';
import type { Transformer } from '../src/transformer/transformer';
import { findUncheckable } from './uncheckable';
import { ITERATIONS, SEED } from './utils';

const stringify = (value: unknown) =>
	JSON.stringify(
		value,
		(_key, value) =>
			// javascript does not natively support bigints in JSON.stringify
			// https://github.com/GoogleChromeLabs/jsbi/issues/30
			typeof value === 'bigint' ? value.toString() : value,
		2,
	);

expect.extend({
	toReasonablySatisfy(
		transform: Transformer,
		schema: ZodTypeAny,
		iterations = ITERATIONS,
	) {
		// With .not, one bad seed out of thousands would pass the assertion.
		if (this.isNot) {
			throw new Error('toReasonablySatisfy does not support .not');
		}

		const reason = findUncheckable(schema);
		if (reason) {
			throw new Error(
				`toReasonablySatisfy can't check this schema: ${reason}. ` +
					'Check the generated values directly instead.',
			);
		}

		for (let i = 0; i < iterations; i++) {
			// Every `fromSchema` call builds a fresh, seeded generator, so the seed
			// must change per iteration or every iteration yields the same value.
			const seed = SEED + i;

			let fixture: unknown;
			try {
				fixture = transform.fromSchema(schema, { seed });
			} catch (error) {
				return {
					pass: false,
					message: () =>
						`Generation threw at iteration ${i} (seed ${seed}): ${
							error instanceof Error ? error.stack : String(error)
						}`,
				};
			}

			const result = schema.safeParse(fixture);

			if (result.success === false) {
				return {
					pass: false,
					message: () =>
						`Fixture failed validation at iteration ${i} (seed ${seed}):\n` +
						stringify({ fixture, issues: result.error.issues }),
				};
			}
		}

		return {
			pass: true,
			message: () =>
				`Successfully ran ${iterations} iterations (seeds ${SEED}..${
					SEED + iterations - 1
				}).`,
		};
	},
});
