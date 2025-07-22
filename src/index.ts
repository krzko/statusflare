import { D1ServiceRepository } from './infrastructure/repositories/D1ServiceRepository';
import { D1StatusCheckRepository } from './infrastructure/repositories/D1StatusCheckRepository';
import { D1PageConfigRepository } from './infrastructure/repositories/D1PageConfigRepository';
import { D1CategoryRepository } from './infrastructure/repositories/D1CategoryRepository';
import { D1SystemStatusRepository } from './infrastructure/repositories/D1SystemStatusRepository';
import { D1IncidentRepository } from './infrastructure/repositories/D1IncidentRepository';
import { D1IncidentUpdateRepository } from './infrastructure/repositories/D1IncidentUpdateRepository';
import { D1SLORepository } from './infrastructure/repositories/D1SLORepository';
import { HttpHealthCheckService } from './infrastructure/services/HttpHealthCheckService';
import { StatusPageHtmlGenerator } from './infrastructure/services/StatusPageHtmlGenerator';
import { RssFeedGenerator } from './infrastructure/services/RssFeedGenerator';
import { DefaultSLOCalculationService } from './domain/services/SLOCalculationService';
import { DefaultNotificationService } from './domain/services/NotificationService';
import { MonitorServicesUseCase } from './application/usecases/MonitorServicesUseCase';
import { GenerateStatusPageUseCase } from './application/usecases/GenerateStatusPageUseCase';
import { ManageServicesUseCase } from './application/usecases/ManageServicesUseCase';
import { SLOMonitoringUseCase } from './application/usecases/SLOMonitoringUseCase';
import { CreateServiceRequest, UpdateServiceRequest } from './domain/entities/Service';
import { SLO, NotificationChannel, SLONotification } from './domain/entities/SLO';
import { AdminPageHandler } from './infrastructure/handlers/AdminPageHandler';
import { TestWebhookHandler } from './infrastructure/handlers/TestWebhookHandler';

const handler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Initialize repositories and services
		const serviceRepository = new D1ServiceRepository(env.DB);
		const statusCheckRepository = new D1StatusCheckRepository(env.DB);
		const pageConfigRepository = new D1PageConfigRepository(env.DB);
		const categoryRepository = new D1CategoryRepository(env.DB);
		const systemStatusRepository = new D1SystemStatusRepository(env.DB);
		const incidentRepository = new D1IncidentRepository(env.DB);
		const incidentUpdateRepository = new D1IncidentUpdateRepository(env.DB);
		const sloRepository = new D1SLORepository(env.DB);
		const pageGeneratorService = new StatusPageHtmlGenerator();
		const sloCalculationService = new DefaultSLOCalculationService();
		const notificationService = new DefaultNotificationService(env.BASE_URL);

		// Initialize use cases
		const manageServicesUseCase = new ManageServicesUseCase(serviceRepository);
		const sloMonitoringUseCase = new SLOMonitoringUseCase(
			sloRepository,
			serviceRepository,
			statusCheckRepository,
			sloCalculationService,
			notificationService,
			env.BASE_URL,
		);
		const generateStatusPageUseCase = new GenerateStatusPageUseCase(
			serviceRepository,
			statusCheckRepository,
			pageConfigRepository,
			categoryRepository,
			systemStatusRepository,
			incidentRepository,
			incidentUpdateRepository,
			pageGeneratorService,
		);

		// Initialize AdminPageHandler
		const adminPageHandler = new AdminPageHandler();

		try {
			switch (url.pathname) {
				case '/':
					return await handler.handleStatusPage(generateStatusPageUseCase, env.R2);

				case '/admin':
					return await adminPageHandler.handleAdminPage(request, env);

				case '/admin/login':
					return await handler.handleAdminLogin(request, env);

				case '/rss':
				case '/feed':
				case '/rss.xml':
					return await handler.handleRssFeed(env);

				case '/api/services':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleServicesApi(request, manageServicesUseCase);

				case '/api/categories':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleCategoriesApi(request, categoryRepository);

				case '/api/system-status':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleSystemStatusApi(request, systemStatusRepository);

				case '/api/incidents':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleIncidentsApi(request, incidentRepository);

				case '/api/incident-updates':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleIncidentUpdatesApi(request, incidentUpdateRepository);

				case '/api/page-config':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handlePageConfigApi(request, pageConfigRepository);

				case '/api/slos':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleSLOsApi(request, new D1SLORepository(env.DB));

				case '/api/notification-channels':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleNotificationChannelsApi(request, new D1SLORepository(env.DB));

				case '/api/slo-notifications':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleSLONotificationsApi(request, new D1SLORepository(env.DB));

				case '/api/slo-metrics':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return await handler.handleSLOMetricsApi(request, env);

				case '/api/test-webhook':
					if (!handler.authenticateApiRequest(request, env)) {
						return new Response('Unauthorized', { status: 401 });
					}
					const testWebhookHandler = new TestWebhookHandler(env);
					return await testWebhookHandler.handleTestWebhookApi(request);

				case '/api/trigger-checks':
					if (request.method === 'POST') {
						if (!handler.authenticateApiRequest(request, env)) {
							return new Response('Unauthorized', { status: 401 });
						}
						return await handler.handleTriggerChecks(env, ctx);
					}
					return new Response('Method not allowed', { status: 405 });

				case url.pathname.startsWith('/api/status-checks/') ? url.pathname : '':
					// Authenticated access to status check history for specific services
					if (request.method === 'GET') {
						if (!handler.authenticateApiRequest(request, env)) {
							return new Response('Unauthorized', { status: 401 });
						}
						const serviceId = parseInt(url.pathname.split('/').pop() || '0');
						if (serviceId) {
							const statusCheckRepository = new D1StatusCheckRepository(env.DB);
							const checks = await statusCheckRepository.findByServiceId(serviceId, 100);
							return new Response(JSON.stringify(checks), {
								headers: { 'Content-Type': 'application/json' },
							});
						}
					}
					return new Response('Not Found', { status: 404 });

				default:
					return new Response('Not Found', { status: 404 });
			}
		} catch (error) {
			console.error('Request error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Running scheduled status checks and SLO monitoring at ${new Date(controller.scheduledTime).toISOString()}`);

		// Use ctx.waitUntil to ensure all async operations complete
		ctx.waitUntil(
			(async () => {
				try {
					// Initialize repositories and services
					const serviceRepository = new D1ServiceRepository(env.DB);
					const statusCheckRepository = new D1StatusCheckRepository(env.DB);
					const sloRepository = new D1SLORepository(env.DB);
					const healthCheckService = new HttpHealthCheckService(env);

					// Run monitoring checks
					const monitorServicesUseCase = new MonitorServicesUseCase(serviceRepository, statusCheckRepository, healthCheckService);

					await monitorServicesUseCase.execute();

					// Run SLO monitoring and burn rate detection
					const sloCalculationService = new DefaultSLOCalculationService();
					const notificationService = new DefaultNotificationService(env.BASE_URL);

					const sloMonitoringUseCase = new SLOMonitoringUseCase(
						sloRepository,
						serviceRepository,
						statusCheckRepository,
						sloCalculationService,
						notificationService,
						env.BASE_URL,
					);

					await sloMonitoringUseCase.evaluateAllSLOs();

					// Clean up old status check data (keep last 7 days)
					await statusCheckRepository.deleteOld(7);

					// Generate and store status page
					const pageConfigRepository = new D1PageConfigRepository(env.DB);
					const categoryRepository = new D1CategoryRepository(env.DB);
					const systemStatusRepository = new D1SystemStatusRepository(env.DB);
					const incidentRepository = new D1IncidentRepository(env.DB);
					const incidentUpdateRepository = new D1IncidentUpdateRepository(env.DB);
					const pageGeneratorService = new StatusPageHtmlGenerator();

					const generateStatusPageUseCase = new GenerateStatusPageUseCase(
						serviceRepository,
						statusCheckRepository,
						pageConfigRepository,
						categoryRepository,
						systemStatusRepository,
						incidentRepository,
						incidentUpdateRepository,
						pageGeneratorService,
					);

					const statusPageHtml = await generateStatusPageUseCase.execute();

					// Store the generated page in R2
					await env.R2.put('status.html', statusPageHtml, {
						httpMetadata: {
							contentType: 'text/html',
						},
					});

					// Generate and cache RSS feed
					const rssGenerator = new RssFeedGenerator();
					const incidents = await incidentRepository.findRecent(50);
					const incidentsWithUpdates = await Promise.all(
						incidents.map(async (incident) => {
							const updates = await incidentUpdateRepository.findByIncidentId(incident.id);
							return {
								...incident,
								updates,
							};
						}),
					);

					const pageConfig = await pageConfigRepository.get();
					const title = pageConfig?.title || env.SITE_TITLE || 'Status Page';
					const baseUrl = env.BASE_URL;

					const rssFeed = rssGenerator.generateRssFeed({
						title,
						description: 'Status updates and incident reports for ' + title,
						link: baseUrl,
						incidents: incidentsWithUpdates,
						lastUpdated: new Date(),
						titleSuffix: env.RSS_TITLE_SUFFIX,
					});

					await env.R2.put('rss.xml', rssFeed, {
						httpMetadata: {
							contentType: 'application/rss+xml; charset=utf-8',
						},
					});

					console.log('Status checks, SLO monitoring, page and RSS feed completed');
				} catch (error) {
					console.error('Scheduled task error:', error);
				}
			})(),
		);
	},

	// API Authentication helper
	authenticateApiRequest(request: Request, env: Env): boolean {
		// Require API key for all requests
		const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
		return apiKey === env.STATUSFLARE_ADMIN_PASSWORD;
	},

	async handleRssFeed(env: Env): Promise<Response> {
		try {
			// Try to get cached RSS feed from R2 first
			const cachedRssFeed = await env.R2.get('rss.xml');
			if (cachedRssFeed) {
				return new Response(await cachedRssFeed.text(), {
					headers: {
						'Content-Type': 'application/rss+xml; charset=utf-8',
						'Cache-Control': 'public, max-age=900', // Cache for 15 minutes
					},
				});
			}

			// Fallback: Generate RSS feed if not cached (first run scenario)
			const incidentRepository = new D1IncidentRepository(env.DB);
			const incidentUpdateRepository = new D1IncidentUpdateRepository(env.DB);
			const pageConfigRepository = new D1PageConfigRepository(env.DB);

			const incidents = await incidentRepository.findRecent(50);
			const incidentsWithUpdates = await Promise.all(
				incidents.map(async (incident) => {
					const updates = await incidentUpdateRepository.findByIncidentId(incident.id);
					return {
						...incident,
						updates,
					};
				}),
			);

			const pageConfig = await pageConfigRepository.get();
			const title = pageConfig?.title || env.SITE_TITLE || 'Status Page';
			const baseUrl = env.BASE_URL;

			const rssGenerator = new RssFeedGenerator();
			const rssFeed = rssGenerator.generateRssFeed({
				title,
				description: 'Status updates and incident reports for ' + title,
				link: baseUrl,
				incidents: incidentsWithUpdates,
				lastUpdated: new Date(),
				titleSuffix: env.RSS_TITLE_SUFFIX,
			});

			return new Response(rssFeed, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=900',
				},
			});
		} catch (error) {
			console.error('RSS feed error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},

	async handleStatusPage(generateStatusPageUseCase: GenerateStatusPageUseCase, r2: R2Bucket): Promise<Response> {
		try {
			// Try to get cached version from R2 first
			const cachedPage = await r2.get('status.html');
			if (cachedPage) {
				return new Response(await cachedPage.text(), {
					headers: { 'Content-Type': 'text/html' },
				});
			}

			// Generate fresh page if no cache
			const statusPageHtml = await generateStatusPageUseCase.execute();
			return new Response(statusPageHtml, {
				headers: { 'Content-Type': 'text/html' },
			});
		} catch (error) {
			console.error('Error serving status page:', error);
			return new Response('Error loading status page', { status: 500 });
		}
	},

	async handleServicesApi(request: Request, manageServicesUseCase: ManageServicesUseCase): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					const services = await manageServicesUseCase.getAllServices();
					return new Response(JSON.stringify(services), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = (await request.json()) as CreateServiceRequest;
					const newService = await manageServicesUseCase.createService(createData);
					return new Response(JSON.stringify(newService), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateId = parseInt(url.searchParams.get('id') || '0');
					if (!updateId) {
						return new Response('Invalid service ID', { status: 400 });
					}

					const updateData = (await request.json()) as UpdateServiceRequest;
					const updatedService = await manageServicesUseCase.updateService(updateId, updateData);

					if (!updatedService) {
						return new Response('Service not found', { status: 404 });
					}

					return new Response(JSON.stringify(updatedService), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const id = parseInt(url.searchParams.get('id') || '0');
					if (!id) {
						return new Response('Invalid service ID', { status: 400 });
					}

					const deleted = await manageServicesUseCase.deleteService(id);
					return new Response(JSON.stringify({ deleted }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	checkAdminAuth(request: Request, env: Env): { authenticated: boolean; response?: Response } {
		const authHeader = request.headers.get('Authorization');
		const cookie = request.headers.get('Cookie');

		// Check for session cookie
		if (cookie && cookie.includes('admin-session=authenticated')) {
			return { authenticated: true };
		}

		// Check for basic auth
		if (authHeader && authHeader.startsWith('Basic ')) {
			const credentials = atob(authHeader.slice(6));
			const [username, password] = credentials.split(':');

			// Check against Cloudflare secret
			if (username === 'admin' && password === env.STATUSFLARE_ADMIN_PASSWORD) {
				return { authenticated: true };
			}
		}

		// Return login page
		return {
			authenticated: false,
			response: handler.getLoginPage(),
		};
	},

	getLoginPage(): Response {
		const loginHtml = `<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 400px; margin: 4rem auto; padding: 2rem; background: #f8fafc; }
        .login-form { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { text-align: center; margin-bottom: 2rem; color: #1e293b; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        input { width: 100%; padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
        button { width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
        button:hover { background: #2563eb; }
        .error { color: #dc2626; text-align: center; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="login-form">
        <h1>Admin Login</h1>
        <form id="login-form">
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="username" required autocomplete="username">
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" required autocomplete="current-password">
            </div>
            <button type="submit">Login</button>
            <div id="error" class="error"></div>
        </form>
    </div>
    
    <script>
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const credentials = btoa(username + ':' + password);
            
            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + credentials,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    // Set session cookie and redirect
                    document.cookie = 'admin-session=authenticated; path=/; max-age=3600';
                    window.location.href = '/admin';
                } else {
                    document.getElementById('error').textContent = 'Invalid credentials';
                }
            } catch (error) {
                document.getElementById('error').textContent = 'Login failed';
            }
        });
    </script>
</body>
</html>`;

		return new Response(loginHtml, {
			headers: { 'Content-Type': 'text/html' },
		});
	},

	async handleAdminLogin(request: Request, env: Env): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const authHeader = request.headers.get('Authorization');
		if (authHeader && authHeader.startsWith('Basic ')) {
			const credentials = atob(authHeader.slice(6));
			const [username, password] = credentials.split(':');

			if (username === 'admin' && password === env.STATUSFLARE_ADMIN_PASSWORD) {
				return new Response(JSON.stringify({ success: true }), {
					headers: {
						'Content-Type': 'application/json',
						'Set-Cookie': 'admin-session=authenticated; path=/; max-age=3600; HttpOnly; Secure; SameSite=Strict',
					},
				});
			}
		}

		return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	},

	async handleTriggerChecks(env: Env, ctx: ExecutionContext): Promise<Response> {
		// Manually trigger the scheduled function
		ctx.waitUntil(handler.scheduled({} as ScheduledController, env, ctx));
		return new Response(JSON.stringify({ message: 'Status checks triggered' }), {
			headers: { 'Content-Type': 'application/json' },
		});
	},

	async handleCategoriesApi(request: Request, categoryRepository: any): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					const categories = await categoryRepository.findAll();
					return new Response(JSON.stringify(categories), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = await request.json();
					const newCategory = await categoryRepository.create(createData);
					return new Response(JSON.stringify(newCategory), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const id = parseInt(url.searchParams.get('id') || '0');
					if (!id) {
						return new Response('Invalid category ID', { status: 400 });
					}

					const deleted = await categoryRepository.delete(id);
					return new Response(JSON.stringify({ deleted }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleSystemStatusApi(request: Request, systemStatusRepository: any): Promise<Response> {
		try {
			switch (request.method) {
				case 'GET':
					const status = await systemStatusRepository.get();
					return new Response(JSON.stringify(status), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateData = await request.json();
					const updatedStatus = await systemStatusRepository.update(updateData);
					return new Response(JSON.stringify(updatedStatus), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleIncidentsApi(request: Request, incidentRepository: any): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					const incidents = await incidentRepository.findAll();
					return new Response(JSON.stringify(incidents), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = await request.json();
					const newIncident = await incidentRepository.create(createData);
					return new Response(JSON.stringify(newIncident), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateId = parseInt(url.searchParams.get('id') || '0');
					if (!updateId) {
						return new Response('Invalid incident ID', { status: 400 });
					}

					const updateData = await request.json();
					const updatedIncident = await incidentRepository.update(updateId, updateData);

					if (!updatedIncident) {
						return new Response('Incident not found', { status: 404 });
					}

					return new Response(JSON.stringify(updatedIncident), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const id = parseInt(url.searchParams.get('id') || '0');
					if (!id) {
						return new Response('Invalid incident ID', { status: 400 });
					}

					const deleted = await incidentRepository.delete(id);
					return new Response(JSON.stringify({ deleted }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleIncidentUpdatesApi(request: Request, incidentUpdateRepository: any): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					// Get updates for a specific incident
					const incidentId = url.searchParams.get('incident_id');
					if (incidentId) {
						const updates = await incidentUpdateRepository.findByIncidentId(parseInt(incidentId));
						return new Response(JSON.stringify(updates), {
							headers: { 'Content-Type': 'application/json' },
						});
					}

					// Get all updates
					const allUpdates = await incidentUpdateRepository.findAll();
					return new Response(JSON.stringify(allUpdates), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = await request.json();
					const newUpdate = await incidentUpdateRepository.create(createData);
					return new Response(JSON.stringify(newUpdate), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateId = parseInt(url.searchParams.get('id') || '0');
					if (!updateId) {
						return new Response('Invalid update ID', { status: 400 });
					}

					const updateData = await request.json();
					const updatedUpdate = await incidentUpdateRepository.update(updateId, updateData);

					if (!updatedUpdate) {
						return new Response('Update not found', { status: 404 });
					}

					return new Response(JSON.stringify(updatedUpdate), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const id = parseInt(url.searchParams.get('id') || '0');
					if (!id) {
						return new Response('Invalid update ID', { status: 400 });
					}

					const deleted = await incidentUpdateRepository.delete(id);
					return new Response(JSON.stringify({ deleted }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handlePageConfigApi(request: Request, pageConfigRepository: any): Promise<Response> {
		try {
			switch (request.method) {
				case 'GET':
					const config = await pageConfigRepository.get();
					return new Response(JSON.stringify(config), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateData = await request.json();
					const updatedConfig = await pageConfigRepository.update(updateData);
					return new Response(JSON.stringify(updatedConfig), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleSLOsApi(request: Request, sloRepository: D1SLORepository): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					const serviceId = url.searchParams.get('service_id');
					let slos;
					if (serviceId) {
						slos = await sloRepository.getSLOsByServiceId(parseInt(serviceId));
					} else {
						slos = await sloRepository.getAllSLOs();
					}
					return new Response(JSON.stringify(slos), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = await request.json();

					// Validate the incoming data structure
					if (!createData || typeof createData !== 'object') {
						return new Response('Invalid request body', { status: 400 });
					}

					// Type assertion with runtime validation
					const sloData = createData as Omit<SLO, 'id' | 'createdAt' | 'updatedAt'>;

					// Basic validation of required fields
					if (
						typeof sloData.serviceId !== 'number' ||
						typeof sloData.name !== 'string' ||
						!['availability', 'latency'].includes(sloData.sliType) ||
						typeof sloData.targetPercentage !== 'number' ||
						typeof sloData.timeWindowDays !== 'number' ||
						typeof sloData.enabled !== 'boolean'
					) {
						return new Response('Invalid SLO data structure', { status: 400 });
					}

					const newSLOId = await sloRepository.createSLO(sloData);
					const newSLO = await sloRepository.getSLOById(newSLOId);
					return new Response(JSON.stringify(newSLO), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateId = parseInt(url.searchParams.get('id') || '0');
					if (!updateId) {
						return new Response('Invalid SLO ID', { status: 400 });
					}

					const updateData = await request.json();

					// Validate the incoming data structure
					if (!updateData || typeof updateData !== 'object') {
						return new Response('Invalid request body', { status: 400 });
					}

					// Type assertion with runtime validation for partial update
					const sloUpdateData = updateData as Partial<SLO>;

					// Validate types of provided fields (all are optional in Partial<SLO>)
					if (
						(sloUpdateData.serviceId !== undefined && typeof sloUpdateData.serviceId !== 'number') ||
						(sloUpdateData.name !== undefined && typeof sloUpdateData.name !== 'string') ||
						(sloUpdateData.sliType !== undefined && !['availability', 'latency'].includes(sloUpdateData.sliType)) ||
						(sloUpdateData.targetPercentage !== undefined && typeof sloUpdateData.targetPercentage !== 'number') ||
						(sloUpdateData.timeWindowDays !== undefined && typeof sloUpdateData.timeWindowDays !== 'number') ||
						(sloUpdateData.enabled !== undefined && typeof sloUpdateData.enabled !== 'boolean') ||
						(sloUpdateData.latencyThresholdMs !== undefined && typeof sloUpdateData.latencyThresholdMs !== 'number')
					) {
						return new Response('Invalid SLO update data structure', { status: 400 });
					}

					await sloRepository.updateSLO(updateId, sloUpdateData);

					const updatedSLO = await sloRepository.getSLOById(updateId);

					if (!updatedSLO) {
						return new Response('SLO not found', { status: 404 });
					}

					return new Response(JSON.stringify(updatedSLO), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const deleteId = parseInt(url.searchParams.get('id') || '0');
					if (!deleteId) {
						return new Response('Invalid SLO ID', { status: 400 });
					}

					await sloRepository.deleteSLO(deleteId);
					return new Response(JSON.stringify({ deleted: true }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleNotificationChannelsApi(request: Request, sloRepository: D1SLORepository): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					const channels = await sloRepository.getAllNotificationChannels();
					return new Response(JSON.stringify(channels), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = await request.json();

					// Validate the incoming data structure
					if (!createData || typeof createData !== 'object') {
						return new Response('Invalid request body', { status: 400 });
					}

					// Type assertion with runtime validation
					const channelData = createData as Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>;

					// Basic validation of required fields
					if (
						typeof channelData.name !== 'string' ||
						!['webhook', 'email', 'sms'].includes(channelData.type) ||
						typeof channelData.config !== 'string' ||
						typeof channelData.enabled !== 'boolean'
					) {
						return new Response('Invalid notification channel data structure', { status: 400 });
					}

					const newChannelId = await sloRepository.createNotificationChannel(channelData);
					const newChannel = await sloRepository.getNotificationChannelById(newChannelId);
					return new Response(JSON.stringify(newChannel), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateId = parseInt(url.searchParams.get('id') || '0');
					if (!updateId) {
						return new Response('Invalid channel ID', { status: 400 });
					}

					const updateData = await request.json();

					// Validate the incoming data structure
					if (!updateData || typeof updateData !== 'object') {
						return new Response('Invalid request body', { status: 400 });
					}

					// Type assertion with runtime validation for partial update
					const channelUpdateData = updateData as Partial<NotificationChannel>;

					// Validate types of provided fields (all are optional in Partial<NotificationChannel>)
					if (
						(channelUpdateData.name !== undefined && typeof channelUpdateData.name !== 'string') ||
						(channelUpdateData.type !== undefined && !['webhook', 'email', 'sms'].includes(channelUpdateData.type)) ||
						(channelUpdateData.config !== undefined && typeof channelUpdateData.config !== 'string') ||
						(channelUpdateData.enabled !== undefined && typeof channelUpdateData.enabled !== 'boolean')
					) {
						return new Response('Invalid notification channel update data structure', { status: 400 });
					}

					await sloRepository.updateNotificationChannel(updateId, channelUpdateData);
					const updatedChannel = await sloRepository.getNotificationChannelById(updateId);

					if (!updatedChannel) {
						return new Response('Channel not found', { status: 404 });
					}

					return new Response(JSON.stringify(updatedChannel), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const deleteId = parseInt(url.searchParams.get('id') || '0');
					if (!deleteId) {
						return new Response('Invalid channel ID', { status: 400 });
					}

					await sloRepository.deleteNotificationChannel(deleteId);
					return new Response(JSON.stringify({ deleted: true }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleSLONotificationsApi(request: Request, sloRepository: D1SLORepository): Promise<Response> {
		const url = new URL(request.url);

		try {
			switch (request.method) {
				case 'GET':
					const sloId = url.searchParams.get('slo_id');
					let notifications;
					if (sloId) {
						notifications = await sloRepository.getSLONotificationsBySLOId(parseInt(sloId));
					} else {
						notifications = await sloRepository.getAllSLONotifications();
					}
					return new Response(JSON.stringify(notifications), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'POST':
					const createData = await request.json();

					// Validate the incoming data structure
					if (!createData || typeof createData !== 'object') {
						return new Response('Invalid request body', { status: 400 });
					}

					// Type assertion with runtime validation
					const notificationData = createData as Omit<SLONotification, 'id' | 'createdAt'>;

					// Basic validation of required fields
					if (
						typeof notificationData.sloId !== 'number' ||
						typeof notificationData.notificationChannelId !== 'number' ||
						typeof notificationData.burnRateThreshold !== 'number' ||
						typeof notificationData.enabled !== 'boolean'
					) {
						return new Response('Invalid SLO notification data structure', { status: 400 });
					}

					const newNotificationId = await sloRepository.createSLONotification(notificationData);
					const newNotification = await sloRepository.getSLONotificationById(newNotificationId);
					return new Response(JSON.stringify(newNotification), {
						status: 201,
						headers: { 'Content-Type': 'application/json' },
					});

				case 'PUT':
					const updateId = parseInt(url.searchParams.get('id') || '0');
					if (!updateId) {
						return new Response('Invalid notification ID', { status: 400 });
					}

					const updateData = await request.json();

					// Validate the incoming data structure
					if (!updateData || typeof updateData !== 'object') {
						return new Response('Invalid request body', { status: 400 });
					}

					// Type assertion with runtime validation for partial update
					const notificationUpdateData = updateData as Partial<SLONotification>;

					// Validate types of provided fields (all are optional in Partial<SLONotification>)
					if (
						(notificationUpdateData.sloId !== undefined && typeof notificationUpdateData.sloId !== 'number') ||
						(notificationUpdateData.notificationChannelId !== undefined &&
							typeof notificationUpdateData.notificationChannelId !== 'number') ||
						(notificationUpdateData.burnRateThreshold !== undefined && typeof notificationUpdateData.burnRateThreshold !== 'number') ||
						(notificationUpdateData.enabled !== undefined && typeof notificationUpdateData.enabled !== 'boolean')
					) {
						return new Response('Invalid SLO notification update data structure', { status: 400 });
					}

					await sloRepository.updateSLONotification(updateId, notificationUpdateData);
					const updatedNotification = await sloRepository.getSLONotificationById(updateId);

					if (!updatedNotification) {
						return new Response('Notification not found', { status: 404 });
					}

					return new Response(JSON.stringify(updatedNotification), {
						headers: { 'Content-Type': 'application/json' },
					});

				case 'DELETE':
					const deleteId = parseInt(url.searchParams.get('id') || '0');
					if (!deleteId) {
						return new Response('Invalid notification ID', { status: 400 });
					}

					await sloRepository.deleteSLONotification(deleteId);
					return new Response(JSON.stringify({ deleted: true }), {
						headers: { 'Content-Type': 'application/json' },
					});

				default:
					return new Response('Method not allowed', { status: 405 });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async handleSLOMetricsApi(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		try {
			if (request.method !== 'GET') {
				return new Response('Method not allowed', { status: 405 });
			}

			const sloId = parseInt(url.searchParams.get('slo_id') || '0');
			if (!sloId) {
				return new Response('SLO ID required', { status: 400 });
			}

			// Initialize repositories and services
			const serviceRepository = new D1ServiceRepository(env.DB);
			const statusCheckRepository = new D1StatusCheckRepository(env.DB);
			const sloRepository = new D1SLORepository(env.DB);
			const sloCalculationService = new DefaultSLOCalculationService();
			const notificationService = new DefaultNotificationService(env.BASE_URL);

			const sloMonitoringUseCase = new SLOMonitoringUseCase(
				sloRepository,
				serviceRepository,
				statusCheckRepository,
				sloCalculationService,
				notificationService,
				env.BASE_URL,
			);

			const metrics = await sloMonitoringUseCase.calculateSLOMetrics(sloId);
			return new Response(JSON.stringify(metrics), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
};

export default handler satisfies ExportedHandler<Env>;
