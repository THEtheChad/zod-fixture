import RandExp from 'randexp';
import { types } from 'ret';
import { describe, expect, test } from 'vitest';
import MersenneTwister from './MersenneTwister';
import { LengthPlanner, TokenType, UnplannablePattern } from './regexLength';

function planner(pattern: RegExp, limit: number, seed = 1) {
	const randexp = new RandExp(pattern);
	const mt = new MersenneTwister(seed);
	randexp.randInt = (min, max) =>
		min + Math.floor(mt.random() * (max - min + 1));
	return new LengthPlanner(randexp, limit);
}

/** Matches of `pattern` for several seeds, each between `min` and `max`. */
function generateMany(pattern: RegExp, min: number, max: number) {
	return Array.from({ length: 50 }, (_, seed) =>
		planner(pattern, max, seed).generateBetween(min, max),
	);
}

describe('regexLength', () => {
	test("mirrors ret's token types", () => {
		expect(TokenType).toEqual({
			ROOT: types.ROOT,
			GROUP: types.GROUP,
			POSITION: types.POSITION,
			SET: types.SET,
			RANGE: types.RANGE,
			REPETITION: types.REPETITION,
			REFERENCE: types.REFERENCE,
			CHAR: types.CHAR,
		});
	});

	test.each([
		[/^\d+$/, 150, 150],
		[/^[a-z]+(-[a-z]+)*$/, 20, 20],
		[/^(abc)+$/, 12, 12],
		[/^(ab|abcd|x)+$/, 9, 9],
		[/^(a?b?)*c$/, 7, 7],
		[/^[a-f]{2,4}-[0-9]{1,3}$/, 4, 8],
		[/^[a-z]+$/i, 40, 40],
		[/^(?=.*\d)[a-z0-9]+$/, 10, 10],
	])('generates %s with a length from %i to %i', (pattern, min, max) => {
		for (const value of generateMany(pattern, min, max)) {
			expect(value?.length).toBeGreaterThanOrEqual(min);
			expect(value?.length).toBeLessThanOrEqual(max);
			// Lookaheads aren't generated, so only check the rest of the pattern.
			expect(value).toMatch(
				new RegExp(pattern.source.replace('(?=.*\\d)', ''), pattern.flags),
			);
		}
	});

	test('is seeded', () => {
		const a = planner(/^[a-z]+(-[a-z]+)*$/, 20, 7).generateBetween(20, 20);
		const b = planner(/^[a-z]+(-[a-z]+)*$/, 20, 7).generateBetween(20, 20);
		expect(a).toBe(b);
	});

	test('returns undefined when no match has an allowed length', () => {
		expect(planner(/^(abc)+$/, 10).generateBetween(10, 10)).toBeUndefined();
		expect(planner(/^\d{3}$/, 2).generateBetween(0, 2)).toBeUndefined();
	});

	test("can't plan back-references", () => {
		expect(() => planner(/^(a+)-\1$/, 9).generateBetween(9, 9)).toThrow(
			UnplannablePattern,
		);
	});

	test('handles long exact lengths quickly', () => {
		const value = planner(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 5000).generateBetween(
			5000,
			5000,
		);
		expect(value).toHaveLength(5000);
		expect(value).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
	});
});
