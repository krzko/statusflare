import { IncidentUpdate, CreateIncidentUpdateRequest, UpdateIncidentUpdateRequest } from '../entities/IncidentUpdate';

export interface IncidentUpdateRepository {
	findAll(): Promise<IncidentUpdate[]>;
	findById(id: number): Promise<IncidentUpdate | null>;
	findByIncidentId(incidentId: number): Promise<IncidentUpdate[]>;
	create(update: CreateIncidentUpdateRequest): Promise<IncidentUpdate>;
	update(id: number, update: UpdateIncidentUpdateRequest): Promise<IncidentUpdate | null>;
	delete(id: number): Promise<boolean>;
}
