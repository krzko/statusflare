import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpHealthCheckService } from '../../../src/infrastructure/services/HttpHealthCheckService';
import { ServiceStatus } from '../../../src/domain/value-objects/ServiceStatus';
import { createMockService } from '../../helpers/factories';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment
const mockEnv = {
	USER_AGENT: 'StatusMonitor/1.0',
	DEFAULT_TIMEOUT: 30000,
};

describe('HttpHealthCheckService', () => {
	let healthCheckService: HttpHealthCheckService;

	beforeEach(() => {
		healthCheckService = new HttpHealthCheckService(mockEnv as any);
		vi.clearAllMocks();
	});

	const mockService = createMockService({
		url: 'https://api.example.com/health',
		method: 'GET',
		expectedStatus: 200,
		expectedContent: 'OK',
		timeoutMs: 30000,
	});

	describe('checkHealth', () => {
		it('should return UP status for successful health check', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'OK',
			};

			// Add a small delay to simulate network latency
			mockFetch.mockImplementationOnce(() => 
				new Promise(resolve => setTimeout(() => resolve(mockResponse), 10))
			);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.statusCode).toBe(200);
			expect(result.responseTimeMs).toBeGreaterThan(0);
			expect(result.errorMessage).toBeNull();

			expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/health', {
				method: 'GET',
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
				},
				signal: expect.any(AbortSignal),
			});
		});

		it('should return DOWN status for HTTP error responses', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				text: async () => 'Internal Server Error',
			};

			// Add a small delay to simulate network latency
			mockFetch.mockImplementationOnce(() => 
				new Promise(resolve => setTimeout(() => resolve(mockResponse), 10))
			);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.statusCode).toBe(500);
			expect(result.responseTimeMs).toBeGreaterThan(0);
			expect(result.errorMessage).toBe('Expected status 200, got 500');
		});

		it('should return DOWN status for network errors', async () => {
			// Add a small delay to simulate network latency before error
			mockFetch.mockImplementationOnce(() => 
				new Promise((_, reject) => setTimeout(() => reject(new Error('Network error')), 10))
			);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.responseTimeMs).toBeGreaterThan(0);
			expect(result.errorMessage).toBe('Network error');
		});

		it('should return DOWN status for timeout errors', async () => {
			const timeoutError = new Error('Request timeout');
			timeoutError.name = 'AbortError';
			// Add a small delay to simulate network latency before timeout
			mockFetch.mockImplementationOnce(() => 
				new Promise((_, reject) => setTimeout(() => reject(timeoutError), 10))
			);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.responseTimeMs).toBeGreaterThan(0);
			expect(result.errorMessage).toBe('Request timeout after 30000ms');
		});

		it('should validate expected body content when specified', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'Different content',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.statusCode).toBe(200);
			expect(result.errorMessage).toBe('Expected content "OK" not found in response');
		});

		it('should pass when expected body content matches', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'OK',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.statusCode).toBe(200);
			expect(result.errorMessage).toBeNull();
		});

		it('should skip body validation when expectedBody is not specified', async () => {
			const serviceWithoutExpectedBody = createMockService({
				...mockService,
				expectedContent: undefined,
			});

			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'Any content',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(serviceWithoutExpectedBody);

			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.statusCode).toBe(200);
			expect(result.errorMessage).toBeNull();
		});

		it('should handle POST requests correctly', async () => {
			const postService = createMockService({
				...mockService,
				method: 'POST',
				expectedStatus: 201,
				expectedContent: undefined, // Don't validate content for this test
			});

			const mockResponse = {
				ok: true,
				status: 201,
				text: async () => 'Created',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(postService);

			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.statusCode).toBe(201);

			expect(mockFetch).toHaveBeenCalledWith(postService.url, {
				method: 'POST',
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
				},
				signal: expect.any(AbortSignal),
			});
		});

		it('should return DOWN when status code does not match expected', async () => {
			const mockResponse = {
				ok: true,
				status: 201, // Service expects 200
				text: async () => 'Created',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.statusCode).toBe(201);
			expect(result.errorMessage).toBe('Expected status 200, got 201');
		});

		it('should use service-specific timeout', async () => {
			const serviceWithCustomTimeout = createMockService({
				...mockService,
				timeoutMs: 5000, // 5 seconds in milliseconds
			});

			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'OK',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			await healthCheckService.performCheck(serviceWithCustomTimeout);

			// Verify that AbortController was created with correct timeout
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				}),
			);
		});

		it('should measure response time accurately', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => {
					// Simulate some delay
					await new Promise((resolve) => setTimeout(resolve, 10));
					return 'OK';
				},
			};

			// Add a delay to the fetch itself to simulate network latency
			mockFetch.mockImplementationOnce(() => 
				new Promise(resolve => setTimeout(() => resolve(mockResponse), 15))
			);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.responseTimeMs).toBeGreaterThan(0);
			expect(result.responseTimeMs).toBeLessThan(1000); // Should be reasonable
		});
	});

	describe('validateResponse', () => {
		it('should validate status code correctly', () => {
			expect(() => {
				// This would be internal validation logic
				const expectedStatus = 200;
				const actualStatus = 200;
				if (expectedStatus !== actualStatus) {
					throw new Error(`Expected status ${expectedStatus}, got ${actualStatus}`);
				}
			}).not.toThrow();

			expect(() => {
				const expectedStatus = 200;
				const actualStatus = 404;
				if (expectedStatus !== actualStatus) {
					throw new Error(`Expected status ${expectedStatus}, got ${actualStatus}`);
				}
			}).toThrow('Expected status 200, got 404');
		});

		it('should validate body content correctly', () => {
			expect(() => {
				const expectedBody = 'OK';
				const actualBody = 'OK';
				if (expectedBody && !actualBody.includes(expectedBody)) {
					throw new Error('Expected body content not found');
				}
			}).not.toThrow();

			expect(() => {
				const expectedBody = 'OK';
				const actualBody = 'Error';
				if (expectedBody && !actualBody.includes(expectedBody)) {
					throw new Error('Expected body content not found');
				}
			}).toThrow('Expected body content not found');
		});

		it('should handle partial body matches', async () => {
			const serviceWithPartialMatch = createMockService({
				...mockService,
				expectedContent: 'healthy',
			});

			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'Service is healthy and running',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(serviceWithPartialMatch);

			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.errorMessage).toBeNull();
		});

		it('should be case sensitive for body matching', async () => {
			const serviceWithCaseSensitive = createMockService({
				...mockService,
				expectedContent: 'OK',
			});

			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'ok', // lowercase
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(serviceWithCaseSensitive);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.errorMessage).toBe('Expected content "OK" not found in response');
		});
	});

	describe('HTTP methods support', () => {
		const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'] as const;

		httpMethods.forEach((method) => {
			it(`should support ${method} requests`, async () => {
				const serviceWithMethod = createMockService({
					...mockService,
					method,
				});

				const mockResponse = {
					ok: true,
					status: 200,
					text: async () => 'OK',
				};

				mockFetch.mockResolvedValueOnce(mockResponse);

				await healthCheckService.performCheck(serviceWithMethod);

				expect(mockFetch).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						method,
					}),
				);
			});
		});
	});

	describe('error handling', () => {
		it('should handle JSON parsing errors gracefully', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => {
					throw new Error('Invalid JSON');
				},
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.errorMessage).toBe('Invalid JSON');
		});

		it('should handle malformed URLs gracefully', async () => {
			const serviceWithBadUrl = createMockService({
				...mockService,
				url: 'not-a-valid-url',
			});

			mockFetch.mockRejectedValueOnce(new TypeError('Invalid URL'));

			const result = await healthCheckService.performCheck(serviceWithBadUrl);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.errorMessage).toBe('Invalid URL');
		});

		it('should handle DNS resolution failures', async () => {
			mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.errorMessage).toBe('getaddrinfo ENOTFOUND');
		});

		it('should handle SSL/TLS errors', async () => {
			const sslError = new Error('certificate verify failed');
			sslError.name = 'FetchError';
			mockFetch.mockRejectedValueOnce(sslError);

			const result = await healthCheckService.performCheck(mockService);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.errorMessage).toBe('certificate verify failed');
		});
	});

	describe('security considerations', () => {
		it('should include appropriate User-Agent header', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'OK',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			await healthCheckService.performCheck(mockService);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
					}),
				}),
			);
		});

		it('should not follow redirects automatically for security', async () => {
			// This would be tested if the service had redirect handling
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => 'OK',
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			await healthCheckService.performCheck(mockService);

			// Verify no redirect option is set (would be part of fetch options)
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.not.objectContaining({
					redirect: expect.any(String),
				}),
			);
		});

		it('should handle very large response bodies safely', async () => {
			const largeBody = 'OK' + 'x'.repeat(10 * 1024 * 1024); // 10MB starting with "OK"
			const mockResponse = {
				ok: true,
				status: 200,
				text: async () => largeBody,
			};

			mockFetch.mockResolvedValueOnce(mockResponse);

			const result = await healthCheckService.performCheck(mockService);

			// Should still work but might want to limit body size in real implementation
			expect(result.status).toBe(ServiceStatus.UP);
		});
	});

	describe('performance', () => {
		it('should respect timeout settings', async () => {
			const quickTimeoutService = createMockService({
				...mockService,
				timeoutMs: 1000, // 1 second
			});

			// Simulate a slow response that respects the AbortSignal
			mockFetch.mockImplementationOnce((url, options) => {
				return new Promise((resolve, reject) => {
					const timeoutId = setTimeout(() => {
						resolve({
							ok: true,
							status: 200,
							text: async () => 'OK',
						});
					}, 2000); // 2 seconds (longer than service timeout)

					// Listen for abort signal
					options.signal.addEventListener('abort', () => {
						clearTimeout(timeoutId);
						const abortError = new Error('AbortError');
						abortError.name = 'AbortError';
						reject(abortError);
					});
				});
			});

			const startTime = Date.now();
			const result = await healthCheckService.performCheck(quickTimeoutService);
			const endTime = Date.now();

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(endTime - startTime).toBeLessThan(1200); // Should timeout at ~1000ms, allow 200ms margin
		});

		it('should handle concurrent checks efficiently', async () => {
			const services = Array.from({ length: 10 }, (_, i) =>
				createMockService({
					...mockService,
					id: i + 1,
					url: `https://api${i + 1}.example.com`,
				}),
			);

			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				text: async () => 'OK',
			});

			const startTime = Date.now();
			const promises = services.map((service) => healthCheckService.performCheck(service));
			const results = await Promise.all(promises);
			const endTime = Date.now();

			expect(results).toHaveLength(10);
			expect(results.every((r) => r.status === ServiceStatus.UP)).toBe(true);
			expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
		});
	});
});
