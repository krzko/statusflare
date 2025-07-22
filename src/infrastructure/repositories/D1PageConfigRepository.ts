import { PageConfigRepository } from '../../domain/repositories/PageConfigRepository';
import { PageConfig, UpdatePageConfigRequest } from '../../domain/entities/PageConfig';

export class D1PageConfigRepository implements PageConfigRepository {
	constructor(private db: D1Database) {}

	async get(): Promise<PageConfig> {
		const result = await this.db.prepare('SELECT * FROM page_config WHERE id = 1').first<PageConfig>();

		if (!result) {
			throw new Error('Page configuration not found');
		}

		return this.mapToPageConfig(result);
	}

	async update(config: UpdatePageConfigRequest): Promise<PageConfig> {
		const updates: string[] = [];
		const values: any[] = [];

		if (config.title !== undefined) {
			updates.push('title = ?');
			values.push(config.title);
		}
		if (config.description !== undefined) {
			updates.push('description = ?');
			values.push(config.description);
		}

		if (updates.length === 0) {
			return this.get();
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(1);

		const result = await this.db
			.prepare(`UPDATE page_config SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
			.bind(...values)
			.first<PageConfig>();

		if (!result) {
			throw new Error('Failed to update page configuration');
		}

		return this.mapToPageConfig(result);
	}

	private mapToPageConfig(row: any): PageConfig {
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			updatedAt: new Date(row.updated_at),
		};
	}
}
