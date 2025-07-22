import { StatusCheckRepository } from '../../domain/repositories/StatusCheckRepository';
import { StatusCheck, CreateStatusCheckRequest, ServiceStatus } from '../../domain/entities/StatusCheck';

export class D1StatusCheckRepository implements StatusCheckRepository {
	constructor(private db: D1Database) {}

	async findByServiceId(serviceId: number, limit: number = 100): Promise<StatusCheck[]> {
		const result = await this.db
			.prepare('SELECT * FROM status_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT ?')
			.bind(serviceId, limit)
			.all<StatusCheck>();
		return result.results.map(this.mapToStatusCheck);
	}

	async findLatestByServiceId(serviceId: number): Promise<StatusCheck | null> {
		const result = await this.db
			.prepare('SELECT * FROM status_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 1')
			.bind(serviceId)
			.first<StatusCheck>();
		return result ? this.mapToStatusCheck(result) : null;
	}

	async findRecent(hours: number): Promise<StatusCheck[]> {
		const result = await this.db
			.prepare('SELECT * FROM status_checks WHERE checked_at >= datetime("now", "-" || ? || " hours") ORDER BY checked_at DESC')
			.bind(hours)
			.all<StatusCheck>();
		return result.results.map(this.mapToStatusCheck);
	}

	async create(statusCheck: CreateStatusCheckRequest): Promise<StatusCheck> {
		const result = await this.db
			.prepare(
				`
				INSERT INTO status_checks (service_id, status, response_time_ms, status_code, error_message)
				VALUES (?, ?, ?, ?, ?)
				RETURNING *
			`,
			)
			.bind(
				statusCheck.serviceId,
				statusCheck.status,
				statusCheck.responseTimeMs || null,
				statusCheck.statusCode || null,
				statusCheck.errorMessage || null,
			)
			.first<StatusCheck>();

		if (!result) {
			throw new Error('Failed to create status check');
		}

		return this.mapToStatusCheck(result);
	}

	async findByServiceIdInTimeRange(serviceId: number, startTime: Date, endTime: Date): Promise<StatusCheck[]> {
		const results = await this.db
			.prepare(
				`
				SELECT * FROM status_checks 
				WHERE service_id = ? 
				AND checked_at >= ? 
				AND checked_at <= ?
				ORDER BY checked_at DESC
			`,
			)
			.bind(serviceId, startTime.toISOString(), endTime.toISOString())
			.all<any>();

		return results.results.map((row) => this.mapToStatusCheck(row));
	}

	async deleteOld(olderThanDays: number): Promise<number> {
		const result = await this.db
			.prepare('DELETE FROM status_checks WHERE checked_at < datetime("now", "-" || ? || " days")')
			.bind(olderThanDays)
			.run();
		return result.meta?.changes || 0;
	}

	private mapToStatusCheck(row: any): StatusCheck {
		return {
			id: row.id,
			serviceId: row.service_id,
			status: row.status as ServiceStatus,
			responseTimeMs: row.response_time_ms,
			statusCode: row.status_code,
			errorMessage: row.error_message,
			checkedAt: new Date(row.checked_at),
		};
	}
}
