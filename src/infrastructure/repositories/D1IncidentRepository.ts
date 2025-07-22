import { IncidentRepository } from '../../domain/repositories/IncidentRepository';
import {
	Incident,
	IncidentUpdate,
	CreateIncidentRequest,
	UpdateIncidentRequest,
	CreateIncidentUpdateRequest,
	IncidentStatus,
	IncidentSeverity,
} from '../../domain/entities/Incident';

export class D1IncidentRepository implements IncidentRepository {
	constructor(private db: D1Database) {}

	async findAll(): Promise<Incident[]> {
		const result = await this.db.prepare('SELECT * FROM incidents ORDER BY started_at DESC').all<Incident>();
		return result.results.map(this.mapToIncident);
	}

	async findById(id: number): Promise<Incident | null> {
		const result = await this.db.prepare('SELECT * FROM incidents WHERE id = ?').bind(id).first<Incident>();
		return result ? this.mapToIncident(result) : null;
	}

	async findActive(): Promise<Incident[]> {
		const result = await this.db
			.prepare(
				`
			SELECT * FROM incidents 
			WHERE status != 'resolved' 
			ORDER BY started_at DESC
		`,
			)
			.all<Incident>();
		return result.results.map(this.mapToIncident);
	}

	async findRecent(days: number = 30): Promise<Incident[]> {
		const result = await this.db
			.prepare(
				`
			SELECT * FROM incidents 
			WHERE started_at >= datetime('now', '-' || ? || ' days')
			ORDER BY started_at DESC
		`,
			)
			.bind(days)
			.all<Incident>();
		return result.results.map(this.mapToIncident);
	}

	async create(incident: CreateIncidentRequest): Promise<Incident> {
		const result = await this.db
			.prepare(
				`
				INSERT INTO incidents (title, description, status, severity, started_at)
				VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
				RETURNING *
			`,
			)
			.bind(incident.title, incident.description || null, incident.status || 'identified', incident.severity || 'minor')
			.first<Incident>();

		if (!result) {
			throw new Error('Failed to create incident');
		}

		return this.mapToIncident(result);
	}

	async update(id: number, incident: UpdateIncidentRequest): Promise<Incident | null> {
		const updates: string[] = [];
		const values: any[] = [];

		if (incident.title !== undefined) {
			updates.push('title = ?');
			values.push(incident.title);
		}
		if (incident.description !== undefined) {
			updates.push('description = ?');
			values.push(incident.description);
		}
		if (incident.status !== undefined) {
			updates.push('status = ?');
			values.push(incident.status);
		}
		if (incident.severity !== undefined) {
			updates.push('severity = ?');
			values.push(incident.severity);
		}

		// Set resolved_at when status changes to resolved
		if (incident.status === 'resolved') {
			updates.push('resolved_at = CURRENT_TIMESTAMP');
		}

		if (updates.length === 0) {
			return this.findById(id);
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		const result = await this.db
			.prepare(`UPDATE incidents SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
			.bind(...values)
			.first<Incident>();

		return result ? this.mapToIncident(result) : null;
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run();
		// Using meta.changes instead of changes directly
		return result.meta?.changes > 0 || false;
	}

	// Incident updates
	async findUpdatesByIncidentId(incidentId: number): Promise<IncidentUpdate[]> {
		const result = await this.db
			.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC')
			.bind(incidentId)
			.all<any>();

		return result.results.map(this.mapToIncidentUpdate);
	}

	async createUpdate(update: CreateIncidentUpdateRequest): Promise<IncidentUpdate> {
		const result = await this.db
			.prepare(
				`
				INSERT INTO incident_updates (incident_id, message, status, created_at)
				VALUES (?, ?, ?, CURRENT_TIMESTAMP)
				RETURNING *
			`,
			)
			.bind(update.incidentId, update.message, update.status || null)
			.first<any>();

		if (!result) {
			throw new Error('Failed to create incident update');
		}

		return this.mapToIncidentUpdate(result);
	}

	// Affected services
	async addAffectedService(incidentId: number, serviceId: number): Promise<void> {
		await this.db
			.prepare(
				`
				INSERT INTO incident_affected_services (incident_id, service_id)
				VALUES (?, ?)
				ON CONFLICT (incident_id, service_id) DO NOTHING
			`,
			)
			.bind(incidentId, serviceId)
			.run();
	}

	async removeAffectedService(incidentId: number, serviceId: number): Promise<void> {
		await this.db
			.prepare('DELETE FROM incident_affected_services WHERE incident_id = ? AND service_id = ?')
			.bind(incidentId, serviceId)
			.run();
	}

	async findAffectedServices(incidentId: number): Promise<number[]> {
		const result = await this.db
			.prepare('SELECT service_id FROM incident_affected_services WHERE incident_id = ?')
			.bind(incidentId)
			.all<{ service_id: number }>();

		return result.results.map((row: { service_id: number }) => row.service_id);
	}

	private mapToIncident(row: Record<string, any>): Incident {
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			status: row.status as IncidentStatus,
			severity: row.severity as IncidentSeverity,
			startedAt: new Date(row.started_at),
			resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}

	private mapToIncidentUpdate(row: Record<string, any>): IncidentUpdate {
		// The IncidentUpdate interface requires a non-null status
		// If status is null/undefined in the database, default to 'identified'
		const status = row.status ? (row.status as IncidentStatus) : 'identified';

		return {
			id: row.id,
			incidentId: row.incident_id,
			message: row.message,
			status: status,
			createdAt: new Date(row.created_at),
		};
	}
}
