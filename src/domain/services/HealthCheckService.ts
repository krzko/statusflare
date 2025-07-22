import { Service } from '../entities/Service';
import { ServiceStatus } from '../entities/StatusCheck';

export interface HealthCheckResult {
	status: ServiceStatus;
	responseTimeMs?: number;
	statusCode?: number;
	errorMessage?: string | null;
}

export interface HealthCheckService {
	performCheck(service: Service): Promise<HealthCheckResult>;
}
