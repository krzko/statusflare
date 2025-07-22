export type IncidentStatus = 'identified' | 'investigating' | 'update' | 'resolved';
export type IncidentSeverity = 'minor' | 'major' | 'critical';

export interface Incident {
	id: number;
	title: string;
	description?: string;
	status: IncidentStatus;
	severity: IncidentSeverity;
	startedAt: Date;
	resolvedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface IncidentUpdate {
	id: number;
	incidentId: number;
	status: IncidentStatus;
	message: string;
	createdAt: Date;
}

export interface CreateIncidentRequest {
	title: string;
	description?: string;
	status?: IncidentStatus;
	severity?: IncidentSeverity;
	serviceIds?: number[];
}

export interface UpdateIncidentRequest {
	title?: string;
	description?: string;
	status?: IncidentStatus;
	severity?: IncidentSeverity;
	resolvedAt?: Date;
}

export interface CreateIncidentUpdateRequest {
	incidentId: number;
	status: IncidentStatus;
	message: string;
}
