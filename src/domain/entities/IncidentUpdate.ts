export interface IncidentUpdate {
	id: number;
	incidentId: number;
	status: IncidentStatus;
	message: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateIncidentUpdateRequest {
	incidentId: number;
	status: IncidentStatus;
	message: string;
}

export interface UpdateIncidentUpdateRequest {
	status?: IncidentStatus;
	message?: string;
}

export type IncidentStatus = 'identified' | 'investigating' | 'update' | 'resolved';
