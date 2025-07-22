export interface Category {
	id: number;
	name: string;
	description?: string;
	displayOrder: number;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateCategoryRequest {
	name: string;
	description?: string;
	displayOrder?: number;
	enabled?: boolean;
}

export interface UpdateCategoryRequest {
	name?: string;
	description?: string;
	displayOrder?: number;
	enabled?: boolean;
}
