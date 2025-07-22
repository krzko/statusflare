export interface SLO {
	id?: number;
	serviceId: number;
	name: string;
	sliType: 'availability' | 'latency';
	targetPercentage: number; // 99.0 for 99%
	latencyThresholdMs?: number; // Only for latency SLIs
	timeWindowDays: number;
	enabled: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface SLOBurnEvent {
	id?: number;
	sloId: number;
	burnRate: number;
	errorBudgetConsumedPercentage: number;
	timeToExhaustionHours?: number;
	triggeredAt?: string;
	resolvedAt?: string;
}

export interface NotificationChannel {
	id?: number;
	name: string;
	type: 'webhook' | 'email' | 'sms';
	config: string; // JSON string with configuration
	enabled: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface SLONotification {
	id?: number;
	sloId: number;
	notificationChannelId: number;
	burnRateThreshold: number; // Default 14.4 for fast burn
	enabled: boolean;
	createdAt?: string;
}

// Configuration types for notification channels
export interface WebhookConfig {
	url: string;
	format: 'slack' | 'discord' | 'custom';
	headers: Record<string, string>;
}

export interface EmailConfig {
	to: string[];
	from: string;
	smtpHost: string;
	smtpPort: number;
	username: string;
	password: string;
}

export interface SMSConfig {
	provider: 'twilio' | 'aws_sns';
	to: string[];
	apiKey: string;
	apiSecret: string;
}

// SLI calculation result
export interface SLICalculationResult {
	currentSLI: number; // Current SLI percentage
	errorRate: number; // Current error rate
	burnRate: number; // Current burn rate
	errorBudgetConsumed: number; // Percentage of error budget consumed
	timeToExhaustion?: number; // Hours until error budget exhausted
	isFastBurn: boolean; // Whether this is a fast burn scenario
}

// Webhook payload for alerts
export interface SLOAlertPayload {
	event: 'slo_burn_rate_alert' | 'slo_burn_resolved' | 'test_webhook';
	timestamp: string;
	severity: 'critical' | 'warning' | 'info';
	service: {
		id: number;
		name: string;
		url: string;
	};
	slo: {
		id: number;
		name: string;
		type: 'availability' | 'latency';
		target: number;
		timeWindowDays: number;
	};
	alert: {
		burnRate: number;
		errorBudgetConsumed: number;
		timeToExhaustionHours?: number;
		currentSli: number;
	};
	dashboardUrl: string;
	message?: string; // Optional message for test webhooks
}
