import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultSLOCalculationService } from '../../../src/domain/services/SLOCalculationService';
import { SLO, SLICalculationResult } from '../../../src/domain/entities/SLO';
import { ServiceStatus } from '../../../src/domain/value-objects/ServiceStatus';

describe('DefaultSLOCalculationService', () => {
	let sloCalculationService: DefaultSLOCalculationService;

	beforeEach(() => {
		sloCalculationService = new DefaultSLOCalculationService();
	});

	const mockAvailabilitySLO: SLO = {
		id: 1,
		serviceId: 100,
		name: 'Availability SLO',
		sliType: 'availability',
		targetPercentage: 99.9,
		timeWindowDays: 30,
		enabled: true,
	};

	const mockLatencySLO: SLO = {
		id: 2,
		serviceId: 100,
		name: 'Latency SLO',
		sliType: 'latency',
		targetPercentage: 95.0,
		latencyThresholdMs: 500,
		timeWindowDays: 7,
		enabled: true,
	};

	const now = new Date();
	const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
	const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
	const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
	const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

	const mockStatusChecks = [
		{
			id: 1,
			serviceId: 100,
			status: ServiceStatus.UP,
			responseTimeMs: 200,
			statusCode: 200,
			checkedAt: oneHourAgo,
			errorMessage: null,
		},
		{
			id: 2,
			serviceId: 100,
			status: ServiceStatus.UP,
			responseTimeMs: 300,
			statusCode: 200,
			checkedAt: twoHoursAgo,
			errorMessage: null,
		},
		{
			id: 3,
			serviceId: 100,
			status: ServiceStatus.DOWN,
			responseTimeMs: 0,
			statusCode: 500,
			checkedAt: threeHoursAgo,
			errorMessage: 'Internal Server Error',
		},
		{
			id: 4,
			serviceId: 100,
			status: ServiceStatus.UP,
			responseTimeMs: 600,
			statusCode: 200,
			checkedAt: fourHoursAgo,
			errorMessage: null,
		},
	];

	describe('calculateSLI', () => {
		it('should calculate availability SLI correctly', () => {
			const result = sloCalculationService.calculateSLI(mockAvailabilitySLO, mockStatusChecks);

			// 3 UP out of 4 total = 75% availability
			expect(result.currentSLI).toBe(75);
			expect(result.errorRate).toBe(25);
			expect(result.isFastBurn).toBe(true); // High error rate
		});

		it('should calculate latency SLI correctly', () => {
			const result = sloCalculationService.calculateSLI(mockLatencySLO, mockStatusChecks);

			// 2 requests under 500ms out of 4 total = 50%
			expect(result.currentSLI).toBe(50);
			expect(result.errorRate).toBe(50);
			expect(result.isFastBurn).toBe(false); // Burn rate is 10.0 which is < 14.4
		});

		it('should handle empty status checks', () => {
			const result = sloCalculationService.calculateSLI(mockAvailabilitySLO, []);

			expect(result.currentSLI).toBe(0);
			expect(result.errorRate).toBe(100);
			expect(result.burnRate).toBe(Infinity);
			expect(result.errorBudgetConsumed).toBe(100);
			expect(result.isFastBurn).toBe(true);
		});

		it('should calculate burn rate correctly', () => {
			const result = sloCalculationService.calculateSLI(mockAvailabilitySLO, mockStatusChecks);

			// Error rate is 25%, target error rate is 0.1%
			// Burn rate = 25 / 0.1 = 250
			expect(result.burnRate).toBe(250);
		});

		it('should calculate error budget consumption correctly', () => {
			const result = sloCalculationService.calculateSLI(mockAvailabilitySLO, mockStatusChecks);

			// With 4 checks and 1 failure, and target of 99.9%
			// Error budget = 0.1% of 4 = 0.004 checks
			// Failed checks = 1
			// Consumption = min(100, (1 / 0.004) * 100) = 100%
			expect(result.errorBudgetConsumed).toBe(100);
		});
	});

	describe('calculateTimeToExhaustion', () => {
		it('should calculate time to exhaustion when burn rate is high', () => {
			const mockResult: SLICalculationResult = {
				currentSLI: 99.0,
				errorRate: 1.0,
				burnRate: 20.0, // High burn rate > 14.4
				errorBudgetConsumed: 50.0,
				isFastBurn: true,
			};

			const timeToExhaustion = sloCalculationService.calculateTimeToExhaustion(mockAvailabilitySLO, mockResult, mockStatusChecks);

			expect(timeToExhaustion).toBeGreaterThan(0);
			expect(timeToExhaustion).toBeLessThan(1000); // Should be a reasonable time
		});

		it('should return undefined when burn rate is zero or negative', () => {
			const mockResult: SLICalculationResult = {
				currentSLI: 100,
				errorRate: 0,
				burnRate: 0,
				errorBudgetConsumed: 0,
				isFastBurn: false,
			};

			const timeToExhaustion = sloCalculationService.calculateTimeToExhaustion(mockAvailabilitySLO, mockResult, mockStatusChecks);

			expect(timeToExhaustion).toBeUndefined();
		});

		it('should handle edge case where error budget is already exhausted', () => {
			const mockResult: SLICalculationResult = {
				currentSLI: 95.0,
				errorRate: 5.0,
				burnRate: 50.0,
				errorBudgetConsumed: 100.0,
				isFastBurn: true,
			};

			const timeToExhaustion = sloCalculationService.calculateTimeToExhaustion(mockAvailabilitySLO, mockResult, mockStatusChecks);

			expect(timeToExhaustion).toBe(0);
		});
	});

	describe('isFastBurn', () => {
		it('should identify fast burn scenarios correctly', () => {
			// Test with high burn rate (> 14.4)
			const result = sloCalculationService.calculateSLI(mockAvailabilitySLO, [
				{
					id: 1,
					serviceId: 100,
					status: ServiceStatus.DOWN,
					responseTimeMs: 0,
					statusCode: 500,
					checkedAt: now,
					errorMessage: 'Error',
				},
			]);

			expect(result.isFastBurn).toBe(true);
		});

		it('should not identify slow burn as fast burn', () => {
			// Test with low burn rate
			const mostlyUpChecks = Array.from({ length: 1000 }, (_, i) => ({
				id: i + 1,
				serviceId: 100,
				status: i < 999 ? ServiceStatus.UP : ServiceStatus.DOWN,
				responseTimeMs: 200,
				statusCode: i < 999 ? 200 : 500,
				checkedAt: new Date(now.getTime() - i * 1000), // Spread out over time
				errorMessage: i < 999 ? null : 'Error',
			}));

			const result = sloCalculationService.calculateSLI(mockAvailabilitySLO, mostlyUpChecks);

			expect(result.isFastBurn).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle SLO with 100% target percentage', () => {
			const perfectSLO: SLO = {
				...mockAvailabilitySLO,
				targetPercentage: 100,
			};

			const result = sloCalculationService.calculateSLI(perfectSLO, mockStatusChecks);

			expect(result.burnRate).toBe(Infinity);
			expect(result.errorBudgetConsumed).toBe(100);
		});

		it('should handle checks with missing response times for latency SLO', () => {
			const checksWithoutResponseTime = mockStatusChecks.map((check) => ({
				...check,
				responseTimeMs: check.status === ServiceStatus.DOWN ? 0 : check.responseTimeMs,
			}));

			const result = sloCalculationService.calculateSLI(mockLatencySLO, checksWithoutResponseTime);

			expect(result.currentSLI).toBeGreaterThanOrEqual(0);
			expect(result.currentSLI).toBeLessThanOrEqual(100);
		});

		it('should validate SLO type before calculation', () => {
			const invalidSLO = {
				...mockAvailabilitySLO,
				sliType: 'invalid' as any,
			};

			// Should default to availability calculation for unknown types
			const result = sloCalculationService.calculateSLI(invalidSLO, mockStatusChecks);

			expect(result.currentSLI).toBe(75); // Same as availability calculation
		});
	});
});
