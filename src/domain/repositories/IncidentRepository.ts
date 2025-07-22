import { Incident, IncidentUpdate, CreateIncidentRequest, UpdateIncidentRequest, CreateIncidentUpdateRequest } from '../entities/Incident';

export interface IncidentRepository {
	findAll(limit?: number): Promise<Incident[]>;
	findById(id: number): Promise<Incident | null>;
	findActive(): Promise<Incident[]>;
	findRecent(days: number): Promise<Incident[]>;
	create(incident: CreateIncidentRequest): Promise<Incident>;
	update(id: number, incident: UpdateIncidentRequest): Promise<Incident | null>;
	delete(id: number): Promise<boolean>;

	// Incident updates
	findUpdatesByIncidentId(incidentId: number): Promise<IncidentUpdate[]>;
	createUpdate(update: CreateIncidentUpdateRequest): Promise<IncidentUpdate>;

	// Affected services
	addAffectedService(incidentId: number, serviceId: number): Promise<void>;
	removeAffectedService(incidentId: number, serviceId: number): Promise<void>;
	findAffectedServices(incidentId: number): Promise<number[]>;
}
