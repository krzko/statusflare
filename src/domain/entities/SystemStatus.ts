export type OverallStatus = 'operational' | 'degraded' | 'major_outage';

export interface SystemStatus {
	id: number;
	overallStatus: OverallStatus;
	bannerMessage: string;
	autoBanner: boolean;
	manualBannerMessage?: string;
	manualBannerStatus: OverallStatus;
	updatedAt: Date;
}

export interface UpdateSystemStatusRequest {
	overallStatus?: OverallStatus;
	bannerMessage?: string;
	autoBanner?: boolean;
	manualBannerMessage?: string;
	manualBannerStatus?: OverallStatus;
}
