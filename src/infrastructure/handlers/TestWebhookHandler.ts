import { D1SLORepository } from '../repositories/D1SLORepository';
import { DefaultNotificationService } from '../../domain/services/NotificationService';
import { TestWebhookUseCase } from '../../application/usecases/TestWebhookUseCase';

export class TestWebhookHandler {
	constructor(private env: Env) {}

	async handleTestWebhookApi(request: Request): Promise<Response> {
		try {
			if (request.method !== 'POST') {
				return new Response(JSON.stringify({ error: 'Method not allowed' }), {
					status: 405,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const body = await request.json();
			if (typeof body !== 'object' || body === null || !('channelId' in body)) {
				return new Response(JSON.stringify({ error: 'Invalid request body' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const { channelId } = body as { channelId: string | number };
			if (!channelId && channelId !== 0) {
				return new Response(JSON.stringify({ error: 'Channel ID required' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Convert channelId to number (handle both string and number inputs)
			const channelIdNum = typeof channelId === 'number' ? channelId : parseInt(channelId, 10);
			if (isNaN(channelIdNum) || channelIdNum <= 0) {
				return new Response(JSON.stringify({ error: 'Invalid channel ID format' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Initialize dependencies
			const sloRepository = new D1SLORepository(this.env.DB);
			const notificationService = new DefaultNotificationService(this.env.BASE_URL);

			// Execute use case
			const testWebhookUseCase = new TestWebhookUseCase(
				sloRepository,
				notificationService,
				this.env.BASE_URL
			);

			const result = await testWebhookUseCase.execute({ channelId: channelIdNum });

			if (result.success) {
				return new Response(
					JSON.stringify({
						success: true,
						message: result.message,
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			} else {
				return new Response(
					JSON.stringify({
						success: false,
						error: result.error,
					}),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}
		} catch (error) {
			console.error('Test webhook error:', error);
			return new Response(
				JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	}
}
