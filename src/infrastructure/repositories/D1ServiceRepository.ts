import { ServiceRepository } from '../../domain/repositories/ServiceRepository';
import { Service, CreateServiceRequest, UpdateServiceRequest } from '../../domain/entities/Service';

export class D1ServiceRepository implements ServiceRepository {
	constructor(private db: D1Database) {}

	async findAll(): Promise<Service[]> {
		const result = await this.db.prepare('SELECT * FROM services ORDER BY name').all<Service>();
		return result.results.map(this.mapToService);
	}

	async findById(id: number): Promise<Service | null> {
		const result = await this.db.prepare('SELECT * FROM services WHERE id = ?').bind(id).first<Service>();
		return result ? this.mapToService(result) : null;
	}

	async findByName(name: string): Promise<Service | null> {
		const result = await this.db.prepare('SELECT * FROM services WHERE name = ?').bind(name).first<Service>();
		return result ? this.mapToService(result) : null;
	}

	async findEnabled(): Promise<Service[]> {
		const result = await this.db.prepare('SELECT * FROM services WHERE enabled = true ORDER BY name').all<Service>();
		return result.results.map(this.mapToService);
	}

	async create(service: CreateServiceRequest): Promise<Service> {
		const result = await this.db
			.prepare(
				`
				INSERT INTO services (name, url, method, expected_status, expected_content, timeout_ms, enabled, category_id, monitor_type, keyword, request_body, request_headers, bearer_token, database_query, hyperdrive_id)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				RETURNING *
			`,
			)
			.bind(
				service.name,
				service.url,
				service.method || 'GET',
				service.expectedStatus || 200,
				service.expectedContent || null,
				service.timeoutMs || 5000,
				service.enabled ?? true,
				service.categoryId || null,
				service.monitorType || 'http',
				service.keyword || null,
				service.requestBody || null,
				service.requestHeaders || null,
				service.bearerToken || null,
				service.databaseQuery || null,
				service.hyperdriveId || null,
			)
			.first<Service>();

		if (!result) {
			throw new Error('Failed to create service');
		}

		return this.mapToService(result);
	}

	async update(id: number, service: UpdateServiceRequest): Promise<Service | null> {
		const updates: string[] = [];
		const values: any[] = [];

		if (service.name !== undefined) {
			updates.push('name = ?');
			values.push(service.name);
		}
		if (service.url !== undefined) {
			updates.push('url = ?');
			values.push(service.url);
		}
		if (service.method !== undefined) {
			updates.push('method = ?');
			values.push(service.method);
		}
		if (service.expectedStatus !== undefined) {
			updates.push('expected_status = ?');
			values.push(service.expectedStatus);
		}
		if (service.expectedContent !== undefined) {
			updates.push('expected_content = ?');
			values.push(service.expectedContent);
		}
		if (service.timeoutMs !== undefined) {
			updates.push('timeout_ms = ?');
			values.push(service.timeoutMs);
		}
		if (service.enabled !== undefined) {
			updates.push('enabled = ?');
			values.push(service.enabled);
		}
		if (service.categoryId !== undefined) {
			updates.push('category_id = ?');
			values.push(service.categoryId);
		}
		if (service.monitorType !== undefined) {
			updates.push('monitor_type = ?');
			values.push(service.monitorType);
		}
		if (service.keyword !== undefined) {
			updates.push('keyword = ?');
			values.push(service.keyword);
		}
		if (service.requestBody !== undefined) {
			updates.push('request_body = ?');
			values.push(service.requestBody);
		}
		if (service.requestHeaders !== undefined) {
			updates.push('request_headers = ?');
			values.push(service.requestHeaders);
		}
		if (service.bearerToken !== undefined) {
			updates.push('bearer_token = ?');
			values.push(service.bearerToken);
		}
		if (service.databaseQuery !== undefined) {
			updates.push('database_query = ?');
			values.push(service.databaseQuery);
		}
		if (service.hyperdriveId !== undefined) {
			updates.push('hyperdrive_id = ?');
			values.push(service.hyperdriveId);
		}

		if (updates.length === 0) {
			return this.findById(id);
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		const result = await this.db
			.prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
			.bind(...values)
			.first<Service>();

		return result ? this.mapToService(result) : null;
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db.prepare('DELETE FROM services WHERE id = ?').bind(id).run();
		return (result.meta?.changes || 0) > 0;
	}

	private mapToService(row: any): Service {
		return {
			id: row.id,
			name: row.name,
			url: row.url,
			method: row.method,
			expectedStatus: row.expected_status,
			expectedContent: row.expected_content,
			timeoutMs: row.timeout_ms,
			enabled: Boolean(row.enabled),
			categoryId: row.category_id,
			monitorType: row.monitor_type || 'http',
			keyword: row.keyword,
			requestBody: row.request_body,
			requestHeaders: row.request_headers,
			bearerToken: row.bearer_token,
			databaseQuery: row.database_query,
			hyperdriveId: row.hyperdrive_id,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}
}
