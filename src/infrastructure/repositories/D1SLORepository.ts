import { SLORepository } from '../../domain/repositories/SLORepository';
import { SLO, SLOBurnEvent, NotificationChannel, SLONotification } from '../../domain/entities/SLO';

export class D1SLORepository implements SLORepository {
	constructor(private db: D1Database) {}

	// SLO Management
	async createSLO(slo: Omit<SLO, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
		const result = await this.db
			.prepare(
				`
        INSERT INTO slos (service_id, name, sli_type, target_percentage, latency_threshold_ms, time_window_days, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
			)
			.bind(
				slo.serviceId,
				slo.name,
				slo.sliType,
				slo.targetPercentage,
				slo.latencyThresholdMs || null,
				slo.timeWindowDays,
				slo.enabled ? 1 : 0
			)
			.run();

		if (!result.success || !result.meta?.last_row_id) {
			throw new Error('Failed to create SLO');
		}

		return result.meta.last_row_id as number;
	}

	async updateSLO(id: number, slo: Partial<SLO>): Promise<void> {
		const fields: string[] = [];
		const values: any[] = [];

		if (slo.name !== undefined) {
			fields.push('name = ?');
			values.push(slo.name);
		}
		if (slo.sliType !== undefined) {
			fields.push('sli_type = ?');
			values.push(slo.sliType);
		}
		if (slo.targetPercentage !== undefined) {
			fields.push('target_percentage = ?');
			values.push(slo.targetPercentage);
		}
		if (slo.latencyThresholdMs !== undefined) {
			fields.push('latency_threshold_ms = ?');
			values.push(slo.latencyThresholdMs);
		}
		if (slo.timeWindowDays !== undefined) {
			fields.push('time_window_days = ?');
			values.push(slo.timeWindowDays);
		}
		if (slo.enabled !== undefined) {
			fields.push('enabled = ?');
			values.push(slo.enabled ? 1 : 0);
		}

		if (fields.length === 0) {
			return;
		}

		fields.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		const result = await this.db
			.prepare(`UPDATE slos SET ${fields.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new Error('Failed to update SLO');
		}
	}

	async deleteSLO(id: number): Promise<void> {
		const result = await this.db.prepare('DELETE FROM slos WHERE id = ?').bind(id).run();
		if (!result.success) {
			throw new Error('Failed to delete SLO');
		}
	}

	async getSLOById(id: number): Promise<SLO | null> {
		const result = await this.db.prepare('SELECT * FROM slos WHERE id = ?').bind(id).first();
		return result ? this.mapRowToSLO(result) : null;
	}

	async getSLOsByServiceId(serviceId: number): Promise<SLO[]> {
		const results = await this.db
			.prepare('SELECT * FROM slos WHERE service_id = ? ORDER BY created_at DESC')
			.bind(serviceId)
			.all();
		return results.results.map(row => this.mapRowToSLO(row));
	}

	async getAllSLOs(): Promise<SLO[]> {
		const results = await this.db.prepare('SELECT * FROM slos ORDER BY created_at DESC').all();
		return results.results.map(row => this.mapRowToSLO(row));
	}

	async getEnabledSLOs(): Promise<SLO[]> {
		const results = await this.db.prepare('SELECT * FROM slos WHERE enabled = 1').all();
		return results.results.map(row => this.mapRowToSLO(row));
	}

	// SLO Burn Event Management
	async createBurnEvent(burnEvent: Omit<SLOBurnEvent, 'id' | 'triggeredAt'>): Promise<number> {
		const result = await this.db
			.prepare(
				`
        INSERT INTO slo_burn_events (slo_id, burn_rate, error_budget_consumed_percentage, time_to_exhaustion_hours)
        VALUES (?, ?, ?, ?)
      `
			)
			.bind(
				burnEvent.sloId,
				burnEvent.burnRate,
				burnEvent.errorBudgetConsumedPercentage,
				burnEvent.timeToExhaustionHours || null
			)
			.run();

		if (!result.success || !result.meta?.last_row_id) {
			throw new Error('Failed to create burn event');
		}

		return result.meta.last_row_id as number;
	}

	async updateBurnEvent(id: number, burnEvent: Partial<SLOBurnEvent>): Promise<void> {
		const fields: string[] = [];
		const values: any[] = [];

		if (burnEvent.burnRate !== undefined) {
			fields.push('burn_rate = ?');
			values.push(burnEvent.burnRate);
		}
		if (burnEvent.errorBudgetConsumedPercentage !== undefined) {
			fields.push('error_budget_consumed_percentage = ?');
			values.push(burnEvent.errorBudgetConsumedPercentage);
		}
		if (burnEvent.timeToExhaustionHours !== undefined) {
			fields.push('time_to_exhaustion_hours = ?');
			values.push(burnEvent.timeToExhaustionHours);
		}
		if (burnEvent.resolvedAt !== undefined) {
			fields.push('resolved_at = ?');
			values.push(burnEvent.resolvedAt);
		}

		if (fields.length === 0) {
			return;
		}

		values.push(id);

		const result = await this.db
			.prepare(`UPDATE slo_burn_events SET ${fields.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new Error('Failed to update burn event');
		}
	}

	async getBurnEventById(id: number): Promise<SLOBurnEvent | null> {
		const result = await this.db
			.prepare('SELECT * FROM slo_burn_events WHERE id = ?')
			.bind(id)
			.first();
		return result ? this.mapRowToBurnEvent(result) : null;
	}

	async getBurnEventsBySLOId(sloId: number, limit?: number): Promise<SLOBurnEvent[]> {
		const query = `SELECT * FROM slo_burn_events WHERE slo_id = ? ORDER BY triggered_at DESC${limit ? ` LIMIT ${limit}` : ''}`;
		const results = await this.db.prepare(query).bind(sloId).all();
		return results.results.map(row => this.mapRowToBurnEvent(row));
	}

	async getUnresolvedBurnEvents(): Promise<SLOBurnEvent[]> {
		const results = await this.db
			.prepare('SELECT * FROM slo_burn_events WHERE resolved_at IS NULL ORDER BY triggered_at DESC')
			.all();
		return results.results.map(row => this.mapRowToBurnEvent(row));
	}

	async getUnresolvedBurnEventBySLOId(sloId: number): Promise<SLOBurnEvent | null> {
		const result = await this.db
			.prepare(
				'SELECT * FROM slo_burn_events WHERE slo_id = ? AND resolved_at IS NULL ORDER BY triggered_at DESC LIMIT 1'
			)
			.bind(sloId)
			.first();
		return result ? this.mapRowToBurnEvent(result) : null;
	}

	// Notification Channel Management
	async createNotificationChannel(
		channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<number> {
		const result = await this.db
			.prepare(
				`
        INSERT INTO notification_channels (name, type, config, enabled)
        VALUES (?, ?, ?, ?)
      `
			)
			.bind(channel.name, channel.type, channel.config, channel.enabled ? 1 : 0)
			.run();

		if (!result.success || !result.meta?.last_row_id) {
			throw new Error('Failed to create notification channel');
		}

		return result.meta.last_row_id as number;
	}

	async updateNotificationChannel(
		id: number,
		channel: Partial<NotificationChannel>
	): Promise<void> {
		const fields: string[] = [];
		const values: any[] = [];

		if (channel.name !== undefined) {
			fields.push('name = ?');
			values.push(channel.name);
		}
		if (channel.type !== undefined) {
			fields.push('type = ?');
			values.push(channel.type);
		}
		if (channel.config !== undefined) {
			fields.push('config = ?');
			values.push(channel.config);
		}
		if (channel.enabled !== undefined) {
			fields.push('enabled = ?');
			values.push(channel.enabled ? 1 : 0);
		}

		if (fields.length === 0) {
			return;
		}

		fields.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		const result = await this.db
			.prepare(`UPDATE notification_channels SET ${fields.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new Error('Failed to update notification channel');
		}
	}

	async deleteNotificationChannel(id: number): Promise<void> {
		const result = await this.db
			.prepare('DELETE FROM notification_channels WHERE id = ?')
			.bind(id)
			.run();
		if (!result.success) {
			throw new Error('Failed to delete notification channel');
		}
	}

	async getNotificationChannelById(id: number): Promise<NotificationChannel | null> {
		const result = await this.db
			.prepare('SELECT * FROM notification_channels WHERE id = ?')
			.bind(id)
			.first();
		return result ? this.mapRowToNotificationChannel(result) : null;
	}

	async getAllNotificationChannels(): Promise<NotificationChannel[]> {
		const results = await this.db
			.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC')
			.all();
		return results.results.map(row => this.mapRowToNotificationChannel(row));
	}

	async getEnabledNotificationChannels(): Promise<NotificationChannel[]> {
		const results = await this.db
			.prepare('SELECT * FROM notification_channels WHERE enabled = 1')
			.all();
		return results.results.map(row => this.mapRowToNotificationChannel(row));
	}

	// SLO Notification Rules Management
	async createSLONotification(
		sloNotification: Omit<SLONotification, 'id' | 'createdAt'>
	): Promise<number> {
		const result = await this.db
			.prepare(
				`
        INSERT INTO slo_notifications (slo_id, notification_channel_id, burn_rate_threshold, enabled)
        VALUES (?, ?, ?, ?)
      `
			)
			.bind(
				sloNotification.sloId,
				sloNotification.notificationChannelId,
				sloNotification.burnRateThreshold,
				sloNotification.enabled ? 1 : 0
			)
			.run();

		if (!result.success || !result.meta?.last_row_id) {
			throw new Error('Failed to create SLO notification');
		}

		return result.meta.last_row_id as number;
	}

	async updateSLONotification(
		id: number,
		sloNotification: Partial<SLONotification>
	): Promise<void> {
		const fields: string[] = [];
		const values: any[] = [];

		if (sloNotification.burnRateThreshold !== undefined) {
			fields.push('burn_rate_threshold = ?');
			values.push(sloNotification.burnRateThreshold);
		}
		if (sloNotification.enabled !== undefined) {
			fields.push('enabled = ?');
			values.push(sloNotification.enabled ? 1 : 0);
		}

		if (fields.length === 0) {
			return;
		}

		values.push(id);

		const result = await this.db
			.prepare(`UPDATE slo_notifications SET ${fields.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new Error('Failed to update SLO notification');
		}
	}

	async deleteSLONotification(id: number): Promise<void> {
		const result = await this.db
			.prepare('DELETE FROM slo_notifications WHERE id = ?')
			.bind(id)
			.run();
		if (!result.success) {
			throw new Error('Failed to delete SLO notification');
		}
	}

	async getSLONotificationById(id: number): Promise<SLONotification | null> {
		const result = await this.db
			.prepare('SELECT * FROM slo_notifications WHERE id = ?')
			.bind(id)
			.first();
		return result ? this.mapRowToSLONotification(result) : null;
	}

	async getSLONotificationsBySLOId(sloId: number): Promise<SLONotification[]> {
		const results = await this.db
			.prepare('SELECT * FROM slo_notifications WHERE slo_id = ?')
			.bind(sloId)
			.all();
		return results.results.map(row => this.mapRowToSLONotification(row));
	}

	async getAllSLONotifications(): Promise<SLONotification[]> {
		const results = await this.db.prepare('SELECT * FROM slo_notifications').all();
		return results.results.map(row => this.mapRowToSLONotification(row));
	}

	async getEnabledSLONotificationsBySLOId(sloId: number): Promise<SLONotification[]> {
		const results = await this.db
			.prepare('SELECT * FROM slo_notifications WHERE slo_id = ? AND enabled = 1')
			.bind(sloId)
			.all();
		return results.results.map(row => this.mapRowToSLONotification(row));
	}

	// Helper mapping methods
	private mapRowToSLO(row: any): SLO {
		return {
			id: row.id,
			serviceId: row.service_id,
			name: row.name,
			sliType: row.sli_type,
			targetPercentage: row.target_percentage,
			latencyThresholdMs: row.latency_threshold_ms,
			timeWindowDays: row.time_window_days,
			enabled: row.enabled === 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	private mapRowToBurnEvent(row: any): SLOBurnEvent {
		return {
			id: row.id,
			sloId: row.slo_id,
			burnRate: row.burn_rate,
			errorBudgetConsumedPercentage: row.error_budget_consumed_percentage,
			timeToExhaustionHours: row.time_to_exhaustion_hours,
			triggeredAt: row.triggered_at,
			resolvedAt: row.resolved_at,
		};
	}

	private mapRowToNotificationChannel(row: any): NotificationChannel {
		return {
			id: row.id,
			name: row.name,
			type: row.type,
			config: row.config,
			enabled: row.enabled === 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	private mapRowToSLONotification(row: any): SLONotification {
		return {
			id: row.id,
			sloId: row.slo_id,
			notificationChannelId: row.notification_channel_id,
			burnRateThreshold: row.burn_rate_threshold,
			enabled: row.enabled === 1,
			createdAt: row.created_at,
		};
	}
}
