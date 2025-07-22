import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	js.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			globals: {
				console: 'readonly',
				URL: 'readonly',
				fetch: 'readonly',
				Request: 'readonly',
				Response: 'readonly',
				AbortController: 'readonly',
				AbortSignal: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				Hyperdrive: 'readonly',
				Env: 'readonly',
				IncomingRequestCfProperties: 'readonly',
				ExecutionContext: 'readonly',
				D1Database: 'readonly',
				RequestInit: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,

			// Code quality rules
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',

			// Style rules following Google Style Guide
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'variableLike',
					format: ['camelCase', 'UPPER_CASE'],
				},
				{
					selector: 'typeLike',
					format: ['PascalCase'],
				},
				{
					selector: 'interface',
					format: ['PascalCase'],
				},
			],

			// Best practices
			'@typescript-eslint/no-magic-numbers': [
				'warn',
				{ ignore: [0, 1, -1, 24, 60, 100, 200, 404, 500, 1000] },
			],

			// Security rules
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',

			// Best practices
			'prefer-const': 'error',
			'no-var': 'error',
			eqeqeq: 'error',
			curly: 'error',
		},
	},
	{
		files: ['**/*.test.ts', '**/*.spec.ts'],
		languageOptions: {
			globals: {
				global: 'readonly',
				vitest: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				vi: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
			},
		},
		rules: {
			// Relax some rules for test files
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-magic-numbers': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/naming-convention': 'off',
		},
	},
	{
		ignores: ['dist/', 'node_modules/', '.wrangler/', 'coverage/', '*.config.js', '*.config.mjs'],
	},
];
