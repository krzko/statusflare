import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitorServicesUseCase } from '../../../src/application/usecases/MonitorServicesUseCase';
import { Service } from '../../../src/domain/entities/Service';
import { StatusCheck } from '../../../src/domain/entities/StatusCheck';
import { ServiceStatus } from '../../../src/domain/value-objects/ServiceStatus';
import { createMockService, createMockStatusCheck } from '../../helpers/factories';

// Mock dependencies
const mockServiceRepository = {
	findAll: vi.fn(),
	findById: vi.fn(),
	findByName: vi.fn(),
	findEnabled: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};

const mockStatusCheckRepository = {
	findByServiceId: vi.fn(),
	findByServiceIdInTimeRange: vi.fn(),
	findLatestByServiceId: vi.fn(),
	findRecent: vi.fn(),
	create: vi.fn(),
	deleteOld: vi.fn(),
};

const mockHealthCheckService = {
	performCheck: vi.fn(),
};

describe('MonitorServicesUseCase', () => {
	let useCase: MonitorServicesUseCase;

	beforeEach(() => {
		// Reset all mocks completely
		vi.clearAllMocks();
		vi.resetAllMocks();

		useCase = new MonitorServicesUseCase(
			mockServiceRepository as any,
			mockStatusCheckRepository as any,
			mockHealthCheckService as any
		);
	});

	const mockActiveServices = [
		createMockService({
			id: 1,
			name: 'Test Service 1',
			url: 'https://api1.example.com',
			method: 'GET',
			expectedStatus: 200,
			timeoutMs: 30000,
			enabled: true,
		}),
		createMockService({
			id: 2,
			name: 'Test Service 2',
			url: 'https://api2.example.com',
			method: 'POST',
			expectedStatus: 201,
			expectedContent: 'Created',
			timeoutMs: 60000,
			enabled: true,
		}),
	];

	describe('execute', () => {
		it('should monitor all active services and save status checks', async () => {
			// Setup mocks
			mockServiceRepository.findEnabled.mockResolvedValueOnce(mockActiveServices);

			mockHealthCheckService.performCheck
				.mockResolvedValueOnce({
					status: ServiceStatus.UP,
					responseTimeMs: 150,
					statusCode: 200,
					errorMessage: null,
				})
				.mockResolvedValueOnce({
					status: ServiceStatus.DOWN,
					responseTimeMs: 0,
					statusCode: 500,
					errorMessage: 'Internal Server Error',
				});

			mockStatusCheckRepository.create
				.mockResolvedValueOnce(
					createMockStatusCheck({
						id: '1',
						serviceId: 1,
						status: ServiceStatus.UP,
						responseTimeMs: 150,
						statusCode: 200,
						checkedAt: new Date(),
						errorMessage: null,
					})
				)
				.mockResolvedValueOnce(
					createMockStatusCheck({
						id: '2',
						serviceId: 2,
						status: ServiceStatus.DOWN,
						responseTimeMs: 0,
						statusCode: 500,
						checkedAt: new Date(),
						errorMessage: 'Internal Server Error',
					})
				);

			// Execute
			await useCase.execute();

			// Verify
			expect(mockServiceRepository.findEnabled).toHaveBeenCalledOnce();
			expect(mockHealthCheckService.performCheck).toHaveBeenCalledTimes(2);
			expect(mockStatusCheckRepository.create).toHaveBeenCalledTimes(2);

			// Verify first service check
			expect(mockHealthCheckService.performCheck).toHaveBeenNthCalledWith(1, mockActiveServices[0]);

			// Verify second service check
			expect(mockHealthCheckService.performCheck).toHaveBeenNthCalledWith(2, mockActiveServices[1]);
		});

		it('should handle empty active services list', async () => {
			mockServiceRepository.findEnabled.mockResolvedValueOnce([]);

			await useCase.execute();

			expect(mockServiceRepository.findEnabled).toHaveBeenCalledOnce();
			expect(mockHealthCheckService.performCheck).not.toHaveBeenCalled();
			expect(mockStatusCheckRepository.create).not.toHaveBeenCalled();
		});

		it('should continue monitoring other services when one fails', async () => {
			mockServiceRepository.findEnabled.mockResolvedValueOnce(mockActiveServices);

			// First service check fails
			mockHealthCheckService.performCheck
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockResolvedValueOnce({
					status: ServiceStatus.UP,
					responseTimeMs: 200,
					statusCode: 200,
					errorMessage: null,
				});

			// Should still save a status check for the failed service
			mockStatusCheckRepository.create
				.mockResolvedValueOnce(
					createMockStatusCheck({
						id: '1',
						serviceId: 1,
						status: ServiceStatus.DOWN,
						responseTimeMs: 0,
						statusCode: 0,
						checkedAt: new Date(),
						errorMessage: 'Network timeout',
					})
				)
				.mockResolvedValueOnce(
					createMockStatusCheck({
						id: '2',
						serviceId: 2,
						status: ServiceStatus.UP,
						responseTimeMs: 200,
						statusCode: 200,
						checkedAt: new Date(),
						errorMessage: null,
					})
				);

			await useCase.execute();

			expect(mockHealthCheckService.performCheck).toHaveBeenCalledTimes(2);
			expect(mockStatusCheckRepository.create).toHaveBeenCalledTimes(2);
		});

		it('should handle repository save failures gracefully', async () => {
			mockServiceRepository.findEnabled.mockResolvedValueOnce([mockActiveServices[0]]);

			mockHealthCheckService.performCheck.mockResolvedValueOnce({
				status: ServiceStatus.UP,
				responseTimeMs: 150,
				statusCode: 200,
				errorMessage: null,
			});

			// Repository save fails
			mockStatusCheckRepository.create.mockRejectedValueOnce(new Error('Database error'));

			// Should not throw an error
			await expect(useCase.execute()).resolves.not.toThrow();

			expect(mockHealthCheckService.performCheck).toHaveBeenCalledOnce();
			expect(mockStatusCheckRepository.create).toHaveBeenCalledOnce();
		});
	});

	describe('checkSingleService', () => {
		it('should check a single service and return status check', async () => {
			const service = mockActiveServices[0];

			mockHealthCheckService.performCheck.mockResolvedValueOnce({
				status: ServiceStatus.UP,
				responseTimeMs: 120,
				statusCode: 200,
				errorMessage: null,
			});

			mockStatusCheckRepository.create.mockResolvedValueOnce(
				createMockStatusCheck({
					id: '1',
					serviceId: parseInt(service.id!),
					status: ServiceStatus.UP,
					responseTimeMs: 120,
					statusCode: 200,
					checkedAt: new Date(),
					errorMessage: null,
				})
			);

			const result = await useCase.checkSingleService(service);

			expect(result).toBeDefined();
			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.responseTimeMs).toBe(120);
			expect(result.statusCode).toBe(200);
			expect(result.errorMessage).toBeNull();

			expect(mockHealthCheckService.performCheck).toHaveBeenCalledWith(service);
			expect(mockStatusCheckRepository.create).toHaveBeenCalled();
		});

		it('should handle health check failures and create down status', async () => {
			const service = mockActiveServices[0];

			mockHealthCheckService.performCheck.mockRejectedValueOnce(new Error('Connection refused'));

			mockStatusCheckRepository.create.mockResolvedValueOnce(
				createMockStatusCheck({
					id: '1',
					serviceId: parseInt(service.id!),
					status: ServiceStatus.DOWN,
					responseTimeMs: 0,
					statusCode: 0,
					checkedAt: new Date(),
					errorMessage: 'Connection refused',
				})
			);

			const result = await useCase.checkSingleService(service);

			expect(result.status).toBe(ServiceStatus.DOWN);
			expect(result.responseTimeMs).toBe(0);
			expect(result.statusCode).toBe(0);
			expect(result.errorMessage).toBe('Connection refused');
		});

		it('should handle save failures after successful health check', async () => {
			const service = mockActiveServices[0];

			mockHealthCheckService.performCheck.mockResolvedValueOnce({
				status: ServiceStatus.UP,
				responseTimeMs: 150,
				statusCode: 200,
				errorMessage: null,
			});

			mockStatusCheckRepository.create.mockRejectedValueOnce(new Error('Database full'));

			// Should still return the check result even if save fails
			const result = await useCase.checkSingleService(service);

			expect(result.status).toBe(ServiceStatus.UP);
			expect(result.responseTimeMs).toBe(150);
			expect(mockHealthCheckService.performCheck).toHaveBeenCalledWith(service);
			expect(mockStatusCheckRepository.create).toHaveBeenCalled();
		});
	});

	describe('business logic validation', () => {
		it('should only monitor services that are active', async () => {
			const inactiveService = createMockService({
				...mockActiveServices[0],
				enabled: false,
			});

			mockServiceRepository.findEnabled.mockResolvedValueOnce([inactiveService]);

			await useCase.execute();

			// Should call findActiveServices, which should exclude inactive services
			expect(mockServiceRepository.findEnabled).toHaveBeenCalledOnce();
			expect(mockHealthCheckService.performCheck).not.toHaveBeenCalled();
		});

		it('should create status checks with correct timestamps', async () => {
			const service = mockActiveServices[0];
			const beforeTime = new Date();

			mockHealthCheckService.performCheck.mockResolvedValueOnce({
				status: ServiceStatus.UP,
				responseTimeMs: 100,
				statusCode: 200,
				errorMessage: null,
			});

			let savedStatusCheck: any;
			mockStatusCheckRepository.create.mockImplementationOnce(statusCheck => {
				savedStatusCheck = statusCheck;
				return Promise.resolve(statusCheck);
			});

			await useCase.checkSingleService(service);

			const afterTime = new Date();

			expect(savedStatusCheck.checkedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
			expect(savedStatusCheck.checkedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
		});

		it('should preserve service ID in status checks', async () => {
			const service = mockActiveServices[0];

			mockHealthCheckService.performCheck.mockResolvedValueOnce({
				status: ServiceStatus.UP,
				responseTimeMs: 100,
				statusCode: 200,
				errorMessage: null,
			});

			let savedStatusCheck: any;
			mockStatusCheckRepository.create.mockImplementationOnce(statusCheck => {
				savedStatusCheck = statusCheck;
				return Promise.resolve(statusCheck);
			});

			await useCase.checkSingleService(service);

			expect(savedStatusCheck.serviceId).toBe(parseInt(service.id!));
		});
	});

	describe('error handling and resilience', () => {
		it('should handle repository findActiveServices failure', async () => {
			mockServiceRepository.findEnabled.mockRejectedValueOnce(
				new Error('Database connection lost')
			);

			await expect(useCase.execute()).rejects.toThrow('Database connection lost');
		});

		it('should handle partial failures gracefully', async () => {
			const services = [mockActiveServices[0], mockActiveServices[1]];
			mockServiceRepository.findEnabled.mockResolvedValueOnce(services);

			// First service succeeds, second fails
			mockHealthCheckService.performCheck
				.mockResolvedValueOnce({
					status: ServiceStatus.UP,
					responseTimeMs: 100,
					statusCode: 200,
					errorMessage: null,
				})
				.mockRejectedValueOnce(new Error('Timeout'));

			mockStatusCheckRepository.create
				.mockResolvedValueOnce(
					createMockStatusCheck({
						id: '1',
						serviceId: 1,
						status: ServiceStatus.UP,
						responseTimeMs: 100,
						statusCode: 200,
						checkedAt: new Date(),
						errorMessage: null,
					})
				)
				.mockResolvedValueOnce(
					createMockStatusCheck({
						id: '2',
						serviceId: 2,
						status: ServiceStatus.DOWN,
						responseTimeMs: 0,
						statusCode: 0,
						checkedAt: new Date(),
						errorMessage: 'Timeout',
					})
				);

			await useCase.execute();

			expect(mockHealthCheckService.performCheck).toHaveBeenCalledTimes(2);
			expect(mockStatusCheckRepository.create).toHaveBeenCalledTimes(2);
		});
	});

	describe('performance considerations', () => {
		it('should handle large numbers of services efficiently', async () => {
			// Create 100 mock services
			const manyServices = Array.from({ length: 100 }, (_, i) =>
				createMockService({
					id: (i + 1).toString(),
					name: `Service ${i + 1}`,
					url: `https://api${i + 1}.example.com`,
					method: 'GET',
					expectedStatus: 200,
					timeoutMs: 30000,
					intervalMs: 300000,
					enabled: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
			);

			mockServiceRepository.findEnabled.mockResolvedValueOnce(manyServices);

			// Mock all health checks to succeed
			mockHealthCheckService.performCheck.mockResolvedValue({
				status: ServiceStatus.UP,
				responseTimeMs: 100,
				statusCode: 200,
				errorMessage: null,
			});

			// Mock all saves to succeed
			mockStatusCheckRepository.create.mockImplementation(check => Promise.resolve(check));

			const startTime = Date.now();
			await useCase.execute();
			const endTime = Date.now();

			expect(mockHealthCheckService.performCheck).toHaveBeenCalledTimes(100);
			expect(mockStatusCheckRepository.create).toHaveBeenCalledTimes(100);

			// Should complete in reasonable time (adjust threshold as needed)
			expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
		});
	});
});
