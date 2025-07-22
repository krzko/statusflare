import { SLO, SLOBurnEvent, NotificationChannel, SLONotification } from '../entities/SLO';

export interface SLORepository {
	// SLO Management
	createSLO(slo: Omit<SLO, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>;
	updateSLO(id: number, slo: Partial<SLO>): Promise<void>;
	deleteSLO(id: number): Promise<void>;
	getSLOById(id: number): Promise<SLO | null>;
	getSLOsByServiceId(serviceId: number): Promise<SLO[]>;
	getAllSLOs(): Promise<SLO[]>;
	getEnabledSLOs(): Promise<SLO[]>;

	// SLO Burn Event Management
	createBurnEvent(burnEvent: Omit<SLOBurnEvent, 'id' | 'triggeredAt'>): Promise<number>;
	updateBurnEvent(id: number, burnEvent: Partial<SLOBurnEvent>): Promise<void>;
	getBurnEventById(id: number): Promise<SLOBurnEvent | null>;
	getBurnEventsBySLOId(sloId: number, limit?: number): Promise<SLOBurnEvent[]>;
	getUnresolvedBurnEvents(): Promise<SLOBurnEvent[]>;
	getUnresolvedBurnEventBySLOId(sloId: number): Promise<SLOBurnEvent | null>;

	// Notification Channel Management
	createNotificationChannel(
		channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<number>;
	updateNotificationChannel(id: number, channel: Partial<NotificationChannel>): Promise<void>;
	deleteNotificationChannel(id: number): Promise<void>;
	getNotificationChannelById(id: number): Promise<NotificationChannel | null>;
	getAllNotificationChannels(): Promise<NotificationChannel[]>;
	getEnabledNotificationChannels(): Promise<NotificationChannel[]>;

	// SLO Notification Rules Management
	createSLONotification(
		sloNotification: Omit<SLONotification, 'id' | 'createdAt'>
	): Promise<number>;
	updateSLONotification(id: number, sloNotification: Partial<SLONotification>): Promise<void>;
	deleteSLONotification(id: number): Promise<void>;
	getSLONotificationById(id: number): Promise<SLONotification | null>;
	getSLONotificationsBySLOId(sloId: number): Promise<SLONotification[]>;
	getAllSLONotifications(): Promise<SLONotification[]>;
	getEnabledSLONotificationsBySLOId(sloId: number): Promise<SLONotification[]>;
}
