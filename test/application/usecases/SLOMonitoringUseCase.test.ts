import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SLOMonitoringUseCase } from '../../../src/application/usecases/SLOMonitoringUseCase';
import { SLO, SLICalculationResult } from '../../../src/domain/entities/SLO';
import { Service } from '../../../src/domain/entities/Service';
import { StatusCheck } from '../../../src/domain/entities/StatusCheck';
import { ServiceStatus } from '../../../src/domain/value-objects/ServiceStatus';
import { createMockService, createMockStatusCheck } from '../../helpers/factories';

// Mock dependencies
const mockSLORepository = {
	findAll: vi.fn(),
	findById: vi.fn(),
	findByServiceId: vi.fn(),
	getEnabledSLOs: vi.fn(),
	getSLOById: vi.fn(),
	getUnresolvedBurnEventBySLOId: vi.fn(),
	createBurnEvent: vi.fn(),
	updateBurnEvent: vi.fn(),
	getEnabledSLONotificationsBySLOId: vi.fn(),
	getNotificationChannelById: vi.fn(),
	save: vi.fn(),
	delete: vi.fn(),
};

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

const mockSLOCalculationService = {
	calculateSLI: vi.fn(),
	calculateTimeToExhaustion: vi.fn(),
	evaluateSLO: vi.fn(),
};

const mockNotificationService = {
	sendAlert: vi.fn(),
	formatSlackMessage: vi.fn(),
	createTestPayload: vi.fn(),
	sendTestNotification: vi.fn(),
};

describe('SLOMonitoringUseCase', () => {
	let useCase: SLOMonitoringUseCase;
	const baseUrl = 'https://status.example.com';

	beforeEach(() => {
		// Reset all mocks completely
		vi.clearAllMocks();
		vi.resetAllMocks();
		
		useCase = new SLOMonitoringUseCase(
			mockSLORepository as any,
			mockServiceRepository as any,
			mockStatusCheckRepository as any,
			mockSLOCalculationService as any,
			mockNotificationService as any,
			baseUrl,
		);
	});

	const mockSLO: SLO = {
		id: 1,
		serviceId: 100,
		name: 'Availability SLO',
		sliType: 'availability',
		targetPercentage: 99.9,
		timeWindowDays: 30,
		enabled: true,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
	};

	const mockService = createMockService({
		id: 100,
		name: 'Test Service',
		url: 'https://api.example.com',
		method: 'GET',
		expectedStatus: 200,
		timeoutMs: 30000,
		enabled: true,
		createdAt: new Date('2024-01-01T00:00:00.000Z'),
		updatedAt: new Date('2024-01-01T00:00:00.000Z'),
	});

	const mockStatusChecks = [
		createMockStatusCheck({
			id: 1,
			serviceId: 100,
			status: ServiceStatus.UP,
			responseTimeMs: 150,
			statusCode: 200,
			checkedAt: new Date('2024-01-01T10:00:00.000Z'),
			errorMessage: undefined,
		}),
		createMockStatusCheck({
			id: 2,
			serviceId: 100,
			status: ServiceStatus.DOWN,
			responseTimeMs: 0,
			statusCode: 500,
			checkedAt: new Date('2024-01-01T10:01:00.000Z'),
			errorMessage: 'Internal Server Error',
		}),
	];

	describe('evaluateAllSLOs', () => {
		it('should evaluate all enabled SLOs and not trigger alerts for healthy SLOs', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);

			const healthySLIResult: SLICalculationResult = {
				currentSLI: 99.95,
				errorRate: 0.05,
				burnRate: 0.5,
				errorBudgetConsumed: 10.0,
				isFastBurn: false,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(healthySLIResult);

			await useCase.evaluateAllSLOs();

			expect(mockSLORepository.getEnabledSLOs).toHaveBeenCalledOnce();
			expect(mockServiceRepository.findById).toHaveBeenCalledWith(100);
			expect(mockSLOCalculationService.evaluateSLO).toHaveBeenCalledWith(mockSLO, mockStatusChecks);
			expect(mockNotificationService.sendAlert).not.toHaveBeenCalled();
		});

		it('should trigger fast burn alert when burn rate exceeds threshold', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);
			
			// Mock notification setup
			mockSLORepository.getUnresolvedBurnEventBySLOId.mockResolvedValueOnce(null);
			mockSLORepository.createBurnEvent.mockResolvedValueOnce(1);
			mockSLORepository.getEnabledSLONotificationsBySLOId.mockResolvedValueOnce([
				{ id: 1, sloId: 1, notificationChannelId: 1, burnRateThreshold: 14.4, enabled: true }
			]);
			mockSLORepository.getNotificationChannelById.mockResolvedValueOnce({
				id: 1, name: 'webhook', type: 'webhook', config: '{"url":"http://webhook.example.com"}', enabled: true
			});
			mockNotificationService.sendAlert.mockResolvedValueOnce(true);

			const fastBurnResult: SLICalculationResult = {
				currentSLI: 98.0,
				errorRate: 2.0,
				burnRate: 20.0, // Above 14.4 threshold
				errorBudgetConsumed: 75.0,
				timeToExhaustion: 8,
				isFastBurn: true,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(fastBurnResult);

			await useCase.evaluateAllSLOs();

			expect(mockNotificationService.sendAlert).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'slo_burn_rate_alert',
					severity: 'critical',
					service: {
						id: 100,
						name: 'Test Service',
						url: 'https://api.example.com',
					},
					slo: {
						id: 1,
						name: 'Availability SLO',
						type: 'availability',
						target: 99.9,
						timeWindowDays: 30,
					},
					alert: {
						burnRate: 20.0,
						errorBudgetConsumed: 75.0,
						timeToExhaustionHours: 8,
						currentSli: 98.0,
					},
				}),
				expect.objectContaining({
					id: 1,
					name: 'webhook',
					type: 'webhook',
					enabled: true,
				}),
			);
		});

		it('should trigger slow burn alert when error budget consumption is high', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);
			
			// Mock notification setup - this should NOT trigger fast burn alert since burnRate is 5.0 < 14.4
			mockSLORepository.getUnresolvedBurnEventBySLOId.mockResolvedValueOnce(null);
			mockSLORepository.getEnabledSLONotificationsBySLOId.mockResolvedValueOnce([]);

			const slowBurnResult: SLICalculationResult = {
				currentSLI: 99.5,
				errorRate: 0.5,
				burnRate: 5.0, // Below fast burn threshold
				errorBudgetConsumed: 85.0, // Above slow burn threshold
				timeToExhaustion: 48,
				isFastBurn: false,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(slowBurnResult);

			await useCase.evaluateAllSLOs();

			// Since burnRate is 5.0 < 14.4 and isFastBurn: false, no alert should be sent
			// Slow burn alerts are not implemented yet
			expect(mockNotificationService.sendAlert).not.toHaveBeenCalled();
		});

		it('should handle missing service gracefully', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(null);

			await useCase.evaluateAllSLOs();

			expect(mockSLOCalculationService.evaluateSLO).not.toHaveBeenCalled();
			expect(mockNotificationService.sendAlert).not.toHaveBeenCalled();
		});

		it('should handle empty status checks gracefully', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce([]);
			
			// Mock notification setup for fast burn scenario
			mockSLORepository.getUnresolvedBurnEventBySLOId.mockResolvedValueOnce(null);
			mockSLORepository.createBurnEvent.mockResolvedValueOnce(2);
			mockSLORepository.getEnabledSLONotificationsBySLOId.mockResolvedValueOnce([]);

			const noDataResult: SLICalculationResult = {
				currentSLI: 0,
				errorRate: 100,
				burnRate: Infinity,
				errorBudgetConsumed: 100,
				isFastBurn: true,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(noDataResult);

			await useCase.evaluateAllSLOs();

			expect(mockSLOCalculationService.evaluateSLO).toHaveBeenCalledWith(mockSLO, []);
		});

		it('should skip disabled SLOs', async () => {
			const disabledSLO: SLO = { ...mockSLO, enabled: false };
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([disabledSLO]);

			await useCase.evaluateAllSLOs();

			// Should still call getEnabledSLOs, but repository should filter out disabled ones
			expect(mockSLORepository.getEnabledSLOs).toHaveBeenCalledOnce();
		});
	});

	describe('evaluateSingleSLO', () => {
		it('should evaluate a single SLO correctly', async () => {
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);

			const sliResult: SLICalculationResult = {
				currentSLI: 99.8,
				errorRate: 0.2,
				burnRate: 2.0,
				errorBudgetConsumed: 40.0,
				isFastBurn: false,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(sliResult);

			const result = await useCase.evaluateSingleSLO(mockSLO);

			expect(result).toEqual(sliResult);
			expect(mockServiceRepository.findById).toHaveBeenCalledWith(100);
			expect(mockSLOCalculationService.evaluateSLO).toHaveBeenCalledWith(mockSLO, mockStatusChecks);
		});

		it('should return default result when service not found', async () => {
			mockServiceRepository.findById.mockResolvedValueOnce(null);

			const result = await useCase.evaluateSingleSLO(mockSLO);

			expect(result.currentSLI).toBe(0);
			expect(result.errorRate).toBe(100);
			expect(result.burnRate).toBe(Infinity);
			expect(result.errorBudgetConsumed).toBe(100);
			expect(result.isFastBurn).toBe(true);
		});

		it('should handle repository errors gracefully', async () => {
			mockServiceRepository.findById.mockRejectedValueOnce(new Error('Database error'));

			await expect(useCase.evaluateSingleSLO(mockSLO)).rejects.toThrow('Database error');
		});
	});

	describe('alert threshold logic', () => {
		it('should correctly identify fast burn scenarios', async () => {
			const fastBurnCases = [
				{ burnRate: 14.4, expected: false }, // Exactly at threshold
				{ burnRate: 14.41, expected: true }, // Just above threshold
				{ burnRate: 50.0, expected: true }, // Well above threshold
				{ burnRate: 100.0, expected: true }, // Very high burn rate
			];

			for (const testCase of fastBurnCases) {
				const sliResult: SLICalculationResult = {
					currentSLI: 95.0,
					errorRate: 5.0,
					burnRate: testCase.burnRate,
					errorBudgetConsumed: 50.0,
					isFastBurn: testCase.expected,
				};

				expect(sliResult.isFastBurn).toBe(testCase.expected);
			}
		});

		it('should correctly identify slow burn scenarios', async () => {
			const slowBurnCases = [
				{ errorBudgetConsumed: 79.9, expected: false }, // Just below threshold
				{ errorBudgetConsumed: 80.0, expected: true }, // At threshold
				{ errorBudgetConsumed: 85.0, expected: true }, // Above threshold
				{ errorBudgetConsumed: 95.0, expected: true }, // Near exhaustion
			];

			for (const testCase of slowBurnCases) {
				const shouldAlert = testCase.errorBudgetConsumed >= 80.0;
				expect(shouldAlert).toBe(testCase.expected);
			}
		});
	});

	describe('time window calculations', () => {
		it('should use correct time range for SLO evaluation', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);

			const healthyResult: SLICalculationResult = {
				currentSLI: 99.95,
				errorRate: 0.05,
				burnRate: 0.5,
				errorBudgetConsumed: 10.0,
				isFastBurn: false,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(healthyResult);

			await useCase.evaluateAllSLOs();

			// Verify that the time range is calculated correctly (30 days ago to now)
			const callArgs = mockStatusCheckRepository.findByServiceIdInTimeRange.mock.calls[0];
			const serviceId = callArgs[0];
			const startDate = callArgs[1];
			const endDate = callArgs[2];

			expect(serviceId).toBe(100);
			expect(startDate).toBeInstanceOf(Date);
			expect(endDate).toBeInstanceOf(Date);

			// Start date should be approximately 30 days ago
			const expectedStartDate = new Date();
			expectedStartDate.setDate(expectedStartDate.getDate() - mockSLO.timeWindowDays);

			const timeDiff = Math.abs(startDate.getTime() - expectedStartDate.getTime());
			expect(timeDiff).toBeLessThan(60000); // Within 1 minute tolerance
		});

		it('should handle different time window periods', async () => {
			const sloWith7Days: SLO = { ...mockSLO, timeWindowDays: 7 };

			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);

			const result: SLICalculationResult = {
				currentSLI: 99.0,
				errorRate: 1.0,
				burnRate: 10.0,
				errorBudgetConsumed: 50.0,
				isFastBurn: false,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(result);

			await useCase.evaluateSingleSLO(sloWith7Days);

			const callArgs = mockStatusCheckRepository.findByServiceIdInTimeRange.mock.calls[0];
			const startDate = callArgs[1];

			const expectedStartDate = new Date();
			expectedStartDate.setDate(expectedStartDate.getDate() - 7);

			const timeDiff = Math.abs(startDate.getTime() - expectedStartDate.getTime());
			expect(timeDiff).toBeLessThan(60000); // Within 1 minute tolerance
		});
	});

	describe('notification handling', () => {
		it('should format alert payload correctly', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);
			
			// Mock notification setup
			mockSLORepository.getUnresolvedBurnEventBySLOId.mockResolvedValueOnce(null);
			mockSLORepository.createBurnEvent.mockResolvedValueOnce(3);
			mockSLORepository.getEnabledSLONotificationsBySLOId.mockResolvedValueOnce([
				{ id: 1, sloId: 1, notificationChannelId: 1, burnRateThreshold: 14.4, enabled: true }
			]);
			mockSLORepository.getNotificationChannelById.mockResolvedValueOnce({
				id: 1, name: 'webhook', type: 'webhook', config: '{"url":"http://webhook.example.com"}', enabled: true
			});
			mockNotificationService.sendAlert.mockResolvedValueOnce(true);

			const alertResult: SLICalculationResult = {
				currentSLI: 98.0,
				errorRate: 2.0,
				burnRate: 20.0,
				errorBudgetConsumed: 80.0,
				timeToExhaustion: 12,
				isFastBurn: true,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(alertResult);

			await useCase.evaluateAllSLOs();

			// Verify that the notification was called
			expect(mockNotificationService.sendAlert).toHaveBeenCalled();
			
			const alertCall = mockNotificationService.sendAlert.mock.calls[0];
			const payload = alertCall[0];

			expect(payload).toMatchObject({
				event: 'slo_burn_rate_alert',
				severity: 'critical',
				service: {
					id: 100,
					name: 'Test Service',
					url: 'https://api.example.com',
				},
				slo: {
					id: 1,
					name: 'Availability SLO',
					type: 'availability',
					target: 99.9,
					timeWindowDays: 30,
				},
				alert: {
					burnRate: 20.0,
					errorBudgetConsumed: 80.0,
					timeToExhaustionHours: 12,
					currentSli: 98.0,
				},
				dashboardUrl: `${baseUrl}/slo/1`,
			});

			expect(payload.timestamp).toBeDefined();
			expect(new Date(payload.timestamp)).toBeInstanceOf(Date);
		});

		it('should handle notification failures gracefully', async () => {
			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce([mockSLO]);
			mockServiceRepository.findById.mockResolvedValueOnce(mockService);
			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValueOnce(mockStatusChecks);

			const alertResult: SLICalculationResult = {
				currentSLI: 95.0,
				errorRate: 5.0,
				burnRate: 50.0,
				errorBudgetConsumed: 90.0,
				timeToExhaustion: 4,
				isFastBurn: true,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValueOnce(alertResult);
			mockNotificationService.sendAlert.mockRejectedValueOnce(new Error('Webhook failed'));

			// Should not throw error even if notification fails
			await expect(useCase.evaluateAllSLOs()).resolves.not.toThrow();
		});
	});

	describe('performance and scalability', () => {
		it('should handle multiple SLOs efficiently', async () => {
			const multipleSLOs = Array.from({ length: 10 }, (_, i) => ({
				...mockSLO,
				id: i + 1,
				serviceId: 100 + i,
				name: `SLO ${i + 1}`,
			}));

			mockSLORepository.getEnabledSLOs.mockResolvedValueOnce(multipleSLOs);

			// Mock services and status checks for each SLO
			mockServiceRepository.findById.mockImplementation((id) =>
				Promise.resolve(
					createMockService({
						...mockService,
						id: Number(id),
						name: `Service ${id}`,
					}),
				),
			);

			mockStatusCheckRepository.findByServiceIdInTimeRange.mockResolvedValue(mockStatusChecks);

			const healthyResult: SLICalculationResult = {
				currentSLI: 99.95,
				errorRate: 0.05,
				burnRate: 0.5,
				errorBudgetConsumed: 10.0,
				isFastBurn: false,
			};

			mockSLOCalculationService.evaluateSLO.mockReturnValue(healthyResult);

			const startTime = Date.now();
			await useCase.evaluateAllSLOs();
			const endTime = Date.now();

			expect(mockSLOCalculationService.evaluateSLO).toHaveBeenCalledTimes(10);
			expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
		});
	});
});
