import { HealthCheckService, HealthCheckResult } from '../../domain/services/HealthCheckService';
import { Service } from '../../domain/entities/Service';
import { ServiceStatus } from '../../domain/entities/StatusCheck';

export class HttpHealthCheckService implements HealthCheckService {
	constructor(private env?: Env) {}

	async performCheck(service: Service): Promise<HealthCheckResult> {
		const startTime = Date.now();

		// Handle database monitoring separately
		if (service.monitorType === 'database') {
			return this.performDatabaseCheck(service, startTime);
		}

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), service.timeoutMs);

			// Prepare headers
			const headers: Record<string, string> = {
				'User-Agent': 'Mozilla/5.0 (compatible; Statusflare/1.0; https://statusflare.org)',
			};

			// Add custom headers for API monitoring
			if (service.monitorType === 'api' && service.requestHeaders) {
				try {
					const customHeaders = JSON.parse(service.requestHeaders);
					Object.assign(headers, customHeaders);
				} catch (error) {
					console.warn('Invalid JSON in request headers:', service.requestHeaders);
				}
			}

			// Add bearer token if specified
			if (service.bearerToken) {
				headers['Authorization'] = `Bearer ${service.bearerToken}`;
			}

			// Prepare request options
			const requestOptions: RequestInit = {
				method: service.method,
				signal: controller.signal,
				headers,
			};

			// Add request body for API monitoring
			if (service.monitorType === 'api' && service.requestBody) {
				requestOptions.body = service.requestBody;
				headers['Content-Type'] = headers['Content-Type'] || 'application/json';
			}

			const response = await fetch(service.url, requestOptions);

			clearTimeout(timeoutId);
			const responseTime = Date.now() - startTime;

			// For HTTP monitoring, check status code first
			if (service.monitorType === 'http' && response.status !== service.expectedStatus) {
				return {
					status: 'down',
					responseTimeMs: responseTime,
					statusCode: response.status,
					errorMessage: `Expected status ${service.expectedStatus}, got ${response.status}`,
				};
			}

			// For API monitoring, check status code (2xx as default success)
			if (service.monitorType === 'api' && (response.status < 200 || response.status >= 300)) {
				return {
					status: 'down',
					responseTimeMs: responseTime,
					statusCode: response.status,
					errorMessage: `API returned non-2xx status: ${response.status}`,
				};
			}

			// Get response text for content checks
			const responseText = await response.text();

			// For keyword monitoring, check if keyword exists (case-insensitive)
			if (service.monitorType === 'keyword') {
				if (!service.keyword) {
					return {
						status: 'down',
						responseTimeMs: responseTime,
						statusCode: response.status,
						errorMessage: 'No keyword specified for keyword monitoring',
					};
				}

				const keywordFound = responseText.toLowerCase().includes(service.keyword.toLowerCase());
				if (!keywordFound) {
					return {
						status: 'down',
						responseTimeMs: responseTime,
						statusCode: response.status,
						errorMessage: `Keyword "${service.keyword}" not found in response`,
					};
				}
			}

			// Check expected content for HTTP monitoring (legacy support)
			if (service.monitorType === 'http' && service.expectedContent) {
				if (!responseText.includes(service.expectedContent)) {
					return {
						status: 'down',
						responseTimeMs: responseTime,
						statusCode: response.status,
						errorMessage: `Expected content "${service.expectedContent}" not found in response`,
					};
				}
			}

			// Determine status based on response time
			let status: ServiceStatus = 'up';
			if (responseTime > service.timeoutMs * 0.8) {
				status = 'degraded';
			}

			return {
				status,
				responseTimeMs: responseTime,
				statusCode: response.status,
				errorMessage: null,
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;
			let errorMessage = 'Unknown error';

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					errorMessage = `Request timeout after ${service.timeoutMs}ms`;
				} else {
					errorMessage = error.message;
				}
			}

			return {
				status: 'down',
				responseTimeMs: responseTime,
				errorMessage,
			};
		}
	}

	private async performDatabaseCheck(service: Service, startTime: number): Promise<HealthCheckResult> {
		try {
			console.log(`Database check for "${service.name}": Starting validation`);

			if (!service.hyperdriveId) {
				console.log(`Database check for "${service.name}": No Hyperdrive ID provided`);
				return {
					status: 'down',
					responseTimeMs: Date.now() - startTime,
					errorMessage: 'No Hyperdrive ID specified for database monitoring',
				};
			}

			// Get Hyperdrive binding from environment
			const hyperdrive = this.getHyperdriveBinding(service.hyperdriveId);
			if (!hyperdrive) {
				console.log(`Database check for "${service.name}": Hyperdrive binding not found for ID: ${service.hyperdriveId}`);
				return {
					status: 'down',
					responseTimeMs: Date.now() - startTime,
					errorMessage: `Hyperdrive binding not found for ID: ${service.hyperdriveId}`,
				};
			}

			// Dynamically import postgres to avoid startup issues
			console.log(`Database check for "${service.name}": Importing postgres library`);
			let postgres;
			try {
				postgres = (await import('postgres')).default;
				console.log(`Database check for "${service.name}": Successfully imported postgres library`);
			} catch (importError) {
				console.error(`Database check for "${service.name}": Failed to import postgres library:`, importError);
				return {
					status: 'down',
					responseTimeMs: Date.now() - startTime,
					errorMessage: 'Database library not available in this environment',
				};
			}

			// Create PostgreSQL connection using the postgres library with optimised settings
			const connectionConfig = {
				connect_timeout: Math.floor(service.timeoutMs / 1000), // Convert to seconds
				idle_timeout: 5, // Reduced from 10
				max_lifetime: 10, // Reduced from 30
				max: 1, // Single connection for health check
				prepare: false, // Disable prepared statements to reduce subrequests
				fetch_types: false, // Disable type fetching to reduce subrequests
				debug: false, // Disable debug mode
			};

			console.log(`Database check for "${service.name}": Creating connection with timeout ${connectionConfig.connect_timeout}s`);
			console.log(`Database check for "${service.name}": Using Hyperdrive binding: ${service.hyperdriveId}`);

			const sql = postgres(hyperdrive.connectionString, connectionConfig);

			try {
				const query = service.databaseQuery || 'SELECT 1 as health_check';
				console.log(`Database check for "${service.name}": Executing query: ${query}`);

				// Execute the health check query with timeout to prevent hanging connections
				const result = await Promise.race([
					sql`${sql.unsafe(query)}`,
					new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), service.timeoutMs)),
				]);

				const responseTime = Date.now() - startTime;
				console.log(
					`Database check for "${service.name}": Query successful, response time: ${responseTime}ms, result rows: ${Array.isArray(result) ? result.length : 'unknown'}`,
				);

				// Determine status based on response time
				let status: ServiceStatus = 'up';
				if (responseTime > service.timeoutMs * 0.8) {
					status = 'degraded';
					console.log(
						`Database check for "${service.name}": Status degraded due to slow response (${responseTime}ms > ${service.timeoutMs * 0.8}ms threshold)`,
					);
				}

				// Close the connection immediately with short timeout
				console.log(`Database check for "${service.name}": Closing connection`);
				await sql.end({ timeout: 2 });

				return {
					status,
					responseTimeMs: responseTime,
					statusCode: 200, // PostgreSQL doesn't use HTTP status codes
				};
			} catch (queryError) {
				console.error(`Database check for "${service.name}": Query execution failed:`, queryError);

				try {
					await sql.end({ timeout: 1 }); // Force close on error
				} catch (closeError) {
					console.error(`Database check for "${service.name}": Failed to close connection:`, closeError);
				}

				const responseTime = Date.now() - startTime;
				let errorMessage = 'Database query failed';

				if (queryError instanceof Error) {
					errorMessage = `Database error: ${queryError.message}`;
					console.error(`Database check for "${service.name}": Detailed error - ${queryError.name}: ${queryError.message}`);
					if (queryError.stack) {
						console.error(`Database check for "${service.name}": Stack trace:`, queryError.stack);
					}
				}

				return {
					status: 'down',
					responseTimeMs: responseTime,
					errorMessage,
				};
			}
		} catch (error) {
			const responseTime = Date.now() - startTime;
			let errorMessage = 'Database connection failed';

			console.error(`Database check for "${service.name}": Connection setup failed:`, error);

			if (error instanceof Error) {
				errorMessage = `Database error: ${error.message}`;
				console.error(`Database check for "${service.name}": Detailed connection error - ${error.name}: ${error.message}`);
				if (error.stack) {
					console.error(`Database check for "${service.name}": Stack trace:`, error.stack);
				}
			}

			return {
				status: 'down',
				responseTimeMs: responseTime,
				errorMessage,
			};
		}
	}

	private getHyperdriveBinding(hyperdriveId: string): Hyperdrive | null {
		if (!this.env) {
			return null;
		}

		// Get all possible Hyperdrive bindings from environment
		const allBindings = Object.keys(this.env).filter((key) => key.startsWith('HYPERDRIVE') && (this.env as any)[key]);

		console.log(`Database check: Found ${allBindings.length} Hyperdrive bindings: ${allBindings.join(', ')}`);

		// Try to find the binding that matches our Hyperdrive ID
		for (const bindingName of allBindings) {
			const binding = (this.env as any)[bindingName] as Hyperdrive;
			if (binding) {
				// Check if this binding's ID matches the requested hyperdriveId
				// Note: We'll need to check the binding's configuration or use a mapping
				console.log(`Database check: Testing Hyperdrive binding: ${bindingName} for ID: ${hyperdriveId}`);

				// For now, we'll use a simple mapping approach
				// In the future, we could store the mapping in the environment or configuration
				if (this.isMatchingHyperdrive(bindingName, hyperdriveId)) {
					console.log(`Database check: Using Hyperdrive binding: ${bindingName} for ID: ${hyperdriveId}`);
					return binding;
				}
			}
		}

		// Fallback: if no specific match found, use the first available binding
		// This maintains backward compatibility
		if (allBindings.length > 0) {
			const fallbackBinding = (this.env as any)[allBindings[0]] as Hyperdrive;
			console.warn(`Database check: No specific match for Hyperdrive ID ${hyperdriveId}, using fallback binding: ${allBindings[0]}`);
			return fallbackBinding;
		}

		console.error(`Database check: No Hyperdrive bindings found in environment`);
		return null;
	}

	private isMatchingHyperdrive(bindingName: string, hyperdriveId: string): boolean {
		// Simple mapping approach - in production you might want to use environment variables
		// or a more sophisticated configuration system

		// For now, we'll check if the Hyperdrive ID is stored in an environment variable
		// that corresponds to the binding name
		const mappingKey = `${bindingName}_ID`;
		const storedId = (this.env as any)[mappingKey];

		if (storedId === hyperdriveId) {
			return true;
		}

		// Fallback: check if hyperdriveId matches common patterns
		// This is a temporary solution until proper ID mapping is implemented
		if (bindingName === 'HYPERDRIVE' && hyperdriveId) {
			return true; // Default binding matches any ID for backward compatibility
		}

		return false;
	}
}
