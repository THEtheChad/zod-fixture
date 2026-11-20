// #region defaults
interface Defaults {
	seed?: number;
	array: {
		min: number;
		max: number;
	};
	map: {
		min: number;
		max: number;
	};
	set: {
		min: number;
		max: number;
	};
	int: {
		min: number;
		max: number;
	};
	float: {
		min: number;
		max: number;
	};
	bigint: {
		min: bigint;
		max: bigint;
	};
	date: {
		min: number;
		max: number;
	};
	string: {
		min: number;
		max: number;
		characterSet: string;
	};
	recursion: {
		min: number;
		max: number;
	};
}
// #endregion defaults

// Copied from defaults in MersenneTwister.
export const randomSeed = () => Math.floor(Math.random() * Math.pow(10, 13));
const MIN_LIST_SIZE = 0;
const MAX_LIST_SIZE = 3;
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

export const constrained = {
	array: {
		min: MAX_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
	map: {
		min: MAX_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
	set: {
		min: MAX_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
	int: {
		min: -100,
		max: 100,
	},
	float: {
		min: -100,
		max: 100,
	},
	bigint: {
		min: -100n,
		max: 100n,
	},
	date: {
		min: Date.UTC(1900, 0, 1),
		max: Date.UTC(2100, 11, 31),
	},
	string: {
		min: 15,
		max: 15,
		characterSet: 'abcdefghijklmnopqrstuvwxyz-',
	},
	recursion: {
		min: 2,
		max: 2,
	},
} satisfies Defaults;

export const unconstrained = {
	array: {
		min: MIN_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
	map: {
		min: MIN_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
	set: {
		min: MIN_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
	int: {
		min: MIN_SAFE_INTEGER,
		max: MAX_SAFE_INTEGER,
	},
	float: {
		min: MIN_SAFE_INTEGER,
		max: MAX_SAFE_INTEGER,
	},
	bigint: {
		min: BigInt(MIN_SAFE_INTEGER),
		max: BigInt(MAX_SAFE_INTEGER),
	},
	date: {
		min: Date.UTC(1900, 0, 1),
		max: Date.UTC(2100, 11, 31),
	},
	string: {
		min: 0,
		max: 100,
		characterSet:
			'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,/\\!@#$%^&*()_+=-{}[]|:;?<>~`\'"',
	},
	recursion: {
		min: MIN_LIST_SIZE,
		max: MAX_LIST_SIZE,
	},
} satisfies Defaults;

/**
 * Defaults where each nested group can be overridden in part, e.g.
 * `{ string: { min: 3 } }` keeps the default `max` and `characterSet`.
 */
type PartialDefaults = {
	[K in keyof Defaults]?: Defaults[K] extends object
		? Partial<Defaults[K]>
		: Defaults[K];
};

/** Merge layers of partial defaults over complete defaults, group by group. */
export function mergeDefaults(
	base: Defaults,
	...layers: (PartialDefaults | undefined)[]
): Defaults {
	const result: Record<string, unknown> = { ...base };
	for (const layer of layers) {
		for (const [key, value] of Object.entries(layer ?? {})) {
			if (value === undefined) continue;
			const current = result[key];
			result[key] =
				typeof value === 'object' &&
				value !== null &&
				typeof current === 'object' &&
				current !== null
					? { ...current, ...value }
					: value;
		}
	}
	return result as unknown as Defaults;
}

export type { Defaults, PartialDefaults };
