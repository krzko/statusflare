import { describe, it, expect } from 'vitest';
import { SLO, SLICalculationResult } from '../../../src/domain/entities/SLO';

describe('SLO Types and Calculations', () => {
	const mockSLO: SLO = {
		id: 123,
		serviceId: 456,
		name: 'Test SLO',
		sliType: 'availability',
		targetPercentage: 99.9,
		timeWindowDays: 30,
		enabled: true,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
	};

	const mockLatencySLO: SLO = {
		id: 124,
		serviceId: 456,
		name: 'Test Latency SLO',
		sliType: 'latency',
		targetPercentage: 95.0,
		latencyThresholdMs: 500,
		timeWindowDays: 7,
		enabled: true,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
	};

	describe('SLO interface properties', () => {
		it('should have all required properties for availability SLO', () => {
			expect(mockSLO).toHaveProperty('id');
			expect(mockSLO).toHaveProperty('serviceId');
			expect(mockSLO).toHaveProperty('name');
			expect(mockSLO).toHaveProperty('sliType');
			expect(mockSLO).toHaveProperty('targetPercentage');
			expect(mockSLO).toHaveProperty('timeWindowDays');
			expect(mockSLO).toHaveProperty('enabled');

			expect(mockSLO.sliType).toBe('availability');
			expect(mockSLO.targetPercentage).toBe(99.9);
			expect(mockSLO.timeWindowDays).toBe(30);
			expect(mockSLO.enabled).toBe(true);
		});

		it('should have latency threshold for latency SLO', () => {
			expect(mockLatencySLO.sliType).toBe('latency');
			expect(mockLatencySLO.latencyThresholdMs).toBe(500);
			expect(mockLatencySLO.targetPercentage).toBe(95.0);
		});

		it('should handle optional properties', () => {
			const minimalSLO: SLO = {
				serviceId: 456,
				name: 'Minimal SLO',
				sliType: 'availability',
				targetPercentage: 99.0,
				timeWindowDays: 7,
				enabled: true,
			};

			expect(minimalSLO.id).toBeUndefined();
			expect(minimalSLO.createdAt).toBeUndefined();
			expect(minimalSLO.updatedAt).toBeUndefined();
			expect(minimalSLO.latencyThresholdMs).toBeUndefined();
		});
	});

	describe('SLI calculation helpers', () => {
		function calculateErrorBudget(slo: SLO, totalChecks: number): number {
			return Math.floor(((100 - slo.targetPercentage) / 100) * totalChecks);
		}

		function calculateCurrentSLI(successfulChecks: number, totalChecks: number): number {
			if (totalChecks === 0) {
				return 0;
			}
			return (successfulChecks / totalChecks) * 100;
		}

		function calculateBurnRate(currentSLI: number, targetSLI: number): number {
			const errorRate = 100 - currentSLI;
			const targetErrorRate = 100 - targetSLI;
			if (targetErrorRate === 0) {
				return 0;
			}
			return errorRate / targetErrorRate;
		}

		function isSLOMet(currentSLI: number, targetSLI: number): boolean {
			return currentSLI >= targetSLI;
		}

		it('should calculate error budget correctly', () => {
			// Use a simpler SLO for the calculation
			const simpleSLO: SLO = { ...mockSLO, targetPercentage: 99.0 };
			const totalChecks = 100;
			const errorBudget = calculateErrorBudget(simpleSLO, totalChecks);

			// Error budget = (100 - 99.0) / 100 * 100 = 1.0 * 1 = 1
			expect(errorBudget).toBe(1);
		});

		it('should calculate current SLI correctly', () => {
			const successfulChecks = 995;
			const totalChecks = 1000;
			const currentSLI = calculateCurrentSLI(successfulChecks, totalChecks);

			expect(currentSLI).toBe(99.5);
		});

		it('should handle zero total checks for SLI calculation', () => {
			const currentSLI = calculateCurrentSLI(0, 0);
			expect(currentSLI).toBe(0);
		});

		it('should calculate burn rate correctly', () => {
			const currentSLI = 99.0; // 1% error rate
			const targetSLI = 99.9; // 0.1% target error rate
			const burnRate = calculateBurnRate(currentSLI, targetSLI);

			// Burn rate = 1% / 0.1% = 10
			expect(burnRate).toBeCloseTo(10, 1);
		});

		it('should handle perfect SLI for burn rate calculation', () => {
			const currentSLI = 100;
			const targetSLI = 99.9;
			const burnRate = calculateBurnRate(currentSLI, targetSLI);

			expect(burnRate).toBe(0);
		});

		it('should determine if SLO is met', () => {
			expect(isSLOMet(99.9, 99.9)).toBe(true);
			expect(isSLOMet(100, 99.9)).toBe(true);
			expect(isSLOMet(99.8, 99.9)).toBe(false);
		});
	});

	describe('SLICalculationResult validation', () => {
		it('should validate SLI calculation result structure', () => {
			const result: SLICalculationResult = {
				currentSLI: 99.5,
				errorRate: 0.5,
				burnRate: 5.0,
				errorBudgetConsumed: 50.0,
				timeToExhaustion: 24,
				isFastBurn: true,
			};

			expect(result.currentSLI).toBe(99.5);
			expect(result.errorRate).toBe(0.5);
			expect(result.burnRate).toBe(5.0);
			expect(result.errorBudgetConsumed).toBe(50.0);
			expect(result.timeToExhaustion).toBe(24);
			expect(result.isFastBurn).toBe(true);
		});

		it('should handle optional timeToExhaustion field', () => {
			const result: SLICalculationResult = {
				currentSLI: 100,
				errorRate: 0,
				burnRate: 0,
				errorBudgetConsumed: 0,
				isFastBurn: false,
			};

			expect(result.timeToExhaustion).toBeUndefined();
		});
	});

	describe('SLO type validation', () => {
		it('should validate availability SLO type', () => {
			expect(['availability', 'latency']).toContain(mockSLO.sliType);
			expect(mockSLO.sliType).toBe('availability');
		});

		it('should validate latency SLO type with threshold', () => {
			expect(mockLatencySLO.sliType).toBe('latency');
			expect(mockLatencySLO.latencyThresholdMs).toBeGreaterThan(0);
		});

		it('should validate target percentage ranges', () => {
			expect(mockSLO.targetPercentage).toBeGreaterThan(0);
			expect(mockSLO.targetPercentage).toBeLessThanOrEqual(100);

			expect(mockLatencySLO.targetPercentage).toBeGreaterThan(0);
			expect(mockLatencySLO.targetPercentage).toBeLessThanOrEqual(100);
		});

		it('should validate time window is positive', () => {
			expect(mockSLO.timeWindowDays).toBeGreaterThan(0);
			expect(mockLatencySLO.timeWindowDays).toBeGreaterThan(0);
		});
	});
});
