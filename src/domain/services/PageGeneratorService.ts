import { OverallStatus } from '../entities/SystemStatus';

export interface StatusPageData {
	title: string;
	description: string;
	overallStatus: OverallStatus;
	bannerMessage: string;
	categories: CategoryStatusData[];
	incidents: IncidentData[];
	lastUpdated: Date;
	rssTitleSuffix?: string;
}

export interface CategoryStatusData {
	id: number;
	name: string;
	description?: string;
	status: string;
	uptime: number;
	services: ServiceStatusData[];
	history: HistoryPoint[];
}

export interface ServiceStatusData {
	id: number;
	name: string;
	status: string;
	responseTime?: number;
	uptime: number;
	history: HistoryPoint[];
}

export interface IncidentData {
	id: number;
	title: string;
	description?: string;
	status: string;
	severity: string;
	startedAt: Date;
	resolvedAt?: Date;
	updates: IncidentUpdateData[];
}

export interface IncidentUpdateData {
	status: string;
	message: string;
	createdAt: Date;
}

export interface HistoryPoint {
	timestamp: Date;
	status: string;
	responseTime?: number;
}

export interface PageGeneratorService {
	generateStatusPage(data: StatusPageData): string;
}
