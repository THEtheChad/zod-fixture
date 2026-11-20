import RandExp from 'randexp';
import { types } from 'ret';
import { describe, expect, test } from 'vitest';
import MersenneTwister from './MersenneTwister';
import {
	LengthPlanner,
	PLANNING_BUDGET,
	TokenType,
	UnplannablePattern,
} from './regexLength';

function planner(pattern: RegExp, limit: number, seed = 1) {
	const plan = new LengthPlanner(pattern, limit);
	const random = new RandExp(pattern);
	const mt = new MersenneTwister(seed);
	random.randInt = (min, max) =>
		min + Math.floor(mt.random() * (max - min + 1));
	return {
		generateBetween: (min: number, max: number) =>
			plan.generateBetween(min, max, random),
	};
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

	test('plans repeats that can be empty', () => {
		// 19 needs 19 repeats of `a`, though `b{10}` is the longest repeat.
		for (const value of generateMany(/^(a|b{10}|)*$/, 19, 19)) {
			expect(value).toHaveLength(19);
			expect(value).toMatch(/^(a|b{10}|)*$/);
		}
		// The required minimum is made up of empty repeats.
		expect(planner(/^(a?){5}$/, 2).generateBetween(2, 2)).toBe('aa');
	});

	test('treats a set that matches nothing as producing nothing', () => {
		expect(planner(/^a[^\s\S]?b$/, 3).generateBetween(2, 2)).toBe('ab');
		expect(planner(/^a[^\s\S]b$/, 3).generateBetween(0, 3)).toBeUndefined();
	});

	test('gives up on patterns that need more than the planning budget', () => {
		expect(PLANNING_BUDGET).toBeGreaterThan(0);
		const start = Date.now();
		expect(() =>
			planner(/^(aa|bbbb)*$/, 100_000).generateBetween(0, 100_000),
		).toThrow(UnplannablePattern);
		expect(Date.now() - start).toBeLessThan(2000);
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

	test('generates nested repetitions in time linear in the length', () => {
		const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
		const start = Date.now();
		const value = planner(pattern, 100_000).generateBetween(0, 100_000);
		expect(Date.now() - start).toBeLessThan(2000);
		expect(value).toMatch(pattern);
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
