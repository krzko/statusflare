import { IncidentUpdateRepository } from '../../domain/repositories/IncidentUpdateRepository';
import {
	IncidentUpdate,
	CreateIncidentUpdateRequest,
	UpdateIncidentUpdateRequest,
	IncidentStatus,
} from '../../domain/entities/IncidentUpdate';

export class D1IncidentUpdateRepository implements IncidentUpdateRepository {
	constructor(private db: D1Database) {}

	async findAll(): Promise<IncidentUpdate[]> {
		const result = await this.db
			.prepare('SELECT * FROM incident_updates ORDER BY created_at DESC')
			.all<IncidentUpdate>();
		return result.results.map(this.mapToIncidentUpdate);
	}

	async findById(id: number): Promise<IncidentUpdate | null> {
		const result = await this.db
			.prepare('SELECT * FROM incident_updates WHERE id = ?')
			.bind(id)
			.first<IncidentUpdate>();
		return result ? this.mapToIncidentUpdate(result) : null;
	}

	async findByIncidentId(incidentId: number): Promise<IncidentUpdate[]> {
		const result = await this.db
			.prepare(
				`
			SELECT * FROM incident_updates 
			WHERE incident_id = ? 
			ORDER BY created_at ASC
		`
			)
			.bind(incidentId)
			.all<IncidentUpdate>();
		return result.results.map(this.mapToIncidentUpdate);
	}

	async create(update: CreateIncidentUpdateRequest): Promise<IncidentUpdate> {
		const result = await this.db
			.prepare(
				`
				INSERT INTO incident_updates (incident_id, status, message)
				VALUES (?, ?, ?)
				RETURNING *
			`
			)
			.bind(update.incidentId, update.status, update.message)
			.first<IncidentUpdate>();

		if (!result) {
			throw new Error('Failed to create incident update');
		}

		return this.mapToIncidentUpdate(result);
	}

	async update(id: number, update: UpdateIncidentUpdateRequest): Promise<IncidentUpdate | null> {
		const updates: string[] = [];
		const values: any[] = [];

		if (update.status !== undefined) {
			updates.push('status = ?');
			values.push(update.status);
		}
		if (update.message !== undefined) {
			updates.push('message = ?');
			values.push(update.message);
		}

		if (updates.length === 0) {
			return this.findById(id);
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		const result = await this.db
			.prepare(`UPDATE incident_updates SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
			.bind(...values)
			.first<IncidentUpdate>();

		return result ? this.mapToIncidentUpdate(result) : null;
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare('DELETE FROM incident_updates WHERE id = ?')
			.bind(id)
			.run();
		// Using meta.changes to check affected rows, consistent with D1IncidentRepository
		return result.meta?.changes > 0 || false;
	}

	private mapToIncidentUpdate(row: any): IncidentUpdate {
		return {
			id: row.id,
			incidentId: row.incident_id,
			status: row.status as IncidentStatus,
			message: row.message,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}
}
