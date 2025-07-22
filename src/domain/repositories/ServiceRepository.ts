import { Service, CreateServiceRequest, UpdateServiceRequest } from '../entities/Service';

export interface ServiceRepository {
	findAll(): Promise<Service[]>;
	findById(id: number): Promise<Service | null>;
	findByName(name: string): Promise<Service | null>;
	findEnabled(): Promise<Service[]>;
	create(service: CreateServiceRequest): Promise<Service>;
	update(id: number, service: UpdateServiceRequest): Promise<Service | null>;
	delete(id: number): Promise<boolean>;
}
