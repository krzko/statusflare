import { ServiceRepository } from '../../domain/repositories/ServiceRepository';
import { StatusCheckRepository } from '../../domain/repositories/StatusCheckRepository';
import { PageConfigRepository } from '../../domain/repositories/PageConfigRepository';
import { CategoryRepository } from '../../domain/repositories/CategoryRepository';
import { SystemStatusRepository } from '../../domain/repositories/SystemStatusRepository';
import { IncidentRepository } from '../../domain/repositories/IncidentRepository';
import { IncidentUpdateRepository } from '../../domain/repositories/IncidentUpdateRepository';
import {
	PageGeneratorService,
	StatusPageData,
	CategoryStatusData,
	ServiceStatusData,
	IncidentData,
	HistoryPoint,
} from '../../domain/services/PageGeneratorService';

export class GenerateStatusPageUseCase {
	constructor(
		private serviceRepository: ServiceRepository,
		private statusCheckRepository: StatusCheckRepository,
		private pageConfigRepository: PageConfigRepository,
		private categoryRepository: CategoryRepository,
		private systemStatusRepository: SystemStatusRepository,
		private incidentRepository: IncidentRepository,
		private incidentUpdateRepository: IncidentUpdateRepository,
		private pageGeneratorService: PageGeneratorService,
	) {}

	async execute(): Promise<string> {
		const [categories, pageConfig, systemStatus, incidents] = await Promise.all([
			this.categoryRepository.findEnabled(),
			this.pageConfigRepository.get(),
			this.systemStatusRepository.get(),
			this.incidentRepository.findRecent(30), // Get incidents from last 30 days
		]);

		// Calculate consistent time window for all data fetching
		const now = new Date();
		const dataWindowEnd = new Date(Math.floor(now.getTime() / 60000) * 60000); // Round to nearest minute
		const dataWindowStart = new Date(dataWindowEnd.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

		// Generate shared time grid for consistent sampling across all services and categories
		const sharedTimeGrid = this.generateSharedTimeGrid(dataWindowStart, dataWindowEnd, 90);

		// Group services by category
		const categoryStatusData = await Promise.all(
			categories.map(async (category) => {
				// Get services for this category
				const services = await this.serviceRepository.findAll();
				const categoryServices = services.filter((s) => s.categoryId === category.id);

				const serviceStatusData = await Promise.all(
					categoryServices.map(async (service) => {
						const [latestCheck, recentChecks] = await Promise.all([
							this.statusCheckRepository.findLatestByServiceId(service.id),
							this.statusCheckRepository.findByServiceId(service.id, 1440), // 24 hours of minute checks
						]);

						// Calculate uptime considering all non-down statuses as "up"
						const upChecks = recentChecks.filter((check) => check.status === 'up' || check.status === 'degraded').length;
						const uptime = recentChecks.length > 0 ? (upChecks / recentChecks.length) * 100 : 0;

						// Determine current status with better logic
						let currentStatus = latestCheck?.status || 'unknown';

						// If we have recent data but no latest check, use the most recent from history
						if (!latestCheck && recentChecks.length > 0) {
							const sortedChecks = recentChecks.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
							currentStatus = sortedChecks[0].status;
						}

						// Sample the history data using shared time grid for alignment
						const sampledHistory = this.sampleToTimeGrid(recentChecks, sharedTimeGrid);

						return {
							id: service.id,
							name: service.name,
							status: currentStatus,
							responseTime: latestCheck?.responseTimeMs,
							uptime,
							history: sampledHistory.map((check) => ({
								timestamp: check.checkedAt,
								status: check.status,
								responseTime: check.responseTimeMs,
							})),
						};
					}),
				);

				// Calculate category status and uptime
				const categoryUptime =
					serviceStatusData.length > 0 ? serviceStatusData.reduce((sum, s) => sum + s.uptime, 0) / serviceStatusData.length : 100;

				const categoryStatus = this.calculateCategoryStatus(serviceStatusData);

				// Generate category history by properly aggregating service histories
				const categoryHistory = this.calculateCategoryHistoryFromGrid(serviceStatusData, sharedTimeGrid);

				// Debug logging for data consistency
				console.log(
					`Category "${category.name}": status=${categoryStatus}, services=${serviceStatusData.length}, history_points=${categoryHistory.length}`,
				);
				serviceStatusData.forEach((service) => {
					console.log(
						`  Service "${service.name}": status=${service.status}, history=${service.history.length} points, uptime=${service.uptime.toFixed(1)}%`,
					);
				});

				return {
					id: category.id,
					name: category.name,
					description: category.description,
					status: categoryStatus,
					uptime: categoryUptime,
					services: serviceStatusData,
					history: categoryHistory,
				};
			}),
		);

		// Fetch incident updates for each incident
		const incidentData = await Promise.all(
			incidents.map(async (incident) => {
				const updates = await this.incidentUpdateRepository.findByIncidentId(incident.id);

				return {
					id: incident.id,
					title: incident.title,
					description: incident.description,
					status: incident.status,
					severity: incident.severity,
					startedAt: incident.startedAt,
					resolvedAt: incident.resolvedAt,
					updates: updates.map((update) => ({
						status: update.status,
						message: update.message,
						createdAt: update.createdAt,
					})),
				} as IncidentData;
			}),
		);

		// Handle automatic banner calculation
		let finalOverallStatus = systemStatus.overallStatus;
		let finalBannerMessage = systemStatus.bannerMessage;

		if (systemStatus.autoBanner) {
			// Calculate actual system status from all services
			const calculatedStatus = this.calculateOverallSystemStatus(categoryStatusData);
			const calculatedMessage = this.getAutoBannerMessage(calculatedStatus);

			// Update system status in database if it has changed
			if (calculatedStatus !== systemStatus.overallStatus || calculatedMessage !== systemStatus.bannerMessage) {
				const updatedSystemStatus = await this.systemStatusRepository.update({
					overallStatus: calculatedStatus,
					bannerMessage: calculatedMessage,
				});
				finalOverallStatus = updatedSystemStatus.overallStatus;
				finalBannerMessage = updatedSystemStatus.bannerMessage;
			} else {
				finalOverallStatus = calculatedStatus;
				finalBannerMessage = calculatedMessage;
			}
		} else {
			// Use manual banner settings when auto banner is disabled
			if (systemStatus.manualBannerMessage && systemStatus.manualBannerStatus) {
				finalOverallStatus = systemStatus.manualBannerStatus;
				finalBannerMessage = systemStatus.manualBannerMessage;
			}
		}

		const statusPageData: StatusPageData = {
			title: pageConfig.title,
			description: pageConfig.description,
			overallStatus: finalOverallStatus,
			bannerMessage: finalBannerMessage,
			categories: categoryStatusData,
			incidents: incidentData,
			lastUpdated: new Date(),
		};

		return this.pageGeneratorService.generateStatusPage(statusPageData);
	}

	private calculateCategoryStatus(services: ServiceStatusData[]): string {
		if (services.length === 0) {
			return 'operational';
		}

		const hasDown = services.some((s) => s.status === 'down');
		const hasDegraded = services.some((s) => s.status === 'degraded');

		if (hasDown) {
			return 'major_outage';
		}
		if (hasDegraded) {
			return 'degraded';
		}
		return 'operational';
	}

	private calculateCategoryHistory(services: ServiceStatusData[]): HistoryPoint[] {
		if (services.length === 0) {
			return [];
		}

		// Get all unique timestamps from all services
		const timestampMap = new Map<string, Date>();
		services.forEach((service) => {
			service.history.forEach((point) => {
				const key = point.timestamp.toISOString();
				if (!timestampMap.has(key)) {
					timestampMap.set(key, point.timestamp);
				}
			});
		});

		// Convert to sorted array of timestamps
		const timestamps = Array.from(timestampMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, timestamp]) => timestamp);

		// For each timestamp, calculate the category status by aggregating service statuses
		return timestamps.map((timestamp) => {
			const serviceStatusesAtTime: string[] = [];

			services.forEach((service) => {
				// Find the status check at this exact timestamp
				const exactMatch = service.history.find((point) => point.timestamp.getTime() === timestamp.getTime());

				if (exactMatch) {
					serviceStatusesAtTime.push(exactMatch.status);
				} else {
					// If no exact match, find the closest previous status check
					const previousChecks = service.history
						.filter((point) => point.timestamp.getTime() <= timestamp.getTime())
						.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

					if (previousChecks.length > 0) {
						serviceStatusesAtTime.push(previousChecks[0].status);
					} else {
						// Default to 'up' if no previous data
						serviceStatusesAtTime.push('up');
					}
				}
			});

			// Apply category status calculation logic to historical data
			const hasDown = serviceStatusesAtTime.some((status) => status === 'down');
			const hasDegraded = serviceStatusesAtTime.some((status) => status === 'degraded');

			let categoryStatus = 'operational';
			if (hasDown) {
				categoryStatus = 'major_outage';
			} else if (hasDegraded) {
				categoryStatus = 'degraded';
			}

			// Calculate average response time for this timestamp
			const responseTimes = services
				.map((service) => {
					const point = service.history.find((p) => p.timestamp.getTime() === timestamp.getTime());
					return point?.responseTime;
				})
				.filter((rt) => rt !== undefined) as number[];

			const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length : undefined;

			return {
				timestamp,
				status: categoryStatus,
				responseTime: avgResponseTime,
			};
		});
	}

	private sampleHistoryData(data: any[], targetSize: number): any[] {
		if (data.length <= targetSize) {
			return data;
		}

		// Enhanced sampling that preserves critical status changes
		const step = data.length / targetSize;
		const sampled = [];

		for (let i = 0; i < targetSize; i++) {
			const index = Math.floor(i * step);
			const nextIndex = Math.min(Math.floor((i + 1) * step), data.length - 1);

			// Check if there are any critical status changes (down/degraded) in this segment
			const segment = data.slice(index, nextIndex + 1);
			const hasCriticalStatus = segment.some((item) => item.status === 'down' || item.status === 'degraded');

			if (hasCriticalStatus) {
				// Find the first critical status in this segment
				const criticalItem = segment.find((item) => item.status === 'down' || item.status === 'degraded');
				sampled.push(criticalItem);
			} else {
				// Use the regular sampling point
				sampled.push(data[index]);
			}
		}

		return sampled;
	}

	/**
	 * Generate a shared time grid of evenly spaced time points for consistent sampling
	 */
	private generateSharedTimeGrid(startTime: Date, endTime: Date, numPoints: number): Date[] {
		const timeGrid: Date[] = [];
		const totalTimeMs = endTime.getTime() - startTime.getTime();
		const intervalMs = totalTimeMs / (numPoints - 1);

		for (let i = 0; i < numPoints; i++) {
			const timePoint = new Date(startTime.getTime() + i * intervalMs);
			timeGrid.push(timePoint);
		}

		return timeGrid;
	}

	/**
	 * Sample status check data to align with shared time grid
	 */
	private sampleToTimeGrid(checks: any[], timeGrid: Date[]): any[] {
		// Sort checks by time
		const sortedChecks = checks.sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());

		return timeGrid.map((gridTime) => {
			// Find the closest check at or before this grid time
			const eligibleChecks = sortedChecks.filter((check) => new Date(check.checkedAt).getTime() <= gridTime.getTime());

			if (eligibleChecks.length === 0) {
				// No data available at this time point
				return {
					checkedAt: gridTime,
					status: 'unknown',
					responseTimeMs: undefined,
				};
			}

			// Get the most recent check before or at this grid time
			const closestCheck = eligibleChecks[eligibleChecks.length - 1];

			// Check if there are any critical status changes (down/degraded)
			// in the time window since the previous grid point
			const prevGridTime = timeGrid[timeGrid.indexOf(gridTime) - 1];
			if (prevGridTime) {
				const windowChecks = sortedChecks.filter((check) => {
					const checkTime = new Date(check.checkedAt).getTime();
					return checkTime > prevGridTime.getTime() && checkTime <= gridTime.getTime();
				});

				const hasCriticalStatus = windowChecks.some((check) => check.status === 'down' || check.status === 'degraded');

				if (hasCriticalStatus) {
					// Use the first critical status in this window
					const criticalCheck = windowChecks.find((check) => check.status === 'down' || check.status === 'degraded');
					if (criticalCheck) {
						return {
							checkedAt: gridTime,
							status: criticalCheck.status,
							responseTimeMs: criticalCheck.responseTimeMs,
						};
					}
				}
			}

			// Use the closest check
			return {
				checkedAt: gridTime,
				status: closestCheck.status,
				responseTimeMs: closestCheck.responseTimeMs,
			};
		});
	}

	/**
	 * Calculate category history using shared time grid for perfect alignment
	 */
	private calculateCategoryHistoryFromGrid(services: ServiceStatusData[], timeGrid: Date[]): HistoryPoint[] {
		if (services.length === 0) {
			return [];
		}

		return timeGrid.map((gridTime) => {
			const serviceStatusesAtTime: string[] = [];
			const responseTimesAtTime: number[] = [];

			services.forEach((service) => {
				// Find the status at this grid time from the service's sampled history
				const historyPoint = service.history.find((point) => point.timestamp.getTime() === gridTime.getTime());

				if (historyPoint) {
					serviceStatusesAtTime.push(historyPoint.status);
					if (historyPoint.responseTime) {
						responseTimesAtTime.push(historyPoint.responseTime);
					}
				} else {
					// If no data point found, default to 'unknown' (grey)
					serviceStatusesAtTime.push('unknown');
				}
			});

			// Apply category status aggregation logic
			const hasDown = serviceStatusesAtTime.some((status) => status === 'down');
			const hasDegraded = serviceStatusesAtTime.some((status) => status === 'degraded');
			const hasUnknown = serviceStatusesAtTime.some((status) => status === 'unknown');
			const allUnknown = serviceStatusesAtTime.every((status) => status === 'unknown');
			const allDown = serviceStatusesAtTime.every((status) => status === 'down');
			const allUp = serviceStatusesAtTime.every((status) => status === 'up' || status === 'operational');

			let categoryStatus = 'operational';

			// Handle unknown data first
			if (allUnknown) {
				categoryStatus = 'unknown';
			}
			// Red: ALL services are down
			else if (allDown) {
				categoryStatus = 'major_outage';
			}
			// Green: ALL services are up
			else if (allUp) {
				categoryStatus = 'operational';
			}
			// Orange: Mixed state (some up, some down/degraded)
			else if (hasDown || hasDegraded) {
				categoryStatus = 'degraded';
			}
			// Mixed case with unknown data
			else if (hasUnknown) {
				const knownStatuses = serviceStatusesAtTime.filter((status) => status !== 'unknown');
				if (knownStatuses.length === 0) {
					categoryStatus = 'unknown';
				} else {
					const allKnownDown = knownStatuses.every((status) => status === 'down');
					const allKnownUp = knownStatuses.every((status) => status === 'up' || status === 'operational');
					const knownHasDown = knownStatuses.some((status) => status === 'down');
					const knownHasDegraded = knownStatuses.some((status) => status === 'degraded');

					if (allKnownDown) {
						categoryStatus = 'major_outage';
					} else if (allKnownUp) {
						categoryStatus = 'operational';
					} else if (knownHasDown || knownHasDegraded) {
						categoryStatus = 'degraded';
					}
				}
			}
			// Default fallback
			else {
				categoryStatus = 'operational';
			}

			// Calculate average response time
			const avgResponseTime =
				responseTimesAtTime.length > 0 ? responseTimesAtTime.reduce((sum, rt) => sum + rt, 0) / responseTimesAtTime.length : undefined;

			return {
				timestamp: gridTime,
				status: categoryStatus,
				responseTime: avgResponseTime,
			};
		});
	}

	private calculateOverallSystemStatus(categories: CategoryStatusData[]): 'operational' | 'degraded' | 'major_outage' {
		if (categories.length === 0) {
			return 'operational';
		}

		// Collect all service statuses from all categories
		const allServiceStatuses: string[] = [];
		categories.forEach((category) => {
			category.services.forEach((service) => {
				// Handle unknown status as degraded for safety
				const status = service.status === 'unknown' ? 'degraded' : service.status;
				allServiceStatuses.push(status);
			});
		});

		if (allServiceStatuses.length === 0) {
			return 'operational';
		}

		const hasDown = allServiceStatuses.some((status) => status === 'down');
		const hasDegraded = allServiceStatuses.some((status) => status === 'degraded');
		const allDown = allServiceStatuses.every((status) => status === 'down');

		// Red: ALL services are down (major system-wide outage)
		if (allDown) {
			return 'major_outage';
		}
		// Orange: Some services are down or degraded (partial issues)
		if (hasDown || hasDegraded) {
			return 'degraded';
		}
		// Green: All services are up
		return 'operational';
	}

	private getAutoBannerMessage(status: 'operational' | 'degraded' | 'major_outage'): string {
		switch (status) {
			case 'operational':
				return 'All Systems Operational';
			case 'degraded':
				return 'Degraded Operations';
			case 'major_outage':
				return 'Service Outage';
			default:
				return 'All Systems Operational';
		}
	}
}
