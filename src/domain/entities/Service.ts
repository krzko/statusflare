export interface Service {
	id: number;
	name: string;
	url: string;
	method: string;
	expectedStatus: number;
	expectedContent?: string;
	timeoutMs: number;
	enabled: boolean;
	categoryId?: number;
	monitorType: 'http' | 'keyword' | 'api' | 'database';
	keyword?: string; // For keyword monitoring
	requestBody?: string; // For API monitoring (JSON body)
	requestHeaders?: string; // For API monitoring (JSON headers)
	bearerToken?: string; // For API authentication
	databaseQuery?: string; // For database monitoring (PostgreSQL/MySQL)
	hyperdriveId?: string; // For database monitoring via Hyperdrive
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateServiceRequest {
	name: string;
	url: string;
	method?: string;
	expectedStatus?: number;
	expectedContent?: string;
	timeoutMs?: number;
	enabled?: boolean;
	categoryId?: number;
	monitorType?: 'http' | 'keyword' | 'api' | 'database';
	keyword?: string;
	requestBody?: string;
	requestHeaders?: string;
	bearerToken?: string;
	databaseQuery?: string;
	hyperdriveId?: string;
}

export interface UpdateServiceRequest {
	name?: string;
	url?: string;
	method?: string;
	expectedStatus?: number;
	expectedContent?: string;
	timeoutMs?: number;
	enabled?: boolean;
	categoryId?: number;
	monitorType?: 'http' | 'keyword' | 'api' | 'database';
	keyword?: string;
	requestBody?: string;
	requestHeaders?: string;
	bearerToken?: string;
	databaseQuery?: string;
	hyperdriveId?: string;
}
