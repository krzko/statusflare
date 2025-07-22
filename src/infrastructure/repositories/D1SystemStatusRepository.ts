import { SystemStatusRepository } from '../../domain/repositories/SystemStatusRepository';
import {
	SystemStatus,
	UpdateSystemStatusRequest,
	OverallStatus,
} from '../../domain/entities/SystemStatus';

export class D1SystemStatusRepository implements SystemStatusRepository {
	constructor(private db: D1Database) {}

	async get(): Promise<SystemStatus> {
		const result = await this.db
			.prepare('SELECT * FROM system_status WHERE id = 1')
			.first<SystemStatus>();

		if (!result) {
			// Create default system status if it doesn't exist
			await this.db
				.prepare(
					`
				INSERT INTO system_status (id, overall_status, banner_message, auto_banner, manual_banner_status)
				VALUES (1, 'operational', 'All Systems Operational', true, 'operational')
			`
				)
				.run();

			return {
				id: 1,
				overallStatus: 'operational',
				bannerMessage: 'All Systems Operational',
				autoBanner: true,
				manualBannerMessage: undefined,
				manualBannerStatus: 'operational',
				updatedAt: new Date(),
			};
		}

		return this.mapToSystemStatus(result);
	}

	async update(status: UpdateSystemStatusRequest): Promise<SystemStatus> {
		const updates: string[] = [];
		const values: any[] = [];

		if (status.overallStatus !== undefined) {
			updates.push('overall_status = ?');
			values.push(status.overallStatus);
		}
		if (status.bannerMessage !== undefined) {
			updates.push('banner_message = ?');
			values.push(status.bannerMessage);
		}
		if (status.autoBanner !== undefined) {
			updates.push('auto_banner = ?');
			values.push(status.autoBanner);
		}
		if (status.manualBannerMessage !== undefined) {
			updates.push('manual_banner_message = ?');
			values.push(status.manualBannerMessage);
		}
		if (status.manualBannerStatus !== undefined) {
			updates.push('manual_banner_status = ?');
			values.push(status.manualBannerStatus);
		}

		if (updates.length === 0) {
			return this.get();
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(1);

		const result = await this.db
			.prepare(`UPDATE system_status SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
			.bind(...values)
			.first<SystemStatus>();

		if (!result) {
			throw new Error('Failed to update system status');
		}

		return this.mapToSystemStatus(result);
	}

	private mapToSystemStatus(row: any): SystemStatus {
		return {
			id: row.id,
			overallStatus: row.overall_status as OverallStatus,
			bannerMessage: row.banner_message,
			autoBanner: Boolean(row.auto_banner ?? true),
			manualBannerMessage: row.manual_banner_message,
			manualBannerStatus: (row.manual_banner_status as OverallStatus) || 'operational',
			updatedAt: new Date(row.updated_at),
		};
	}
}
