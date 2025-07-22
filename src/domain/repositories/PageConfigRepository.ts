import { PageConfig, UpdatePageConfigRequest } from '../entities/PageConfig';

export interface PageConfigRepository {
	get(): Promise<PageConfig>;
	update(config: UpdatePageConfigRequest): Promise<PageConfig>;
}
