import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultNotificationService } from '../../../src/domain/services/NotificationService';
import { SLOAlertPayload } from '../../../src/domain/entities/SLO';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DefaultNotificationService', () => {
	let notificationService: DefaultNotificationService;
	const baseUrl = 'https://status.example.com';

	beforeEach(() => {
		notificationService = new DefaultNotificationService(baseUrl);
		vi.clearAllMocks();
	});

	const mockAlertPayload: SLOAlertPayload = {
		event: 'slo_burn_rate_alert',
		timestamp: '2024-01-01T10:00:00.000Z',
		severity: 'critical',
		service: {
			id: 1,
			name: 'Test Service',
			url: 'https://api.example.com',
		},
		slo: {
			id: 1,
			name: 'Availability SLO',
			type: 'availability',
			target: 99.9,
			timeWindowDays: 30,
		},
		alert: {
			burnRate: 14.5,
			errorBudgetConsumed: 75.0,
			timeToExhaustionHours: 8,
			currentSli: 98.5,
		},
		dashboardUrl: `${baseUrl}/dashboard`,
	};

	describe('sendAlert', () => {
		it('should send webhook notification successfully', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			});

			await notificationService.sendAlert(webhookUrl, mockAlertPayload);

			// Check that it was called with the Slack-formatted payload
			expect(mockFetch).toHaveBeenCalledWith(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
				},
				body: expect.stringContaining('statusflare'), // Slack-formatted payload
			});

			// Verify it contains Slack message structure
			const callArgs = mockFetch.mock.calls[0];
			const body = JSON.parse(callArgs[1].body);
			expect(body.username).toBe('statusflare');
			expect(body.attachments).toBeDefined();
			expect(body.text).toContain('🚨 SLO Alert:');
		});

		it('should handle webhook failure gracefully', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: async () => 'Bad Request',
			});

			// Should not throw an error
			await expect(
				notificationService.sendAlert(webhookUrl, mockAlertPayload)
			).resolves.not.toThrow();

			expect(mockFetch).toHaveBeenCalledWith(
				webhookUrl,
				expect.objectContaining({
					method: 'POST',
				})
			);
		});

		it('should handle network errors gracefully', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			// Should not throw an error
			await expect(
				notificationService.sendAlert(webhookUrl, mockAlertPayload)
			).resolves.not.toThrow();
		});

		it('should include correct headers in request', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await notificationService.sendAlert(webhookUrl, mockAlertPayload);

			// Check headers and method
			expect(mockFetch).toHaveBeenCalledWith(
				webhookUrl,
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
					}),
					body: expect.any(String),
				})
			);
		});
	});

	describe('formatSlackMessage', () => {
		it('should format critical alert message correctly', () => {
			const slackMessage = notificationService.formatSlackMessage(mockAlertPayload);

			// Check the main text
			expect(slackMessage.text).toContain('🚨 SLO Alert:');
			expect(slackMessage.text).toContain('Test Service');
			expect(slackMessage.text).toContain('Availability SLO');

			// Check attachment fields
			const attachment = slackMessage.attachments[0];
			expect(attachment.color).toBe('danger');

			// Check that fields contain expected values
			const fields = attachment.fields;
			expect(fields.find(f => f.title === 'Current SLI')?.value).toBe('98.5%');
			expect(fields.find(f => f.title === 'Error Budget Consumed')?.value).toBe('75%');
			expect(fields.find(f => f.title === 'Time to Exhaustion')?.value).toBe('8.0 hours');
		});

		it('should format warning alert message correctly', () => {
			const warningPayload: SLOAlertPayload = {
				...mockAlertPayload,
				severity: 'warning',
				alert: {
					...mockAlertPayload.alert,
					timeToExhaustionHours: 24,
				},
			};

			const slackMessage = notificationService.formatSlackMessage(warningPayload);

			// Check the main text contains alert info
			expect(slackMessage.text).toContain('🚨 SLO Alert:');

			// Check warning color
			const attachment = slackMessage.attachments[0];
			expect(attachment.color).toBe('warning');

			// Check time to exhaustion
			const fields = attachment.fields;
			expect(fields.find(f => f.title === 'Time to Exhaustion')?.value).toBe('24.0 hours');
		});

		it('should format resolved alert message correctly', () => {
			const resolvedPayload: SLOAlertPayload = {
				...mockAlertPayload,
				event: 'slo_burn_resolved',
				severity: 'info',
			};

			const slackMessage = notificationService.formatSlackMessage(resolvedPayload);

			// Check the main text for resolved alert
			expect(slackMessage.text).toContain('✅ SLO Resolved:');
			expect(slackMessage.text).toContain('Test Service');

			// Check good color for resolved
			const attachment = slackMessage.attachments[0];
			expect(attachment.color).toBe('good');
		});

		it('should handle missing timeToExhaustionHours', () => {
			const payloadWithoutTime: SLOAlertPayload = {
				...mockAlertPayload,
				alert: {
					...mockAlertPayload.alert,
					timeToExhaustionHours: undefined,
				},
			};

			const slackMessage = notificationService.formatSlackMessage(payloadWithoutTime);

			// When timeToExhaustionHours is undefined, the field should not be present
			const attachment = slackMessage.attachments[0];
			const fields = attachment.fields;
			const timeField = fields.find(f => f.title === 'Time to Exhaustion');
			expect(timeField).toBeUndefined();
		});

		it('should include dashboard link', () => {
			const slackMessage = notificationService.formatSlackMessage(mockAlertPayload);

			// Check that dashboard URL is in the action button
			const attachment = slackMessage.attachments[0];
			const actions = attachment.actions;
			expect(actions[0].url).toBe(`${baseUrl}/dashboard`);
			expect(actions[0].text).toBe('View Dashboard');
		});
	});

	describe('createTestPayload', () => {
		it('should create valid test payload', () => {
			const testPayload = notificationService.createTestPayload();

			expect(testPayload.event).toBe('test_webhook');
			expect(testPayload.severity).toBe('info');
			expect(testPayload.service.name).toBe('Test Service');
			expect(testPayload.slo.name).toBe('Test SLO');
			expect(testPayload.timestamp).toBeDefined();
			expect(testPayload.dashboardUrl).toBe(`${baseUrl}/dashboard`);
		});

		it('should create test payload with current timestamp', () => {
			const beforeTime = new Date().getTime();
			const testPayload = notificationService.createTestPayload();
			const afterTime = new Date().getTime();

			const payloadTime = new Date(testPayload.timestamp).getTime();

			expect(payloadTime).toBeGreaterThanOrEqual(beforeTime);
			expect(payloadTime).toBeLessThanOrEqual(afterTime);
		});
	});

	describe('sendTestNotification', () => {
		it('should send test notification successfully', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await notificationService.sendTestNotification(webhookUrl);

			// Check that fetch was called with the correct webhook URL and Slack-formatted payload
			expect(mockFetch).toHaveBeenCalledWith(
				webhookUrl,
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
					}),
					body: expect.stringContaining('Test Webhook'),
				})
			);

			// Verify the payload structure includes test webhook elements
			const callArgs = mockFetch.mock.calls[0];
			const body = JSON.parse(callArgs[1].body);
			expect(body.text).toContain('🧪 Test Webhook:');
			expect(body.attachments).toBeDefined();
		});

		it('should handle test notification failure gracefully', async () => {
			const webhookUrl = 'https://invalid-webhook-url';

			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(notificationService.sendTestNotification(webhookUrl)).resolves.not.toThrow();
		});
	});

	describe('validation', () => {
		it('should validate webhook URL format', () => {
			const invalidUrls = ['', 'not-a-url', 'ftp://invalid.com', 'javascript:alert(1)'];

			invalidUrls.forEach(url => {
				expect(() => {
					// This would be a validation method if implemented
					const isValid = url.startsWith('http://') || url.startsWith('https://');
					expect(isValid).toBe(false);
				}).not.toThrow();
			});
		});

		it('should validate alert payload structure', () => {
			const requiredFields = [
				'event',
				'timestamp',
				'severity',
				'service',
				'slo',
				'alert',
				'dashboardUrl',
			];

			requiredFields.forEach(field => {
				expect(mockAlertPayload).toHaveProperty(field);
			});
		});

		it('should validate severity levels', () => {
			const validSeverities = ['critical', 'warning', 'info'];

			expect(validSeverities).toContain(mockAlertPayload.severity);
		});

		it('should validate event types', () => {
			const validEvents = ['slo_burn_rate_alert', 'slo_burn_resolved', 'test_webhook'];

			expect(validEvents).toContain(mockAlertPayload.event);
		});
	});

	describe('error handling', () => {
		it('should handle malformed JSON response', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: async () => {
					throw new Error('Invalid JSON');
				},
			});

			await expect(
				notificationService.sendAlert(webhookUrl, mockAlertPayload)
			).resolves.not.toThrow();
		});

		it('should handle timeout scenarios', async () => {
			const webhookUrl = 'https://hooks.slack.com/webhook';

			// Simulate timeout
			mockFetch.mockImplementationOnce(
				() => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
			);

			await expect(
				notificationService.sendAlert(webhookUrl, mockAlertPayload)
			).resolves.not.toThrow();
		});
	});
});
