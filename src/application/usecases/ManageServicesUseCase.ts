import { ServiceRepository } from '../../domain/repositories/ServiceRepository';
import { Service, CreateServiceRequest, UpdateServiceRequest } from '../../domain/entities/Service';

export class ManageServicesUseCase {
	constructor(private serviceRepository: ServiceRepository) {}

	async getAllServices(): Promise<Service[]> {
		return this.serviceRepository.findAll();
	}

	async getService(id: number): Promise<Service | null> {
		return this.serviceRepository.findById(id);
	}

	async createService(request: CreateServiceRequest): Promise<Service> {
		// Validate URL format (skip for database monitors as they use Hyperdrive)
		if (request.monitorType !== 'database') {
			try {
				new URL(request.url);
			} catch {
				throw new Error('Invalid URL format');
			}
		}

		// Check for duplicate names
		const existing = await this.serviceRepository.findByName(request.name);
		if (existing) {
			throw new Error('Service with this name already exists');
		}

		return this.serviceRepository.create(request);
	}

	async updateService(id: number, request: UpdateServiceRequest): Promise<Service | null> {
		// Validate URL format if provided (skip for database monitors as they use Hyperdrive)
		if (request.url && request.monitorType !== 'database') {
			try {
				new URL(request.url);
			} catch {
				throw new Error('Invalid URL format');
			}
		}

		// Check for duplicate names if name is being changed
		if (request.name) {
			const existing = await this.serviceRepository.findByName(request.name);
			if (existing && existing.id !== id) {
				throw new Error('Service with this name already exists');
			}
		}

		return this.serviceRepository.update(id, request);
	}

	async deleteService(id: number): Promise<boolean> {
		return this.serviceRepository.delete(id);
	}
}
