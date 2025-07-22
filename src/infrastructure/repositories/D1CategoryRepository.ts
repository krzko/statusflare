import { CategoryRepository } from '../../domain/repositories/CategoryRepository';
import {
	Category,
	CreateCategoryRequest,
	UpdateCategoryRequest,
} from '../../domain/entities/Category';

export class D1CategoryRepository implements CategoryRepository {
	constructor(private db: D1Database) {}

	async findAll(): Promise<Category[]> {
		const result = await this.db
			.prepare('SELECT * FROM categories ORDER BY display_order, name')
			.all<Category>();
		return result.results.map(this.mapToCategory);
	}

	async findById(id: number): Promise<Category | null> {
		const result = await this.db
			.prepare('SELECT * FROM categories WHERE id = ?')
			.bind(id)
			.first<Category>();
		return result ? this.mapToCategory(result) : null;
	}

	async findByName(name: string): Promise<Category | null> {
		const result = await this.db
			.prepare('SELECT * FROM categories WHERE name = ?')
			.bind(name)
			.first<Category>();
		return result ? this.mapToCategory(result) : null;
	}

	async findEnabled(): Promise<Category[]> {
		const result = await this.db
			.prepare('SELECT * FROM categories WHERE enabled = true ORDER BY display_order, name')
			.all<Category>();
		return result.results.map(this.mapToCategory);
	}

	async create(category: CreateCategoryRequest): Promise<Category> {
		const result = await this.db
			.prepare(
				`
				INSERT INTO categories (name, description, display_order, enabled)
				VALUES (?, ?, ?, ?)
				RETURNING *
			`
			)
			.bind(
				category.name,
				category.description || null,
				category.displayOrder || 0,
				category.enabled ?? true
			)
			.first<Category>();

		if (!result) {
			throw new Error('Failed to create category');
		}

		return this.mapToCategory(result);
	}

	async update(id: number, category: UpdateCategoryRequest): Promise<Category | null> {
		const updates: string[] = [];
		const values: any[] = [];

		if (category.name !== undefined) {
			updates.push('name = ?');
			values.push(category.name);
		}
		if (category.description !== undefined) {
			updates.push('description = ?');
			values.push(category.description);
		}
		if (category.displayOrder !== undefined) {
			updates.push('display_order = ?');
			values.push(category.displayOrder);
		}
		if (category.enabled !== undefined) {
			updates.push('enabled = ?');
			values.push(category.enabled);
		}

		if (updates.length === 0) {
			return this.findById(id);
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		const result = await this.db
			.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
			.bind(...values)
			.first<Category>();

		return result ? this.mapToCategory(result) : null;
	}

	async delete(id: number): Promise<boolean> {
		// Check if there are any services associated with this category
		const servicesCheck = await this.db
			.prepare('SELECT COUNT(*) as count FROM services WHERE category_id = ?')
			.bind(id)
			.first<{ count: number }>();

		if (servicesCheck && servicesCheck.count > 0) {
			throw new Error(
				`Cannot delete category: ${servicesCheck.count} service(s) are still associated with this category. Please move or delete the services first.`
			);
		}

		const result = await this.db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
		return (result.meta?.changes || 0) > 0;
	}

	private mapToCategory(row: any): Category {
		return {
			id: row.id,
			name: row.name,
			description: row.description,
			displayOrder: row.display_order,
			enabled: Boolean(row.enabled),
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}
}
