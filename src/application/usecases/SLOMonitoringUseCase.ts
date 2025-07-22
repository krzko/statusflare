import { SLORepository } from '../../domain/repositories/SLORepository';
import { ServiceRepository } from '../../domain/repositories/ServiceRepository';
import { StatusCheckRepository } from '../../domain/repositories/StatusCheckRepository';
import { SLOCalculationService } from '../../domain/services/SLOCalculationService';
import { NotificationService } from '../../domain/services/NotificationService';
import {
	SLO,
	SLOBurnEvent,
	SLOAlertPayload,
	SLICalculationResult,
} from '../../domain/entities/SLO';

export class SLOMonitoringUseCase {
	constructor(
		private sloRepository: SLORepository,
		private serviceRepository: ServiceRepository,
		private statusCheckRepository: StatusCheckRepository,
		private sloCalculationService: SLOCalculationService,
		private notificationService: NotificationService,
		private baseUrl: string
	) {}

	async evaluateAllSLOs(): Promise<void> {
		console.log('Starting SLO evaluation for all enabled SLOs');

		try {
			const enabledSLOs = await this.sloRepository.getEnabledSLOs();
			console.log(`Found ${enabledSLOs.length} enabled SLOs to evaluate`);

			for (const slo of enabledSLOs) {
				await this.evaluateSLO(slo);
			}

			console.log('Completed SLO evaluation for all enabled SLOs');
		} catch (error) {
			console.error('Failed to evaluate SLOs:', error);
			throw error;
		}
	}

	async evaluateSLO(slo: SLO): Promise<void> {
		try {
			console.log(`Evaluating SLO: ${slo.name} (ID: ${slo.id}) for service ${slo.serviceId}`);

			// Get service details
			const service = await this.serviceRepository.findById(slo.serviceId);
			if (!service) {
				console.warn(`Service not found for SLO ${slo.id}, skipping evaluation`);
				return;
			}

			// Get status checks for the time window
			const timeWindowStart = new Date();
			timeWindowStart.setDate(timeWindowStart.getDate() - slo.timeWindowDays);

			const checks = await this.statusCheckRepository.findByServiceIdInTimeRange(
				slo.serviceId,
				timeWindowStart,
				new Date()
			);

			console.log(`Retrieved ${checks.length} status checks for SLO evaluation`);

			// Calculate SLI and burn rate
			const calculation = this.sloCalculationService.evaluateSLO(slo, checks);

			console.log(`SLO calculation result:`, {
				sloId: slo.id,
				currentSLI: calculation.currentSLI,
				burnRate: calculation.burnRate,
				errorBudgetConsumed: calculation.errorBudgetConsumed,
				isFastBurn: calculation.isFastBurn,
			});

			// Check if we have an unresolved burn event for this SLO
			const existingBurnEvent = await this.sloRepository.getUnresolvedBurnEventBySLOId(slo.id!);

			if (calculation.isFastBurn) {
				await this.handleFastBurn(slo, service, calculation, existingBurnEvent);
			} else if (existingBurnEvent) {
				await this.handleBurnResolution(slo, service, calculation, existingBurnEvent);
			}
		} catch (error) {
			console.error(`Failed to evaluate SLO ${slo.id}:`, error);
		}
	}

	async evaluateSingleSLO(slo: SLO): Promise<SLICalculationResult> {
		try {
			console.log(
				`Evaluating single SLO: ${slo.name} (ID: ${slo.id}) for service ${slo.serviceId}`
			);

			// Get service details
			const service = await this.serviceRepository.findById(slo.serviceId);
			if (!service) {
				console.warn(`Service not found for SLO ${slo.id}, returning default result`);
				return {
					currentSLI: 0,
					errorRate: 100,
					burnRate: Infinity,
					errorBudgetConsumed: 100,
					isFastBurn: true,
				};
			}

			// Get status checks for the time window
			const timeWindowStart = new Date();
			timeWindowStart.setDate(timeWindowStart.getDate() - slo.timeWindowDays);

			const checks = await this.statusCheckRepository.findByServiceIdInTimeRange(
				slo.serviceId,
				timeWindowStart,
				new Date()
			);

			console.log(`Retrieved ${checks.length} status checks for single SLO evaluation`);

			// Calculate SLI and burn rate
			const calculation = this.sloCalculationService.evaluateSLO(slo, checks);

			console.log(`Single SLO calculation result:`, {
				sloId: slo.id,
				currentSLI: calculation.currentSLI,
				burnRate: calculation.burnRate,
				errorBudgetConsumed: calculation.errorBudgetConsumed,
				isFastBurn: calculation.isFastBurn,
			});

			return calculation;
		} catch (error) {
			console.error(`Failed to evaluate single SLO ${slo.id}:`, error);
			throw error;
		}
	}

	private async handleFastBurn(
		slo: SLO,
		service: any,
		calculation: any,
		existingBurnEvent: SLOBurnEvent | null
	): Promise<void> {
		if (existingBurnEvent) {
			// Update existing burn event with latest metrics
			await this.sloRepository.updateBurnEvent(existingBurnEvent.id!, {
				burnRate: calculation.burnRate,
				errorBudgetConsumedPercentage: calculation.errorBudgetConsumed,
				timeToExhaustionHours: calculation.timeToExhaustion,
			});

			console.log(`Updated existing burn event ${existingBurnEvent.id} for SLO ${slo.id}`);
		} else {
			// Create new burn event
			const burnEventId = await this.sloRepository.createBurnEvent({
				sloId: slo.id!,
				burnRate: calculation.burnRate,
				errorBudgetConsumedPercentage: calculation.errorBudgetConsumed,
				timeToExhaustionHours: calculation.timeToExhaustion,
			});

			console.log(`Created new burn event ${burnEventId} for SLO ${slo.id}`);

			// Send alert notifications
			await this.sendBurnRateAlert(slo, service, calculation, 'slo_burn_rate_alert');
		}
	}

	private async handleBurnResolution(
		slo: SLO,
		service: any,
		calculation: any,
		existingBurnEvent: SLOBurnEvent
	): Promise<void> {
		// Resolve the burn event
		await this.sloRepository.updateBurnEvent(existingBurnEvent.id!, {
			resolvedAt: new Date().toISOString(),
		});

		console.log(`Resolved burn event ${existingBurnEvent.id} for SLO ${slo.id}`);

		// Send resolution notification
		await this.sendBurnRateAlert(slo, service, calculation, 'slo_burn_resolved');
	}

	private async sendBurnRateAlert(
		slo: SLO,
		service: any,
		calculation: any,
		eventType: 'slo_burn_rate_alert' | 'slo_burn_resolved'
	): Promise<void> {
		try {
			// Get enabled notification rules for this SLO
			const notificationRules = await this.sloRepository.getEnabledSLONotificationsBySLOId(slo.id!);

			if (notificationRules.length === 0) {
				console.log(`No notification rules configured for SLO ${slo.id}, skipping alerts`);
				return;
			}

			console.log(`Found ${notificationRules.length} notification rules for SLO ${slo.id}`);

			// Check burn rate threshold (only for alerts, not resolutions)
			if (eventType === 'slo_burn_rate_alert') {
				const applicableRules = notificationRules.filter(
					rule => calculation.burnRate >= rule.burnRateThreshold
				);

				if (applicableRules.length === 0) {
					console.log(
						`Burn rate ${calculation.burnRate} below threshold for all rules, skipping alerts`
					);
					return;
				}
			}

			// Create alert payload
			const payload: SLOAlertPayload = {
				event: eventType,
				timestamp: new Date().toISOString(),
				severity: calculation.burnRate >= 14.4 ? 'critical' : 'warning',
				service: {
					id: service.id,
					name: service.name,
					url: service.url,
				},
				slo: {
					id: slo.id!,
					name: slo.name,
					type: slo.sliType,
					target: slo.targetPercentage,
					timeWindowDays: slo.timeWindowDays,
				},
				alert: {
					burnRate: calculation.burnRate,
					errorBudgetConsumed: calculation.errorBudgetConsumed,
					timeToExhaustionHours: calculation.timeToExhaustion,
					currentSli: calculation.currentSLI,
				},
				dashboardUrl: `${this.baseUrl}/slo/${slo.id}`,
			};

			// Send notifications to all configured channels
			for (const rule of notificationRules) {
				const channel = await this.sloRepository.getNotificationChannelById(
					rule.notificationChannelId
				);
				if (!channel || !channel.enabled) {
					console.warn(`Notification channel ${rule.notificationChannelId} not found or disabled`);
					continue;
				}

				const success = await this.notificationService.sendAlert(payload, channel);
				if (success) {
					console.log(`Successfully sent ${eventType} notification via ${channel.name}`);
				} else {
					console.error(`Failed to send ${eventType} notification via ${channel.name}`);
				}
			}
		} catch (error) {
			console.error('Failed to send burn rate alert:', error);
		}
	}

	// Public method for testing/debugging individual SLO calculations
	async calculateSLOMetrics(sloId: number): Promise<any> {
		const slo = await this.sloRepository.getSLOById(sloId);
		if (!slo) {
			throw new Error(`SLO not found: ${sloId}`);
		}

		const service = await this.serviceRepository.findById(slo.serviceId);
		if (!service) {
			throw new Error(`Service not found for SLO: ${sloId}`);
		}

		const timeWindowStart = new Date();
		timeWindowStart.setDate(timeWindowStart.getDate() - slo.timeWindowDays);

		const checks = await this.statusCheckRepository.findByServiceIdInTimeRange(
			slo.serviceId,
			timeWindowStart,
			new Date()
		);

		const calculation = this.sloCalculationService.evaluateSLO(slo, checks);

		return {
			slo,
			service,
			checksCount: checks.length,
			timeWindow: {
				start: timeWindowStart.toISOString(),
				end: new Date().toISOString(),
				days: slo.timeWindowDays,
			},
			calculation,
		};
	}
}
