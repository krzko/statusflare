import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../entities/Category';

export interface CategoryRepository {
	findAll(): Promise<Category[]>;
	findById(id: number): Promise<Category | null>;
	findByName(name: string): Promise<Category | null>;
	findEnabled(): Promise<Category[]>;
	create(category: CreateCategoryRequest): Promise<Category>;
	update(id: number, category: UpdateCategoryRequest): Promise<Category | null>;
	delete(id: number): Promise<boolean>;
}
