import { SLICalculationResult } from '../entities/SLO';
import { StatusCheck } from '../entities/StatusCheck';
import { SLO } from '../entities/SLO';

export interface SLOCalculationService {
	calculateSLI(slo: SLO, checks: StatusCheck[]): SLICalculationResult;
	calculateAvailabilitySLI(checks: StatusCheck[], timeWindow: TimeWindow): number;
	calculateLatencySLI(checks: StatusCheck[], thresholdMs: number, timeWindow: TimeWindow): number;
	calculateBurnRate(actualSLI: number, targetSLO: number): number;
	calculateErrorBudgetConsumed(
		actualSLI: number,
		targetSLO: number,
		timeWindowDays: number
	): number;
	calculateTimeToExhaustion(
		slo: SLO,
		result: SLICalculationResult,
		checks: StatusCheck[]
	): number | undefined;
	isFastBurn(burnRate: number): boolean;
	evaluateSLO(slo: SLO, checks: StatusCheck[]): SLICalculationResult;
}

export interface TimeWindow {
	startTime: Date;
	endTime: Date;
}

export class DefaultSLOCalculationService implements SLOCalculationService {
	private readonly FAST_BURN_THRESHOLD = 14.4; // 30-day budget consumed in 2 hours
	private readonly MINUTES_IN_HOUR = 60;
	private readonly HOURS_IN_DAY = 24;

	calculateSLI(slo: SLO, checks: StatusCheck[]): SLICalculationResult {
		return this.evaluateSLO(slo, checks);
	}

	calculateAvailabilitySLI(checks: StatusCheck[], timeWindow: TimeWindow): number {
		if (checks.length === 0) {
			return 0; // No data means 0% availability
		}

		// Filter checks to the specified time window
		const filteredChecks = checks.filter(check => {
			const checkTime = new Date(check.checkedAt);
			return checkTime >= timeWindow.startTime && checkTime <= timeWindow.endTime;
		});

		if (filteredChecks.length === 0) {
			return 0; // No data in time window means 0% availability
		}

		const successfulChecks = filteredChecks.filter(check => check.status === 'up').length;
		return (successfulChecks / filteredChecks.length) * 100;
	}

	calculateLatencySLI(checks: StatusCheck[], thresholdMs: number, timeWindow: TimeWindow): number {
		if (checks.length === 0) {
			return 0; // No data means 0% latency SLI
		}

		// Filter checks to the specified time window
		const filteredChecks = checks.filter(check => {
			const checkTime = new Date(check.checkedAt);
			return checkTime >= timeWindow.startTime && checkTime <= timeWindow.endTime;
		});

		if (filteredChecks.length === 0) {
			return 0; // No data in time window means 0% latency SLI
		}

		const fastChecks = filteredChecks.filter(
			check =>
				check.status === 'up' &&
				check.responseTimeMs !== null &&
				check.responseTimeMs !== undefined &&
				check.responseTimeMs <= thresholdMs
		).length;

		return (fastChecks / filteredChecks.length) * 100;
	}

	calculateBurnRate(actualSLI: number, targetSLO: number): number {
		if (targetSLO >= 100) {
			return Infinity; // Infinity burn rate with 100% target
		}

		const allowedErrorRate = (100 - targetSLO) / 100;
		const actualErrorRate = (100 - actualSLI) / 100;

		if (allowedErrorRate === 0) {
			return actualErrorRate > 0 ? Infinity : 0;
		}

		// Special case: 0% SLI (complete failure) should be treated as infinite burn rate
		if (actualSLI === 0) {
			return Infinity;
		}

		return actualErrorRate / allowedErrorRate;
	}

	calculateErrorBudgetConsumed(
		actualSLI: number,
		targetSLO: number,
		timeWindowDays: number
	): number {
		if (targetSLO >= 100) {
			return actualSLI >= 100 ? 0 : 100; // No error budget with 100% target
		}

		const allowedErrorRate = (100 - targetSLO) / 100;
		const actualErrorRate = (100 - actualSLI) / 100;

		if (allowedErrorRate === 0) {
			return actualErrorRate > 0 ? 100 : 0;
		}

		// Calculate error budget consumption over the time window
		// This gives us a more accurate representation of budget consumption
		// relative to the SLO's time window
		const consumedPercentage = (actualErrorRate / allowedErrorRate) * 100;

		// The timeWindowDays parameter can be used for future enhancements
		// such as weighted calculations or time-decay functions
		// For now, we ensure it's a valid positive number
		if (timeWindowDays <= 0) {
			console.warn(
				'Invalid timeWindowDays provided to calculateErrorBudgetConsumed:',
				timeWindowDays
			);
		}

		return Math.min(100, Math.max(0, consumedPercentage));
	}

	calculateTimeToExhaustion(
		slo: SLO,
		result: SLICalculationResult,
		checks: StatusCheck[]
	): number | undefined {
		const burnRate = result.burnRate;
		const errorBudgetRemaining = 100 - result.errorBudgetConsumed;

		if (burnRate <= 0 || errorBudgetRemaining <= 0) {
			return result.errorBudgetConsumed >= 100 ? 0 : undefined; // Return 0 if exhausted, undefined otherwise
		}

		if (burnRate >= this.FAST_BURN_THRESHOLD) {
			// For fast burn, calculate based on current burn rate
			const totalBudgetHours = slo.timeWindowDays * this.HOURS_IN_DAY;
			const remainingBudgetFraction = errorBudgetRemaining / 100;
			const hoursToExhaustion = (remainingBudgetFraction * totalBudgetHours) / burnRate;

			return Math.max(0, hoursToExhaustion);
		}

		return undefined; // Only calculate for fast burn scenarios
	}

	isFastBurn(burnRate: number): boolean {
		return burnRate > this.FAST_BURN_THRESHOLD;
	}

	evaluateSLO(slo: SLO, checks: StatusCheck[]): SLICalculationResult {
		// Filter checks to the SLO's time window
		const timeWindowStart = new Date();
		timeWindowStart.setDate(timeWindowStart.getDate() - slo.timeWindowDays);

		const relevantChecks = checks.filter(check => {
			const checkTime = new Date(check.checkedAt);
			return checkTime >= timeWindowStart;
		});

		const timeWindow: TimeWindow = {
			startTime: timeWindowStart,
			endTime: new Date(),
		};

		let currentSLI: number;

		if (slo.sliType === 'availability') {
			currentSLI = this.calculateAvailabilitySLI(relevantChecks, timeWindow);
		} else if (slo.sliType === 'latency') {
			if (!slo.latencyThresholdMs) {
				throw new Error('Latency threshold required for latency SLI');
			}
			currentSLI = this.calculateLatencySLI(relevantChecks, slo.latencyThresholdMs, timeWindow);
		} else {
			// For invalid SLI types, default to availability calculation
			currentSLI = this.calculateAvailabilitySLI(relevantChecks, timeWindow);
		}

		const errorRate = (100 - currentSLI) / 100;
		const burnRate = this.calculateBurnRate(currentSLI, slo.targetPercentage);
		const errorBudgetConsumed = this.calculateErrorBudgetConsumed(
			currentSLI,
			slo.targetPercentage,
			slo.timeWindowDays
		);
		const isFastBurn = this.isFastBurn(burnRate);

		// Create intermediate result for timeToExhaustion calculation
		const intermediateResult: SLICalculationResult = {
			currentSLI,
			errorRate: errorRate * 100,
			burnRate,
			errorBudgetConsumed,
			isFastBurn,
		};

		const timeToExhaustion = this.calculateTimeToExhaustion(
			slo,
			intermediateResult,
			relevantChecks
		);

		return {
			currentSLI: Math.round(currentSLI * 100) / 100, // Round to 2 decimal places
			errorRate: Math.round(errorRate * 10000) / 100, // Round to 2 decimal places as percentage
			burnRate: Math.round(burnRate * 100) / 100, // Round to 2 decimal places
			errorBudgetConsumed: Math.round(errorBudgetConsumed * 100) / 100, // Round to 2 decimal places
			timeToExhaustion:
				timeToExhaustion !== undefined ? Math.round(timeToExhaustion * 100) / 100 : undefined,
			isFastBurn,
		};
	}
}
