import { ServiceRepository } from '../../domain/repositories/ServiceRepository';
import { StatusCheckRepository } from '../../domain/repositories/StatusCheckRepository';
import { HealthCheckService, HealthCheckResult } from '../../domain/services/HealthCheckService';
import { Service } from '../../domain/entities/Service';
import { StatusCheck } from '../../domain/entities/StatusCheck';

export class MonitorServicesUseCase {
	constructor(
		private serviceRepository: ServiceRepository,
		private statusCheckRepository: StatusCheckRepository,
		private healthCheckService: HealthCheckService,
	) {}

	async execute(): Promise<void> {
		const allServices = await this.serviceRepository.findEnabled();
		// Double-check that only enabled services are processed
		const services = allServices.filter(service => service.enabled);
		console.log(`Starting health checks for ${services.length} enabled services`);

		const checkPromises = services.map(async (service) => {
			try {
				console.log(`Starting health check for service "${service.name}" (${service.monitorType})`);
				const startTime = Date.now();

				const result = await this.healthCheckService.performCheck(service);

				const checkDuration = Date.now() - startTime;
				console.log(
					`Service "${service.name}": status=${result.status}, responseTime=${result.responseTimeMs}ms, checkDuration=${checkDuration}ms${result.errorMessage ? `, error=${result.errorMessage}` : ''}`,
				);

				try {
					await this.statusCheckRepository.create({
						serviceId: service.id,
						status: result.status,
						responseTimeMs: result.responseTimeMs,
						statusCode: result.statusCode,
						errorMessage: result.errorMessage,
						checkedAt: new Date(),
					});
				} catch (saveError) {
					console.error(`Failed to save status check for service "${service.name}":`, saveError);
					// Don't create another status check if save fails - just log the error
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				console.error(`Failed to check service "${service.name}" (${service.monitorType}):`, errorMessage);
				if (error instanceof Error && error.stack) {
					console.error(`Stack trace for service "${service.name}":`, error.stack);
				}

				try {
					await this.statusCheckRepository.create({
						serviceId: service.id,
						status: 'down',
						errorMessage: errorMessage,
						checkedAt: new Date(),
					});
				} catch (saveError) {
					console.error(`Failed to save error status check for service "${service.name}":`, saveError);
				}
			}
		});

		const results = await Promise.allSettled(checkPromises);

		// Log summary
		const successful = results.filter((r) => r.status === 'fulfilled').length;
		const failed = results.filter((r) => r.status === 'rejected').length;
		console.log(`Health check cycle completed: ${successful} successful, ${failed} failed out of ${services.length} total services`);

		// Log any rejected promises for debugging
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				console.error(`Promise rejected for service index ${index}:`, result.reason);
			}
		});
	}

	async checkSingleService(service: Service): Promise<StatusCheck> {
		try {
			console.log(`Starting health check for service "${service.name}" (${service.monitorType})`);
			const startTime = Date.now();

			const result = await this.healthCheckService.performCheck(service);

			const checkDuration = Date.now() - startTime;
			console.log(
				`Service "${service.name}": status=${result.status}, responseTime=${result.responseTimeMs}ms, checkDuration=${checkDuration}ms${result.errorMessage ? `, error=${result.errorMessage}` : ''}`,
			);

			try {
				const statusCheck = await this.statusCheckRepository.create({
					serviceId: service.id,
					status: result.status,
					responseTimeMs: result.responseTimeMs,
					statusCode: result.statusCode,
					errorMessage: result.errorMessage,
					checkedAt: new Date(),
				});

				return statusCheck;
			} catch (saveError) {
				console.error(`Failed to save status check for service "${service.name}":`, saveError);
				// Return a status check object even if save fails
				return {
					id: 0, // Temporary ID since save failed
					serviceId: service.id,
					status: result.status,
					responseTimeMs: result.responseTimeMs,
					statusCode: result.statusCode,
					errorMessage: result.errorMessage,
					checkedAt: new Date(),
				};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Failed to check service "${service.name}" (${service.monitorType}):`, errorMessage);
			
			try {
				const statusCheck = await this.statusCheckRepository.create({
					serviceId: service.id,
					status: 'down',
					errorMessage: errorMessage,
					checkedAt: new Date(),
				});

				return statusCheck;
			} catch (saveError) {
				console.error(`Failed to save error status check for service "${service.name}":`, saveError);
				// Return a status check object even if save fails
				return {
					id: 0, // Temporary ID since save failed
					serviceId: service.id,
					status: 'down',
					responseTimeMs: 0,
					statusCode: 0,
					errorMessage: errorMessage,
					checkedAt: new Date(),
				};
			}
		}
	}
}
