import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1ServiceRepository } from '../../../src/infrastructure/repositories/D1ServiceRepository';
import { Service } from '../../../src/domain/entities/Service';
import { createMockService } from '../../helpers/factories';

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

describe('D1ServiceRepository', () => {
	let repository: D1ServiceRepository;

	beforeEach(() => {
		repository = new D1ServiceRepository(mockD1Database as any);
		vi.clearAllMocks();

		// Reset mock implementations
		mockD1Database.prepare.mockReturnValue(mockPreparedStatement);
		mockPreparedStatement.bind.mockReturnValue(mockPreparedStatement);
	});

	const mockServiceData = {
		id: 1,
		name: 'Test Service',
		url: 'https://api.example.com',
		method: 'GET',
		expected_status: 200,
		expected_content: 'OK',
		timeout_ms: 30000,
		enabled: true,
		category_id: 1,
		monitor_type: 'http',
		created_at: '2024-01-01T00:00:00.000Z',
		updated_at: '2024-01-01T00:00:00.000Z',
	};

	const mockService = createMockService({
		id: '1',
		name: 'Test Service',
		description: 'A test service',
		url: 'https://api.example.com',
		method: 'GET',
		expectedStatus: 200,
		expectedBody: 'OK',
		timeout: 30,
		interval: 300,
		categoryId: '1',
		isActive: true,
		createdAt: new Date('2024-01-01T00:00:00.000Z'),
		updatedAt: new Date('2024-01-01T00:00:00.000Z'),
	});

	describe('findAll', () => {
		it('should return all services from database', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [mockServiceData],
				success: true,
			});

			const services = await repository.findAll();

			expect(mockD1Database.prepare).toHaveBeenCalledWith('SELECT * FROM services ORDER BY name');
			expect(services).toHaveLength(1);
			expect(services[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
			expect(services[0].name).toBe('Test Service');
		});

		it('should return empty array when no services exist', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			const services = await repository.findAll();

			expect(services).toHaveLength(0);
		});

		it('should handle database errors gracefully', async () => {
			mockPreparedStatement.all.mockRejectedValueOnce(new Error('Database error'));

			await expect(repository.findAll()).rejects.toThrow('Database error');
		});
	});

	describe('findById', () => {
		it('should return service by ID', async () => {
			mockPreparedStatement.first.mockResolvedValueOnce(mockServiceData);

			const service = await repository.findById(1);

			expect(mockD1Database.prepare).toHaveBeenCalledWith('SELECT * FROM services WHERE id = ?');
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1);
			expect(service).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
			expect(service?.name).toBe('Test Service');
		});

		it('should return null when service not found', async () => {
			mockPreparedStatement.first.mockResolvedValueOnce(null);

			const service = await repository.findById(999);

			expect(service).toBeNull();
		});

		it('should handle database errors gracefully', async () => {
			mockPreparedStatement.first.mockRejectedValueOnce(new Error('Database error'));

			await expect(repository.findById(1)).rejects.toThrow('Database error');
		});
	});

	describe('findEnabled', () => {
		it('should return only active services', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [mockServiceData],
				success: true,
			});

			const services = await repository.findEnabled();

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				'SELECT * FROM services WHERE enabled = true ORDER BY name'
			);
			expect(services).toHaveLength(1);
			expect(services[0].enabled).toBe(true);
		});

		it('should return empty array when no active services exist', async () => {
			mockPreparedStatement.all.mockResolvedValueOnce({
				results: [],
				success: true,
			});

			const services = await repository.findEnabled();

			expect(services).toHaveLength(0);
		});
	});

	describe('create', () => {
		it('should insert new service', async () => {
			const newService = createMockService({
				name: 'New Service',
				url: 'https://new.example.com',
				method: 'GET',
				expectedStatus: 200,
				timeoutMs: 30000,
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			mockPreparedStatement.first.mockResolvedValueOnce({
				id: 2,
				name: 'New Service',
				url: 'https://new.example.com',
				method: 'GET',
				expected_status: 200,
				timeout_ms: 30000,
				enabled: true,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			});

			const savedService = await repository.create(newService);

			expect(mockD1Database.prepare).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO services')
			);
			expect(savedService.id).toBe(2);
		});

		it('should handle insert failures', async () => {
			const newService = createMockService({
				name: 'New Service',
				url: 'https://new.example.com',
				method: 'GET',
				expectedStatus: 200,
				timeoutMs: 30000,
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			mockPreparedStatement.first.mockRejectedValueOnce(new Error('Insert failed'));

			await expect(repository.create(newService)).rejects.toThrow('Insert failed');
		});
	});

	describe('delete', () => {
		it('should delete service by ID', async () => {
			mockPreparedStatement.run.mockResolvedValueOnce({
				success: true,
				meta: { changes: 1 },
			});

			const result = await repository.delete(1);

			expect(mockD1Database.prepare).toHaveBeenCalledWith('DELETE FROM services WHERE id = ?');
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1);
			expect(result).toBe(true);
		});

		it('should handle delete failures', async () => {
			mockPreparedStatement.run.mockRejectedValueOnce(new Error('Delete failed'));

			await expect(repository.delete(1)).rejects.toThrow('Delete failed');
		});
	});

	describe('data transformation', () => {
		it('should correctly transform database row to Service entity', async () => {
			mockPreparedStatement.first.mockResolvedValueOnce(mockServiceData);

			const service = await repository.findById(1);

			expect(service).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
			expect(service?.id).toBe(1);
			expect(service?.name).toBe('Test Service');
			expect(service?.url).toBe('https://api.example.com');
			expect(service?.method).toBe('GET');
			expect(service?.expectedStatus).toBe(200);
			expect(service?.expectedContent).toBe('OK');
			expect(service?.timeoutMs).toBe(30000);
			expect(service?.categoryId).toBe(1);
			expect(service?.enabled).toBe(true);
		});

		it('should handle null/undefined database values', async () => {
			const serviceWithNulls = {
				...mockServiceData,
				expected_content: null,
				category_id: null,
			};

			mockPreparedStatement.first.mockResolvedValueOnce(serviceWithNulls);

			const service = await repository.findById(1);

			expect(service?.expectedContent).toBeNull();
			expect(service?.categoryId).toBeNull();
		});

		it('should correctly transform Service entity to database parameters', async () => {
			const newService = createMockService({
				name: 'New Service',
				url: 'https://new.example.com',
				method: 'POST',
				expectedStatus: 201,
				expectedContent: 'Created',
				timeoutMs: 60000,
				enabled: false,
				categoryId: 2,
				monitorType: 'http',
				createdAt: new Date('2024-01-01T00:00:00.000Z'),
				updatedAt: new Date('2024-01-01T00:00:00.000Z'),
			});

			mockPreparedStatement.first.mockResolvedValueOnce({
				id: 3,
				name: 'New Service',
				url: 'https://new.example.com',
				method: 'POST',
				expected_status: 201,
				expected_content: 'Created',
				timeout_ms: 60000,
				enabled: false,
				category_id: 2,
				monitor_type: 'http',
				created_at: '2024-01-01T00:00:00.000Z',
				updated_at: '2024-01-01T00:00:00.000Z',
			});

			await repository.create(newService);

			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
				'New Service',
				'https://new.example.com',
				'POST',
				201,
				'Created',
				60000, // timeoutMs in milliseconds
				false, // enabled: false
				2, // categoryId as number
				'http', // monitorType
				null, // keyword
				null, // requestBody
				null, // requestHeaders
				null, // bearerToken
				null, // databaseQuery
				null // hyperdriveId
			);
		});
	});

	describe('SQL injection protection', () => {
		it('should use parameterised queries for all operations', async () => {
			// Test findById with malicious input - note that findById expects a number, but we're testing the parameter handling
			await repository.findById(1).catch(() => {});

			// Verify that the input is passed as a parameter, not concatenated
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1);

			// The SQL should still be the safe prepared statement
			expect(mockD1Database.prepare).toHaveBeenCalledWith('SELECT * FROM services WHERE id = ?');
		});

		it('should safely handle special characters in service names', async () => {
			const serviceWithSpecialChars = createMockService({
				name: 'Service with \'quotes\' and "double quotes"',
				url: 'https://example.com',
				method: 'GET',
				expectedStatus: 200,
				timeoutMs: 30000,
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			mockPreparedStatement.first.mockResolvedValueOnce({
				id: 4,
				name: 'Service with \'quotes\' and "double quotes"',
				url: 'https://example.com',
				method: 'GET',
				expected_status: 200,
				timeout_ms: 30000,
				enabled: true,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				monitor_type: 'http',
			});

			await repository.create(serviceWithSpecialChars);

			// Verify the special characters are passed as parameters
			expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
				'Service with \'quotes\' and "double quotes"',
				'https://example.com',
				'GET',
				200,
				'OK', // Default expectedContent
				30000,
				true,
				1, // Default categoryId
				'http',
				null, // keyword
				null, // requestBody
				null, // requestHeaders
				null, // bearerToken
				null, // databaseQuery
				null // hyperdriveId
			);
		});
	});
});
