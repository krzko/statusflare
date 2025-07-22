export interface PageConfig {
	id: number;
	title: string;
	description: string;
	updatedAt: Date;
}

export interface UpdatePageConfigRequest {
	title?: string;
	description?: string;
}
