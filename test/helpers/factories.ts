import { Service } from '../../src/domain/entities/Service';
import { StatusCheck } from '../../src/domain/entities/StatusCheck';
import { ServiceStatus } from '../../src/domain/value-objects/ServiceStatus';

export function createMockService(overrides: Partial<Service> = {}): Service {
	return {
		id: 1,
		name: 'Test Service',
		url: 'https://api.example.com',
		method: 'GET',
		expectedStatus: 200,
		expectedContent: 'OK',
		timeoutMs: 30000,
		enabled: true,
		categoryId: 1,
		monitorType: 'http',
		createdAt: new Date('2024-01-01T00:00:00.000Z'),
		updatedAt: new Date('2024-01-01T00:00:00.000Z'),
		...overrides,
	};
}

export function createMockStatusCheck(overrides: Partial<StatusCheck> = {}): StatusCheck {
	return {
		id: 1,
		serviceId: 1,
		status: ServiceStatus.UP,
		responseTimeMs: 150,
		statusCode: 200,
		checkedAt: new Date('2024-01-01T10:00:00.000Z'),
		errorMessage: undefined,
		...overrides,
	};
}
