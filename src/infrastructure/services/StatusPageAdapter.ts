import { PageGeneratorService, StatusPageData, CategoryStatusData } from '../../domain/services/PageGeneratorService';
import { StatusPageHtmlGenerator } from './StatusPageHtmlGenerator';

interface LegacyServiceStatusData {
	id: number;
	name: string;
	status: string;
	responseTime?: number;
	uptime: number;
	history: Array<{
		timestamp: Date;
		status: string;
		responseTime?: number;
	}>;
}

export class StatusPageAdapter implements PageGeneratorService {
	private generator = new StatusPageHtmlGenerator();

	generateStatusPage(data: StatusPageData): string {
		// Use data directly as it already matches the expected format
		return this.generator.generateStatusPage(data);
	}

	private calculateOverallStatus(services: LegacyServiceStatusData[]): 'operational' | 'degraded' | 'major_outage' {
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

	private generateBannerMessage(services: LegacyServiceStatusData[]): string {
		const overallStatus = this.calculateOverallStatus(services);
		switch (overallStatus) {
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

	private groupServicesIntoCategories(services: LegacyServiceStatusData[]): CategoryStatusData[] {
		// For now, put all services in a "Services" category
		const servicesCategory: CategoryStatusData = {
			id: 1,
			name: 'Services',
			description: 'Core application services',
			status: this.calculateOverallStatus(services),
			uptime: this.calculateAverageUptime(services),
			services: services.map((service) => ({
				id: service.id,
				name: service.name,
				status: service.status,
				responseTime: service.responseTime,
				uptime: service.uptime,
				history: service.history,
			})),
			history: this.generateCategoryHistory(services),
		};

		return [servicesCategory];
	}

	private calculateAverageUptime(services: LegacyServiceStatusData[]): number {
		if (services.length === 0) {
			return 100;
		}
		const totalUptime = services.reduce((sum, service) => sum + service.uptime, 0);
		return totalUptime / services.length;
	}

	private generateCategoryHistory(services: LegacyServiceStatusData[]): Array<{ timestamp: Date; status: string; responseTime?: number }> {
		if (services.length === 0) {
			return [];
		}

		// Use the first service's history as a template and aggregate
		const firstService = services[0];
		if (!firstService.history) {
			return [];
		}

		return firstService.history.map((point) => ({
			timestamp: point.timestamp,
			status: this.calculateOverallStatus(services), // Simplified - in reality would calculate per time point
			responseTime:
				services.reduce((sum, s) => {
					const historyPoint = s.history.find((h) => h.timestamp.getTime() === point.timestamp.getTime());
					return sum + (historyPoint?.responseTime || 0);
				}, 0) / services.length,
		}));
	}
}
