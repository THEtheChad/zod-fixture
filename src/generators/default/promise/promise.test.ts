import { Core } from '@/core/core';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { PromiseGenerator } from '.';
import { NumberGenerator } from '../number';

describe('create empty types', () => {
	const core = new Core().register([PromiseGenerator, NumberGenerator]);

	test('creates a promise with the correct type', () => {
		expect(
			core.generate(z.promise(z.number()), { path: [] }),
		).resolves.toBeTypeOf('number');
	});
});