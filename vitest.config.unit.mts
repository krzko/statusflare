import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		exclude: ['test/index.spec.ts'], // Exclude the existing integration test
		globals: true,
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/index.ts'],
			reporter: ['text', 'html', 'lcov'],
		},
	},
	resolve: {
		alias: {
			'@': '/src',
		},
	},
});
