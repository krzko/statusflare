import { SystemStatus, UpdateSystemStatusRequest } from '../entities/SystemStatus';

export interface SystemStatusRepository {
	get(): Promise<SystemStatus>;
	update(status: UpdateSystemStatusRequest): Promise<SystemStatus>;
}
