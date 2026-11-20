import { expect, test } from 'vitest';
// #region example
import { z } from 'zod';
import { Fixture } from 'zod-fixture';

// Only `characterSet` is overridden; `string.min` and `string.max`
// keep their defaults, so the strings are still 15 characters long.
const fixture = new Fixture({ seed: 38, string: { characterSet: 'abc' } });

const person = fixture.fromSchema(
	z.object({
		name: z.string(),
		tags: z.array(z.string()),
	}),
);
// #endregion example

const output = Object.assign(
	// #region output
	{
		name: 'ccccccbbcbbaaba',
		tags: ['acacbbbccbbbbcb', 'cabbcbcbcaaabab', 'cacbbccbcbaacbc'],
	},
	// #endregion output
);

test('overrides part of a defaults group', () => {
	expect(person).toMatchInlineSnapshot(`
		{
		  "name": "ccccccbbcbbaaba",
		  "tags": [
		    "acacbbbccbbbbcb",
		    "cabbcbcbcaaabab",
		    "cacbbccbcbaacbc",
		  ],
		}
	`);
	expect(person).toEqual(output);
});
