export type ServiceStatus = 'up' | 'down' | 'degraded';

export const ServiceStatus = {
	UP: 'up' as const,
	DOWN: 'down' as const,
	DEGRADED: 'degraded' as const,
	UNKNOWN: 'degraded' as const, // Map unknown to degraded for backwards compatibility
} as const;

export type ServiceStatusValue = (typeof ServiceStatus)[keyof typeof ServiceStatus];
