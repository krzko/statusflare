export type ServiceStatus = 'up' | 'down' | 'degraded';

export interface StatusCheck {
	id: number;
	serviceId: number;
	status: ServiceStatus;
	responseTimeMs?: number;
	statusCode?: number;
	errorMessage?: string;
	checkedAt: Date;
}

export interface CreateStatusCheckRequest {
	serviceId: number;
	status: ServiceStatus;
	responseTimeMs?: number;
	statusCode?: number;
	errorMessage?: string;
	checkedAt?: Date;
}
