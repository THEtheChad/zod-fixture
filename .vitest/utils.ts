export const ITERATIONS = process.env.SATISFY_ITERATIONS
	? Number(process.env.SATISFY_ITERATIONS)
	: 1000;

/**
 * Base seed for `toReasonablySatisfy`. Iteration `i` uses seed `SEED + i`,
 * so runs are reproducible and a failure can be replayed from its seed.
 */
export const SEED = process.env.SATISFY_SEED
	? Number(process.env.SATISFY_SEED)
	: 0;
