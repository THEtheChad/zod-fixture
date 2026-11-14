import { Fixture } from '@/fixture';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

describe('create catch', () => {
	const fixture = new Fixture();

	test('produces a valid catch', () => {
		expect(fixture).toReasonablySatisfy(z.string().catch('fallback'));
	});

	test('generates the inner type rather than the catch value', () => {
		const schema = z.number().min(5).catch(0);

		for (let seed = 0; seed < 100; seed++) {
			expect(fixture.fromSchema(schema, { seed })).toBeGreaterThanOrEqual(5);
		}
	});

	test('uses the catch value when the inner type cannot be generated', () => {
		const schema = z.never().catch('fallback' as never);
		expect(fixture.fromSchema(schema)).toBe('fallback');
	});

	test('passes a ZodError to the catch callback', () => {
		const schema = z
			.never()
			.catch((ctx) => `issues: ${ctx.error.issues.length}` as never);
		expect(fixture.fromSchema(schema)).toBe('issues: 1');
	});
});
