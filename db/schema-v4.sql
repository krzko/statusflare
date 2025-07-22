-- Statusflare Database Schema - Final Version
-- This schema creates all tables from scratch for new deployments
-- For existing deployments, run migrate-category-column.sql separately if needed

-- Categories table for grouping services
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Services table with category support and monitor types
-- Note: If upgrading existing installation, use migrate-monitor-types.sql for schema updates
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    method TEXT DEFAULT 'GET',
    expected_status INTEGER DEFAULT 200,
    expected_content TEXT,
    timeout_ms INTEGER DEFAULT 5000,
    enabled BOOLEAN DEFAULT true,
    category_id INTEGER REFERENCES categories(id),
    monitor_type TEXT DEFAULT 'http' CHECK (monitor_type IN ('http', 'keyword', 'api', 'database')),
    keyword TEXT, -- For keyword monitoring
    request_body TEXT, -- For API monitoring (JSON body)
    request_headers TEXT, -- For API monitoring (JSON headers)
    bearer_token TEXT, -- For API authentication
    database_query TEXT, -- For database monitoring (PostgreSQL/MySQL)
    hyperdrive_id TEXT, -- For database monitoring via Hyperdrive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Status checks table for monitoring history
CREATE TABLE IF NOT EXISTS status_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'up', 'down', 'degraded'
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Page configuration
CREATE TABLE IF NOT EXISTS page_config (
    id INTEGER PRIMARY KEY,
    title TEXT DEFAULT 'Status Dashboard',
    description TEXT DEFAULT 'Service status monitoring',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Incidents table for tracking outages and maintenance
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'identified', -- identified, investigating, update, resolved
    severity TEXT NOT NULL DEFAULT 'minor', -- minor, major, critical
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Incident updates table for timeline
CREATE TABLE IF NOT EXISTS incident_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Incident affected services (for future use)
CREATE TABLE IF NOT EXISTS incident_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE(incident_id, service_id)
);

-- System status configuration
CREATE TABLE IF NOT EXISTS system_status (
    id INTEGER PRIMARY KEY,
    overall_status TEXT DEFAULT 'operational', -- operational, degraded, major_outage
    banner_message TEXT DEFAULT 'All Systems Operational',
    auto_banner BOOLEAN DEFAULT true, -- Automatically calculate banner from service status
    manual_banner_message TEXT, -- Custom banner message when auto_banner is false
    manual_banner_status TEXT DEFAULT 'operational', -- Custom banner status when auto_banner is false
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_monitor_type ON services(monitor_type);
CREATE INDEX IF NOT EXISTS idx_status_checks_service ON status_checks(service_id);
CREATE INDEX IF NOT EXISTS idx_status_checks_checked_at ON status_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_checks_service_time ON status_checks(service_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_updates_created ON incident_updates(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_slos_service ON slos(service_id);
CREATE INDEX IF NOT EXISTS idx_slos_service_enabled ON slos(service_id, enabled);
CREATE INDEX IF NOT EXISTS idx_slo_burn_events_slo ON slo_burn_events(slo_id);
CREATE INDEX IF NOT EXISTS idx_slo_burn_events_triggered ON slo_burn_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_slo_burn_events_unresolved ON slo_burn_events(slo_id, resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_channels_enabled ON notification_channels(enabled);
CREATE INDEX IF NOT EXISTS idx_slo_notifications_slo ON slo_notifications(slo_id);
CREATE INDEX IF NOT EXISTS idx_slo_notifications_channel ON slo_notifications(notification_channel_id);
CREATE INDEX IF NOT EXISTS idx_slo_notifications_enabled ON slo_notifications(slo_id, enabled);

-- SLO Configuration table for Service Level Objectives
CREATE TABLE IF NOT EXISTS slos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g., "API Availability", "Response Time"
    sli_type TEXT NOT NULL CHECK (sli_type IN ('availability', 'latency')),
    target_percentage REAL NOT NULL, -- 99.0 for 99%
    latency_threshold_ms INTEGER, -- Only for latency SLIs
    time_window_days INTEGER DEFAULT 28,
    enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- SLO Burn Rate Events for tracking fast burn incidents
CREATE TABLE IF NOT EXISTS slo_burn_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slo_id INTEGER NOT NULL,
    burn_rate REAL NOT NULL,
    error_budget_consumed_percentage REAL NOT NULL,
    time_to_exhaustion_hours REAL,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (slo_id) REFERENCES slos(id) ON DELETE CASCADE
);

-- Notification Channels for webhook, email, SMS alerts
CREATE TABLE IF NOT EXISTS notification_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'email', 'sms')),
    config TEXT NOT NULL, -- JSON config (webhook URL, headers, etc.)
    enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SLO Notification Rules linking SLOs to notification channels
CREATE TABLE IF NOT EXISTS slo_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slo_id INTEGER NOT NULL,
    notification_channel_id INTEGER NOT NULL,
    burn_rate_threshold REAL DEFAULT 14.4, -- Fast burn threshold
    enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (slo_id) REFERENCES slos(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- Insert default data (INSERT OR IGNORE prevents duplicates)
INSERT OR IGNORE INTO categories (id, name, description, display_order) VALUES 
(1, 'Services', 'Core application services', 1),
(2, 'Partners', 'Third-party integrations', 2);

INSERT OR IGNORE INTO page_config (id, title, description) 
VALUES (1, '🔥 Statusflare', '');

INSERT OR IGNORE INTO system_status (id, overall_status, banner_message, auto_banner, manual_banner_status) 
VALUES (1, 'operational', 'All Systems Operational', true, 'operational');
