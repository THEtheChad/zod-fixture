import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	{
		ignores: [
			'**/dist',
			'**/node_modules',
			'coverage',
			'docs/.vitepress/cache',
		],
	},
	js.configs.recommended,
	tseslint.configs.recommended,
	prettier,
	{
		rules: {
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports' },
			],
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-unsafe-declaration-merging': 'off',
		},
	},
);
