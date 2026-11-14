import { copyFileSync } from 'fs';
import path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			// eslint-disable-next-line no-undef
			'@': path.resolve(__dirname, './src'),
			'zod-fixture': path.resolve(__dirname, './src/public.ts'),
		},
	},
	plugins: [
		dts({
			include: ['src'],
			exclude: ['**/*.test.ts'],
			// Bundle the declarations into dist/public.d.ts, then copy it to
			// .d.mts/.d.cts so each `exports` condition gets matching types.
			rollupTypes: true,
			afterBuild: () => {
				const types = path.resolve(__dirname, 'dist/public.d.ts');
				copyFileSync(types, types.replace(/\.d\.ts$/, '.d.mts'));
				copyFileSync(types, types.replace(/\.d\.ts$/, '.d.cts'));
			},
		}),
	],
	build: {
		target: 'esnext',
		lib: {
			entry: './src/public.ts',
			name: 'ZodFixture',
			formats: ['es', 'umd'],
			fileName: (format) =>
				`zod-fixture.${format}.${format === 'umd' ? 'cjs' : 'mjs'}`,
		},
		rollupOptions: {
			external: ['randexp'],
			output: {
				globals: { randexp: 'RandExp' },
			},
		},
	},
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext',
		},
	},
	test: {
		setupFiles: ['./.vitest/extend.ts'],
	},
});
