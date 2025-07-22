import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: {
					configPath: './wrangler.jsonc',
					compatibilityDate: '2024-11-11',
					compatibilityFlags: ['nodejs_compat'],
				},
				miniflare: {
					// Override bindings for testing
					bindings: {
						BASE_URL: 'https://test.example.com',
						SITE_TITLE: 'Test Status Page',
						RSS_TITLE_SUFFIX: 'Test Updates',
					},
					d1Databases: {
						DB: 'test-db',
					},
					r2Buckets: {
						R2: 'test-bucket',
					},
				},
			},
		},
	},
});
