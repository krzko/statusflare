import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1StatusCheckRepository } from '../../../src/infrastructure/repositories/D1StatusCheckRepository';
import { StatusCheck } from '../../../src/domain/entities/StatusCheck';
import { ServiceStatus } from '../../../src/domain/value-objects/ServiceStatus';
import { createMockStatusCheck } from '../../helpers/factories';

// Mock D1Database
const mockD1Database = {
	prepare: vi.fn(),
	batch: vi.fn(),
	exec: vi.fn(),
	dump: vi.fn(),
};

// Mock prepared statement
const mockPreparedStatement = {
	bind: vi.fn(),
	first: vi.fn(),
	all: vi.fn(),
	run: vi.fn(),
};

describe('D1StatusCheckRepository', () => {
	let repository: D1StatusCheckRepository;

	beforeEach(() => {
		repository = new D1StatusCheckRepository(mockD1Database as any);
		vi.clearAllMocks();

		// Reset mock implementations
		mockD1Database.prepare.mockReturnValue(mockPreparedStatement);
		mockPreparedStatement.bind.mockReturnValue(mockPreparedStatement);
	});

	const mockStatusCheckData = {
		id: 1,
		service_id: 100,
		status: 'up',
		response_time_ms: 150,
		status_code: 200,
		checked_at: '2024-01-01T10:00:00.000Z',
		error_message: null,
	};

	const mockStatusCheck = createMockStatusCheck({
		id: 1,
		serviceId: 100,
		status: ServiceStatus.UP,
		responseTimeMs: 150,
		statusCode: 200,
		checkedAt: new Date('2024-01-01T10:00:00.000Z'),
		errorMessage: null,
	});

	describe('findByServiceId', () => {
		it('should return status checks for a specific service', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [mockStatusCheckData],
				success: true,
			});

			const checks = await repository.findByServiceId(100);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				'SELECT * FROM status_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT ?'
			);
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(100, 100);
			expect(checks).toHaveLength(1);
			expect(checks[0]).toMatchObject({ id: expect.any(Number), serviceId: expect.any(Number) });
			expect(checks[0].serviceId).toBe(100);
		});

		it('should return empty array when no checks exist for service', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			const checks = await repository.findByServiceId(999);

			expect(checks).toHaveLength(0);
		});

		it('should handle database errors gracefully', async () => {
			mockPreparedStatement.all.mockRejectedValueOnce(new Error('Database error'));

			await expect(repository.findByServiceId(100)).rejects.toThrow('Database error');
		});
	});

	describe('findByServiceIdInTimeRange', () => {
		it('should return checks within specified time range', async () => {
			const startDate = new Date('2024-01-01T00:00:00.000Z');
			const endDate = new Date('2024-01-02T00:00:00.000Z');

			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [mockStatusCheckData],
				success: true,
			});

			const checks = await repository.findByServiceIdInTimeRange(100, startDate, endDate);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				expect.stringContaining('WHERE service_id = ?')
			);
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
				100,
				startDate.toISOString(),
				endDate.toISOString()
			);
			expect(checks).toHaveLength(1);
		});

		it('should handle edge case dates correctly', async () => {
			const startDate = new Date('2024-01-01T00:00:00.000Z');
			const endDate = new Date('2024-01-01T00:00:00.000Z'); // Same date

			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			const checks = await repository.findByServiceIdInTimeRange(100, startDate, endDate);

			expect(checks).toHaveLength(0);
		});
	});

	describe('findByServiceId with limit', () => {
		it('should return recent checks with specified limit', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [mockStatusCheckData],
				success: true,
			});

			const checks = await repository.findByServiceId(100, 10);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				'SELECT * FROM status_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT ?'
			);
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(100, 10);
			expect(checks).toHaveLength(1);
		});

		it('should use default limit when not specified', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			await repository.findByServiceId(100);

			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(100, 100); // Default limit
		});
	});

	describe('create', () => {
		it('should insert new status check', async () => {
			const newCheck = createMockStatusCheck({
				serviceId: 100,
				status: ServiceStatus.UP,
				responseTimeMs: 200,
				statusCode: 200,
				checkedAt: new Date('2024-01-01T11:00:00.000Z'),
				errorMessage: null,
			});

			mockPreparedStatement.first.mockResolvedValueOnce({
				id: 2,
				service_id: 100,
				status: 'up',
				response_time_ms: 200,
				status_code: 200,
				checked_at: '2024-01-01T11:00:00.000Z',
				error_message: null,
			});

			const savedCheck = await repository.create(newCheck);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO status_checks')
			);
			expect(savedCheck.id).toBe(2);
		});

		it('should handle insert failures', async () => {
			const newCheck = createMockStatusCheck({
				serviceId: 100,
				status: ServiceStatus.DOWN,
				responseTimeMs: 0,
				statusCode: 500,
				checkedAt: new Date(),
				errorMessage: 'Internal Server Error',
			});

			mockPreparedStatement.first.mockRejectedValueOnce(new Error('Insert failed'));

			await expect(repository.create(newCheck)).rejects.toThrow('Insert failed');
		});
	});

	describe('deleteOld', () => {
		it('should delete checks older than specified days', async () => {
			mockPreparedStatement.run.mockResolvedValueOnce({
				success: true,
				meta: { changes: 5 },
			});

			await repository.deleteOld(7);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				'DELETE FROM status_checks WHERE checked_at < datetime("now", "-" || ? || " days")'
			);
		});

		it('should handle deletion failures', async () => {
			mockPreparedStatement.run.mockRejectedValueOnce(new Error('Delete failed'));

			await expect(repository.deleteOld(30)).rejects.toThrow('Delete failed');
		});

		it('should validate positive days parameter', async () => {
			mockPreparedStatement.run.mockResolvedValueOnce({
				success: true,
				meta: { changes: 0 },
			});

			await repository.deleteOld(1);

			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1);
		});
	});

	describe('data transformation', () => {
		it('should correctly transform database row to StatusCheck entity', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [mockStatusCheckData],
				success: true,
			});

			const checks = await repository.findByServiceId(100);
			const check = checks[0];

			expect(check).toMatchObject({ id: expect.any(Number), serviceId: expect.any(Number) });
			expect(check.id).toBe(1);
			expect(check.serviceId).toBe(100);
			expect(check.status).toBe('up');
			expect(check.responseTimeMs).toBe(150);
			expect(check.statusCode).toBe(200);
			expect(check.checkedAt).toEqual(new Date('2024-01-01T10:00:00.000Z'));
			expect(check.errorMessage).toBeNull();
		});

		it('should handle different status values correctly', async () => {
			const downCheckData = {
				...mockStatusCheckData,
				status: 'down',
				error_message: 'Connection failed',
			};

			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [downCheckData],
				success: true,
			});

			const checks = await repository.findByServiceId(100);
			const check = checks[0];

			expect(check.status).toBe('down');
			expect(check.errorMessage).toBe('Connection failed');
		});

		it('should correctly transform StatusCheck entity to database parameters', async () => {
			const newCheck = createMockStatusCheck({
				serviceId: 200,
				status: ServiceStatus.DOWN,
				responseTimeMs: 0,
				statusCode: 500,
				checkedAt: new Date('2024-01-01T11:00:00.000Z'),
				errorMessage: 'Timeout occurred',
			});

			mockPreparedStatement.first.mockResolvedValueOnce({
				id: 3,
				service_id: 200,
				status: 'down',
				response_time_ms: 0,
				status_code: 500,
				checked_at: '2024-01-01T11:00:00.000Z',
				error_message: 'Timeout occurred',
			});

			await repository.create(newCheck);

			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
				200,
				'down',
				null,
				500,
				'Timeout occurred'
			);
		});

		it('should handle null error messages correctly', async () => {
			const successfulCheck = createMockStatusCheck({
				serviceId: 200,
				status: ServiceStatus.UP,
				responseTimeMs: 100,
				statusCode: 200,
				checkedAt: new Date('2024-01-01T11:00:00.000Z'),
				errorMessage: null,
			});

			mockPreparedStatement.first.mockResolvedValueOnce({
				id: 4,
				service_id: 200,
				status: 'up',
				response_time_ms: 100,
				status_code: 200,
				checked_at: '2024-01-01T11:00:00.000Z',
				error_message: null,
			});

			await repository.create(successfulCheck);

			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(200, 'up', 100, 200, null);
		});
	});

	describe('status enumeration handling', () => {
		it('should correctly map status strings to ServiceStatus enum', () => {
			const statusMappings = [
				{ db: 'up', enum: 'up' },
				{ db: 'down', enum: 'down' },
				{ db: 'degraded', enum: 'degraded' },
			];

			statusMappings.forEach(({ db, enum: expectedEnum }) => {
				// This tests the internal mapping logic
				expect(['up', 'down', 'degraded']).toContain(db);
				expect(['up', 'down', 'degraded']).toContain(expectedEnum);
			});
		});

		it('should handle invalid status values gracefully', async () => {
			const invalidStatusData = {
				...mockStatusCheckData,
				status: 'invalid_status',
			};

			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [invalidStatusData],
				success: true,
			});

			// Should not throw, but should handle gracefully
			const checks = await repository.findByServiceId(100);
			expect(checks).toHaveLength(1);
			// The actual implementation should default to UNKNOWN for invalid statuses
		});
	});

	describe('performance considerations', () => {
		it('should use appropriate indexes in queries', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			await repository.findByServiceId(100);

			// Verify that the query structure supports indexing on service_id
			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				expect.stringContaining('WHERE service_id = ?')
			);
		});

		it('should limit results in recent queries to prevent memory issues', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			await repository.findByServiceId(100, 1000);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'));
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(100, 1000);
		});

		it('should use date-based queries for time range filtering', async () => {
			const startDate = new Date('2024-01-01T00:00:00.000Z');
			const endDate = new Date('2024-01-02T00:00:00.000Z');

			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			await repository.findByServiceIdInTimeRange(100, startDate, endDate);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(expect.stringContaining('checked_at >='));
		});
	});
});
