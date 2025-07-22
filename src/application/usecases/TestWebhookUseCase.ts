import { SLORepository } from '../../domain/repositories/SLORepository';
import { NotificationService } from '../../domain/services/NotificationService';
import { SLOAlertPayload } from '../../domain/entities/SLO';

export interface TestWebhookRequest {
	channelId: number;
}

export interface TestWebhookResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export class TestWebhookUseCase {
	constructor(
		private sloRepository: SLORepository,
		private notificationService: NotificationService,
		private baseUrl: string
	) {}

	async execute(request: TestWebhookRequest): Promise<TestWebhookResponse> {
		try {
			// Get the notification channel
			const channel = await this.sloRepository.getNotificationChannelById(request.channelId);

			if (!channel || !channel.enabled) {
				return {
					success: false,
					error: 'Channel not found or disabled',
				};
			}

			// Create a test notification payload
			const testPayload: SLOAlertPayload = {
				event: 'test_webhook' as const,
				timestamp: new Date().toISOString(),
				severity: 'info' as const,
				service: {
					id: 999,
					name: 'Test Service',
					url: 'https://example.com/test',
				},
				slo: {
					id: 999,
					name: 'Test SLO',
					type: 'availability' as const,
					target: 99.0,
					timeWindowDays: 28,
				},
				alert: {
					burnRate: 15.5,
					errorBudgetConsumed: 87.3,
					timeToExhaustionHours: 1.2,
					currentSli: 98.1,
				},
				dashboardUrl: `${this.baseUrl}/test`,
				message:
					'This is a test webhook from your status monitoring service. If you receive this message, your webhook configuration is working correctly! 🎉',
			};

			// Send the test notification
			const success = await this.notificationService.sendAlert(testPayload, channel);

			if (success) {
				return {
					success: true,
					message: 'Test webhook sent successfully',
				};
			} else {
				return {
					success: false,
					error: 'Failed to send test webhook',
				};
			}
		} catch (error) {
			console.error('Test webhook error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}
}
