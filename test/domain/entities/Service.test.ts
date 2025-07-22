import { describe, it, expect } from 'vitest';
import { Service, CreateServiceRequest, UpdateServiceRequest } from '../../../src/domain/entities/Service';

describe('Service Entity Interface', () => {
	const mockService: Service = {
		id: 123,
		name: 'Test Service',
		url: 'https://example.com',
		method: 'GET',
		expectedStatus: 200,
		expectedContent: 'OK',
		timeoutMs: 30000,
		enabled: true,
		categoryId: 456,
		monitorType: 'http',
		createdAt: new Date('2024-01-01T00:00:00.000Z'),
		updatedAt: new Date('2024-01-01T00:00:00.000Z'),
	};

	describe('Service interface properties', () => {
		it('should have all required properties for HTTP monitoring', () => {
			expect(mockService).toHaveProperty('id');
			expect(mockService).toHaveProperty('name');
			expect(mockService).toHaveProperty('url');
			expect(mockService).toHaveProperty('method');
			expect(mockService).toHaveProperty('expectedStatus');
			expect(mockService).toHaveProperty('timeoutMs');
			expect(mockService).toHaveProperty('enabled');
			expect(mockService).toHaveProperty('monitorType');
			expect(mockService).toHaveProperty('createdAt');
			expect(mockService).toHaveProperty('updatedAt');

			expect(mockService.monitorType).toBe('http');
			expect(mockService.expectedStatus).toBe(200);
			expect(mockService.enabled).toBe(true);
		});

		it('should handle optional properties', () => {
			const minimalService: Service = {
				id: 1,
				name: 'Minimal Service',
				url: 'https://minimal.example.com',
				method: 'GET',
				expectedStatus: 200,
				timeoutMs: 30000,
				enabled: true,
				monitorType: 'http',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			expect(minimalService.expectedContent).toBeUndefined();
			expect(minimalService.categoryId).toBeUndefined();
			expect(minimalService.keyword).toBeUndefined();
			expect(minimalService.requestBody).toBeUndefined();
		});

		it('should support different monitor types', () => {
			const monitorTypes: Array<Service['monitorType']> = ['http', 'keyword', 'api', 'database'];

			monitorTypes.forEach((type) => {
				const service: Service = {
					...mockService,
					monitorType: type,
				};

				expect(['http', 'keyword', 'api', 'database']).toContain(service.monitorType);
			});
		});
	});

	describe('CreateServiceRequest validation', () => {
		it('should create valid request with minimal required fields', () => {
			const createRequest: CreateServiceRequest = {
				name: 'New Service',
				url: 'https://new.example.com',
			};

			expect(createRequest.name).toBe('New Service');
			expect(createRequest.url).toBe('https://new.example.com');
			expect(createRequest.method).toBeUndefined();
			expect(createRequest.expectedStatus).toBeUndefined();
		});

		it('should support all optional fields', () => {
			const createRequest: CreateServiceRequest = {
				name: 'API Service',
				url: 'https://api.example.com',
				method: 'POST',
				expectedStatus: 201,
				expectedContent: 'Created',
				timeoutMs: 60000,
				enabled: true,
				categoryId: 789,
				monitorType: 'api',
				requestBody: '{"test": true}',
				requestHeaders: '{"Content-Type": "application/json"}',
				bearerToken: 'token123',
			};

			expect(createRequest.monitorType).toBe('api');
			expect(createRequest.requestBody).toBe('{"test": true}');
			expect(createRequest.bearerToken).toBe('token123');
		});

		it('should support database monitoring fields', () => {
			const dbRequest: CreateServiceRequest = {
				name: 'Database Check',
				url: 'postgres://localhost:5432/testdb',
				monitorType: 'database',
				databaseQuery: 'SELECT 1',
				hyperdriveId: 'hyperdrive-123',
			};

			expect(dbRequest.monitorType).toBe('database');
			expect(dbRequest.databaseQuery).toBe('SELECT 1');
			expect(dbRequest.hyperdriveId).toBe('hyperdrive-123');
		});
	});

	describe('UpdateServiceRequest validation', () => {
		it('should allow partial updates', () => {
			const updateRequest: UpdateServiceRequest = {
				name: 'Updated Service Name',
				enabled: false,
			};

			expect(updateRequest.name).toBe('Updated Service Name');
			expect(updateRequest.enabled).toBe(false);
			expect(updateRequest.url).toBeUndefined();
		});

		it('should support updating monitor-specific fields', () => {
			const updateRequest: UpdateServiceRequest = {
				monitorType: 'keyword',
				keyword: 'success',
				expectedContent: 'operation successful',
			};

			expect(updateRequest.monitorType).toBe('keyword');
			expect(updateRequest.keyword).toBe('success');
		});
	});

	describe('Service business logic helpers', () => {
		function isServiceEnabled(service: Service): boolean {
			return service.enabled;
		}

		function getServiceTimeout(service: Service): number {
			return service.timeoutMs || 30000;
		}

		function isHttpService(service: Service): boolean {
			return service.monitorType === 'http';
		}

		function isDatabaseService(service: Service): boolean {
			return service.monitorType === 'database';
		}

		function requiresAuthentication(service: Service): boolean {
			return !!service.bearerToken;
		}

		it('should correctly identify enabled services', () => {
			expect(isServiceEnabled(mockService)).toBe(true);

			const disabledService: Service = { ...mockService, enabled: false };
			expect(isServiceEnabled(disabledService)).toBe(false);
		});

		it('should return correct timeout values', () => {
			expect(getServiceTimeout(mockService)).toBe(30000);

			const customTimeoutService: Service = { ...mockService, timeoutMs: 60000 };
			expect(getServiceTimeout(customTimeoutService)).toBe(60000);
		});

		it('should identify service types correctly', () => {
			expect(isHttpService(mockService)).toBe(true);
			expect(isDatabaseService(mockService)).toBe(false);

			const dbService: Service = { ...mockService, monitorType: 'database' };
			expect(isHttpService(dbService)).toBe(false);
			expect(isDatabaseService(dbService)).toBe(true);
		});

		it('should detect authentication requirements', () => {
			expect(requiresAuthentication(mockService)).toBe(false);

			const authService: Service = { ...mockService, bearerToken: 'abc123' };
			expect(requiresAuthentication(authService)).toBe(true);
		});
	});

	describe('Service validation helpers', () => {
		function validateServiceUrl(url: string): boolean {
			try {
				new URL(url);
				return true;
			} catch {
				return false;
			}
		}

		function validateHttpMethod(method: string): boolean {
			const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
			return validMethods.includes(method.toUpperCase());
		}

		function validateStatusCode(code: number): boolean {
			return code >= 100 && code <= 599;
		}

		function validateTimeout(timeoutMs: number): boolean {
			return timeoutMs > 0 && timeoutMs <= 300000; // Max 5 minutes
		}

		it('should validate service URLs', () => {
			expect(validateServiceUrl('https://example.com')).toBe(true);
			expect(validateServiceUrl('http://localhost:3000')).toBe(true);
			expect(validateServiceUrl('invalid-url')).toBe(false);
			expect(validateServiceUrl('')).toBe(false);
		});

		it('should validate HTTP methods', () => {
			expect(validateHttpMethod('GET')).toBe(true);
			expect(validateHttpMethod('post')).toBe(true);
			expect(validateHttpMethod('PATCH')).toBe(true);
			expect(validateHttpMethod('INVALID')).toBe(false);
		});

		it('should validate status codes', () => {
			expect(validateStatusCode(200)).toBe(true);
			expect(validateStatusCode(404)).toBe(true);
			expect(validateStatusCode(500)).toBe(true);
			expect(validateStatusCode(99)).toBe(false);
			expect(validateStatusCode(600)).toBe(false);
		});

		it('should validate timeout values', () => {
			expect(validateTimeout(30000)).toBe(true);
			expect(validateTimeout(1000)).toBe(true);
			expect(validateTimeout(0)).toBe(false);
			expect(validateTimeout(400000)).toBe(false); // Over 5 minutes
		});
	});

	describe('Service data transformation', () => {
		function serviceToCreateRequest(service: Service): CreateServiceRequest {
			return {
				name: service.name,
				url: service.url,
				method: service.method,
				expectedStatus: service.expectedStatus,
				expectedContent: service.expectedContent,
				timeoutMs: service.timeoutMs,
				enabled: service.enabled,
				categoryId: service.categoryId,
				monitorType: service.monitorType,
				keyword: service.keyword,
				requestBody: service.requestBody,
				requestHeaders: service.requestHeaders,
				bearerToken: service.bearerToken,
				databaseQuery: service.databaseQuery,
				hyperdriveId: service.hyperdriveId,
			};
		}

		it('should convert service to create request format', () => {
			const createRequest = serviceToCreateRequest(mockService);

			expect(createRequest.name).toBe(mockService.name);
			expect(createRequest.url).toBe(mockService.url);
			expect(createRequest.method).toBe(mockService.method);
			expect(createRequest.monitorType).toBe(mockService.monitorType);

			// Should not include id, createdAt, updatedAt
			expect('id' in createRequest).toBe(false);
			expect('createdAt' in createRequest).toBe(false);
			expect('updatedAt' in createRequest).toBe(false);
		});
	});
});
