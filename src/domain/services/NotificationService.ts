import { SLOAlertPayload, NotificationChannel, WebhookConfig } from '../entities/SLO';

export interface NotificationService {
	sendAlert(webhookUrl: string, payload: SLOAlertPayload): Promise<boolean>;
	sendAlert(payload: SLOAlertPayload, channel: NotificationChannel): Promise<boolean>;
	formatPayloadForChannel(payload: SLOAlertPayload, channel: NotificationChannel): any;
	formatSlackMessage(payload: SLOAlertPayload): any;
	createTestPayload(): SLOAlertPayload;
	sendTestNotification(webhookUrl: string): Promise<boolean>;
}

export class DefaultNotificationService implements NotificationService {
	constructor(private baseUrl: string) {}

	async sendAlert(
		webhookUrlOrPayload: string | SLOAlertPayload,
		payloadOrChannel?: SLOAlertPayload | NotificationChannel
	): Promise<boolean> {
		// Handle overloaded method signatures
		let payload: SLOAlertPayload;
		let channel: NotificationChannel;

		if (typeof webhookUrlOrPayload === 'string') {
			// sendAlert(webhookUrl, payload) signature
			const webhookUrl = webhookUrlOrPayload;
			payload = payloadOrChannel as SLOAlertPayload;
			channel = {
				id: 1,
				name: 'Webhook',
				type: 'webhook',
				config: JSON.stringify({
					url: webhookUrl,
					format: 'slack',
					headers: {
						'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
					},
				}),
				enabled: true,
			};
		} else {
			// sendAlert(payload, channel) signature
			payload = webhookUrlOrPayload;
			channel = payloadOrChannel as NotificationChannel;
		}
		try {
			const formattedPayload = this.formatPayloadForChannel(payload, channel);

			switch (channel.type) {
				case 'webhook':
					return await this.sendWebhook(formattedPayload, channel);
				case 'email':
					return await this.sendEmail(formattedPayload, channel);
				case 'sms':
					return await this.sendSMS(formattedPayload, channel);
				default:
					console.error(`Unsupported notification channel type: ${channel.type}`);
					return false;
			}
		} catch (error) {
			console.error(`Failed to send notification via ${channel.name}:`, error);
			return false;
		}
	}

	formatPayloadForChannel(payload: SLOAlertPayload, channel: NotificationChannel): any {
		if (channel.type !== 'webhook') {
			return payload; // Return standard payload for non-webhook channels
		}

		try {
			const config = JSON.parse(channel.config) as WebhookConfig;

			switch (config.format) {
				case 'slack':
					return this.formatForSlack(payload);
				case 'discord':
					return this.formatForDiscord(payload);
				case 'custom':
				default:
					return payload; // Return standard payload for custom webhooks
			}
		} catch (error) {
			console.error('Failed to parse webhook config:', error);
			return payload;
		}
	}

	private async sendWebhook(payload: any, channel: NotificationChannel): Promise<boolean> {
		try {
			const config = JSON.parse(channel.config) as WebhookConfig;

			const response = await fetch(config.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...config.headers,
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				console.error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
				return false;
			}

			return true;
		} catch (error) {
			console.error('Webhook delivery error:', error);
			return false;
		}
	}

	private async sendEmail(
		payload: SLOAlertPayload,
		_channel: NotificationChannel
	): Promise<boolean> {
		// TODO: Implement email sending via Cloudflare Email Workers or external service
		console.log('Email notification not yet implemented:', payload);
		return false;
	}

	private async sendSMS(payload: SLOAlertPayload, _channel: NotificationChannel): Promise<boolean> {
		// TODO: Implement SMS sending via Twilio or AWS SNS
		console.log('SMS notification not yet implemented:', payload);
		return false;
	}

	formatSlackMessage(payload: SLOAlertPayload): any {
		return this.formatForSlack(payload);
	}

	createTestPayload(): SLOAlertPayload {
		return {
			event: 'test_webhook',
			timestamp: new Date().toISOString(),
			severity: 'info',
			service: {
				id: 999,
				name: 'Test Service',
				url: 'https://test.example.com',
			},
			slo: {
				id: 999,
				name: 'Test SLO',
				type: 'availability',
				target: 99.9,
				timeWindowDays: 30,
			},
			alert: {
				burnRate: 0,
				errorBudgetConsumed: 0,
				timeToExhaustionHours: undefined,
				currentSli: 100,
			},
			dashboardUrl: `${this.baseUrl}/dashboard`,
		};
	}

	async sendTestNotification(webhookUrl: string): Promise<boolean> {
		const testPayload = this.createTestPayload();
		const channel: NotificationChannel = {
			id: 999,
			name: 'Test Webhook',
			type: 'webhook',
			config: JSON.stringify({
				url: webhookUrl,
				format: 'slack',
				headers: {},
			}),
			enabled: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		return await this.sendAlert(testPayload, channel);
	}

	private formatForSlack(payload: SLOAlertPayload): any {
		const isAlert = payload.event === 'slo_burn_rate_alert';
		const isTest = payload.event === 'test_webhook';
		const color = isTest
			? '#36a64f' // Green for test
			: isAlert
				? payload.severity === 'critical'
					? 'danger'
					: 'warning'
				: 'good';

		const title = isTest
			? `🧪 Test Webhook: ${payload.service.name}`
			: isAlert
				? `🚨 SLO Alert: ${payload.service.name} ${payload.slo.name}`
				: `✅ SLO Resolved: ${payload.service.name} ${payload.slo.name}`;

		let fields = [];

		if (isTest) {
			fields = [
				{
					title: 'Message',
					value: (payload as any).message || 'Test webhook sent successfully! 🎉',
					short: false,
				},
				{
					title: 'Timestamp',
					value: new Date(payload.timestamp).toLocaleString(),
					short: true,
				},
				{
					title: 'Event Type',
					value: 'Test Notification',
					short: true,
				},
			];
		} else {
			fields = [
				{
					title: 'Service',
					value: payload.service.name,
					short: true,
				},
				{
					title: 'SLO',
					value: `${payload.slo.name} (${payload.slo.target}%)`,
					short: true,
				},
				{
					title: 'Current SLI',
					value: `${payload.alert.currentSli}%`,
					short: true,
				},
				{
					title: 'Burn Rate',
					value: `${payload.alert.burnRate}x`,
					short: true,
				},
			];

			if (isAlert) {
				fields.push({
					title: 'Error Budget Consumed',
					value: `${payload.alert.errorBudgetConsumed}%`,
					short: true,
				});

				if (payload.alert.timeToExhaustionHours) {
					fields.push({
						title: 'Time to Exhaustion',
						value: `${payload.alert.timeToExhaustionHours.toFixed(1)} hours`,
						short: true,
					});
				}
			}
		}

		return {
			username: 'statusflare',
			icon_emoji: ':fire:',
			text: title,
			attachments: [
				{
					color,
					fields,
					actions: [
						{
							type: 'button',
							text: 'View Dashboard',
							url: payload.dashboardUrl,
						},
					],
					footer: 'Status Monitor',
					ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
				},
			],
		};
	}

	private formatForDiscord(payload: SLOAlertPayload): any {
		const isAlert = payload.event === 'slo_burn_rate_alert';
		const isTest = payload.event === 'test_webhook';
		const color = isTest
			? 0x00ff00 // Green for test
			: isAlert
				? payload.severity === 'critical'
					? 0xff0000
					: 0xffa500 // Red or Orange
				: 0x00ff00; // Green

		const title = isTest
			? `🧪 Test Webhook: ${payload.service.name}`
			: isAlert
				? `🚨 SLO Alert: ${payload.service.name}`
				: `✅ SLO Resolved: ${payload.service.name}`;

		const description = isTest
			? (payload as any).message || 'Test webhook sent successfully! 🎉'
			: isAlert
				? `**${payload.slo.name}** is burning error budget fast!\nBurn rate: **${payload.alert.burnRate}x** (threshold: 14.4x)`
				: `**${payload.slo.name}** burn rate has returned to normal.`;

		let fields = [];

		if (isTest) {
			fields = [
				{
					name: 'Event Type',
					value: 'Test Notification',
					inline: true,
				},
				{
					name: 'Timestamp',
					value: new Date(payload.timestamp).toLocaleString(),
					inline: true,
				},
			];
		} else {
			fields = [
				{
					name: 'Service',
					value: payload.service.name,
					inline: true,
				},
				{
					name: 'SLO Target',
					value: `${payload.slo.target}%`,
					inline: true,
				},
				{
					name: 'Current SLI',
					value: `${payload.alert.currentSli}%`,
					inline: true,
				},
				{
					name: 'Burn Rate',
					value: `${payload.alert.burnRate}x`,
					inline: true,
				},
			];

			if (isAlert) {
				fields.push({
					name: 'Error Budget Consumed',
					value: `${payload.alert.errorBudgetConsumed}%`,
					inline: true,
				});

				if (payload.alert.timeToExhaustionHours) {
					fields.push({
						name: 'Time to Exhaustion',
						value: `${payload.alert.timeToExhaustionHours.toFixed(1)} hours`,
						inline: true,
					});
				}
			}
		}

		return {
			username: 'statusflare',
			avatar_url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png', // Fire emoji as avatar
			embeds: [
				{
					title,
					description,
					color,
					fields,
					url: payload.dashboardUrl,
					timestamp: payload.timestamp,
					footer: {
						text: 'Statusflare',
						icon_url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png',
					},
				},
			],
		};
	}
}
