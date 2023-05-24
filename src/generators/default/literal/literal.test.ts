import { Core } from '@/core/core';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { LiteralGenerator } from '.';

describe('create literals', () => {
    const core = new Core().register([LiteralGenerator]);

	test('creates a string literal and returns its value', () => {
		expect(core.generate(z.literal('tuna'), { path: [] })).toBe('tuna');
	});

	test('creates a number literal and returns its value', () => {
		expect(core.generate(z.literal(12), { path: [] })).toBe(12);
	});

	test('creates a boolean literal and returns its value', () => {
		expect(core.generate(z.literal(true), { path: [] })).toBe(true);
	});
});