import { StatusCheck, CreateStatusCheckRequest } from '../entities/StatusCheck';

export interface StatusCheckRepository {
	findByServiceId(serviceId: number, limit?: number): Promise<StatusCheck[]>;
	findByServiceIdInTimeRange(
		serviceId: number,
		startTime: Date,
		endTime: Date
	): Promise<StatusCheck[]>;
	findLatestByServiceId(serviceId: number): Promise<StatusCheck | null>;
	findRecent(hours: number): Promise<StatusCheck[]>;
	create(statusCheck: CreateStatusCheckRequest): Promise<StatusCheck>;
	deleteOld(olderThanDays: number): Promise<number>;
}
