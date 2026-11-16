import { Fixture } from '@/fixture';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

describe('create catch', () => {
	const fixture = new Fixture();

	test('produces values that satisfy the inner type', () => {
		// Every value parses against a .catch() schema, so check the inner type.
		const inner = z.string().email();
		const schema = inner.catch('fallback');

		for (let seed = 0; seed < 100; seed++) {
			const value = fixture.fromSchema(schema, { seed });
			expect(inner.safeParse(value).success, `seed ${seed}`).toBe(true);
		}
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
