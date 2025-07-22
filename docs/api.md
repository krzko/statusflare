# API Reference

## Overview

Statusflare provides a comprehensive RESTful API for managing services, SLOs, notifications, incidents, and all monitoring configurations. All endpoints return JSON responses unless otherwise specified.

## Base URL

```
https://your-worker.your-subdomain.workers.dev
```

## Authentication

All API endpoints require authentication for security:

**Authentication Methods:**

- Header: `X-API-Key: your-admin-password`
- Header: `Authorization: Bearer your-admin-password`

## Endpoints

### Categories

Manage service categories for logical grouping of services.

#### GET /api/categories

List all service categories.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Core Services",
    "description": "Essential system components",
    "displayOrder": 1,
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/categories

Create a new category.

**Request Body:**
```json
{
  "name": "Core Services",
  "description": "Essential system components",
  "displayOrder": 1,
  "enabled": true
}
```

#### PUT /api/categories/:id

Update an existing category.

#### DELETE /api/categories/:id

Delete a category.

### Services

Manage monitored services with various monitor types.

#### GET /api/services

List all services.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Website",
    "url": "https://example.com",
    "monitorType": "http",
    "method": "GET",
    "expectedStatus": 200,
    "expectedContent": null,
    "keyword": null,
    "requestBody": null,
    "requestHeaders": null,
    "bearerToken": null,
    "hyperdriveId": null,
    "postgresqlQuery": null,
    "timeoutMs": 5000,
    "categoryId": 1,
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/services

Create a new service with monitor configuration.

**Request Body Examples:**

**HTTP/HTTPS Monitor:**
```json
{
  "name": "Website",
  "url": "https://example.com",
  "monitorType": "http",
  "expectedStatus": 200,
  "timeoutMs": 5000,
  "categoryId": 1,
  "enabled": true
}
```

**Keyword Monitor:**
```json
{
  "name": "Landing Page",
  "url": "https://example.com",
  "monitorType": "keyword",
  "keyword": "Welcome",
  "timeoutMs": 5000,
  "enabled": true
}
```

**API Monitor:**
```json
{
  "name": "API Health",
  "url": "https://api.example.com/health",
  "monitorType": "api",
  "method": "POST",
  "requestBody": "{\"check\":\"health\"}",
  "requestHeaders": "{\"Custom-Header\":\"value\"}",
  "bearerToken": "your-api-token",
  "timeoutMs": 10000,
  "enabled": true
}
```

**Database Monitor:**
```json
{
  "name": "Database",
  "monitorType": "postgresql",
  "hyperdriveId": "b5f27764f6f74e1a9d72089b2445e21d",
  "postgresqlQuery": "SELECT 1",
  "timeoutMs": 5000,
  "enabled": true
}
```

#### PUT /api/services/:id

Update an existing service.

#### DELETE /api/services/:id

Delete a service and all associated data.

### Incidents

Manage incident tracking and status updates.

#### GET /api/incidents

List all incidents.

**Response:**
```json
[
  {
    "id": 1,
    "title": "API Performance Issues",
    "description": "Experiencing elevated response times",
    "status": "investigating",
    "impact": "minor",
    "affectedServices": "[1,2]",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "resolvedAt": null
  }
]
```

#### POST /api/incidents

Create a new incident.

**Request Body:**
```json
{
  "title": "API Performance Issues",
  "description": "Experiencing elevated response times",
  "status": "investigating",
  "impact": "minor",
  "affectedServices": "[1,2]"
}
```

#### PUT /api/incidents/:id

Update an incident.

#### DELETE /api/incidents/:id

Delete an incident.

#### POST /api/incidents/:id/updates

Add an update to an incident.

### SLOs

Manage Service Level Objectives and monitoring.

#### GET /api/slos

List all SLOs.

**Query Parameters:**
- `service_id` (optional): Filter SLOs for a specific service

**Response:**
```json
[
  {
    "id": 1,
    "serviceId": 1,
    "name": "API Availability",
    "sliType": "availability",
    "targetPercentage": 99.9,
    "timeWindowDays": 30,
    "latencyThresholdMs": 500,
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/slos

Create a new SLO.

**Request Body:**
```json
{
  "serviceId": 1,
  "name": "API Availability",
  "sliType": "availability",
  "targetPercentage": 99.9,
  "timeWindowDays": 30,
  "latencyThresholdMs": 500,
  "enabled": true
}
```

**SLI Types:**
- `availability`: Tracks uptime percentage
- `latency`: Tracks response time thresholds

#### PUT /api/slos/:id

Update an existing SLO.

#### DELETE /api/slos/:id

Delete an SLO.

#### GET /api/slo-metrics

Get calculated SLO metrics and burn rate.

**Query Parameters:**
- `slo_id` (required): SLO ID to get metrics for

**Response:**
```json
{
  "sloId": 1,
  "currentSLI": 99.8,
  "burnRate": 2.5,
  "errorBudgetConsumed": 45.2,
  "isFastBurn": false,
  "timeWindowStart": "2024-01-01T00:00:00.000Z",
  "timeWindowEnd": "2024-01-31T00:00:00.000Z"
}
```

### Notification Channels

Manage webhook notification channels.

#### GET /api/notification-channels

List all notification channels.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Slack Alerts",
    "type": "webhook",
    "config": "{\"url\":\"https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK\",\"format\":\"slack\"}",
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/notification-channels

Create a new notification channel.

**Request Body:**
```json
{
  "name": "Slack Alerts",
  "type": "webhook",
  "config": "{\"url\":\"https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK\",\"format\":\"slack\",\"headers\":{\"Authorization\":\"Bearer token\"}}",
  "enabled": true
}
```

**Channel Types:**
- `webhook`: HTTP webhook notifications
- `email`: Email notifications (future)
- `sms`: SMS notifications (future)

#### PUT /api/notification-channels/:id

Update a notification channel.

#### DELETE /api/notification-channels/:id

Delete a notification channel.

### SLO Notifications

Manage SLO notification rules and burn rate alerts.

#### GET /api/slo-notifications

List all SLO notification rules.

**Query Parameters:**
- `slo_id` (optional): Filter notification rules for a specific SLO

**Response:**
```json
[
  {
    "id": 1,
    "sloId": 1,
    "notificationChannelId": 1,
    "burnRateThreshold": 10,
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/slo-notifications

Create a new SLO notification rule.

**Request Body:**
```json
{
  "sloId": 1,
  "notificationChannelId": 1,
  "burnRateThreshold": 10,
  "enabled": true
}
```

#### PUT /api/slo-notifications/:id

Update an SLO notification rule.

#### DELETE /api/slo-notifications/:id

Delete an SLO notification rule.

### Page Configuration

Manage status page settings.

#### GET /api/page-config

Get page configuration.

**Response:**
```json
{
  "title": "System Status",
  "description": "Current status of all services",
  "logoUrl": null,
  "customCss": null,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### PUT /api/page-config

Update page configuration.

**Request Body:**
```json
{
  "title": "System Status",
  "description": "Current status of all services",
  "logoUrl": "https://example.com/logo.png",
  "customCss": "body { font-family: 'Custom Font'; }"
}
```

### Status Checks

Access historical status check data.

#### GET /api/status-checks/:serviceId

Get status check history for a service.

**Response:**
```json
[
  {
    "id": 1,
    "serviceId": 1,
    "status": "up",
    "responseTimeMs": 245,
    "statusCode": 200,
    "errorMessage": null,
    "checkedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Admin Operations

Administrative and utility endpoints.

#### POST /api/trigger-checks

Manually trigger status checks for all enabled services.

**Response:**
```json
{
  "message": "Status checks triggered"
}
```

#### POST /api/test-webhook

Test webhook notification delivery.

**Request Body:**
```json
{
  "notificationChannelId": 1,
  "testMessage": "This is a test notification"
}
```

### RSS Feeds

Public RSS feeds for incident updates.

#### GET /rss

RSS 2.0 feed of incident updates.

**Response:**
- Content-Type: `application/rss+xml`

#### GET /feed

Alternative RSS endpoint.

#### GET /rss.xml

RSS feed with .xml extension.

**RSS Feed Features:**
- Latest 50 incidents with full timeline
- Proper RSS 2.0 standard compliance
- Auto-discovery links in HTML head
- 15-minute TTL for feed readers
- Categories and Dublin Core metadata
- Incident status progression tracking

## Webhook Notifications

### Payload Format

SLO burn rate alerts are sent as HTTP POST requests to configured webhook URLs.

**Example Payload:**
```json
{
  "alertType": "slo_burn_rate_alert",
  "slo": {
    "id": 1,
    "name": "API Availability",
    "serviceName": "Main API",
    "targetPercentage": 99.9,
    "timeWindowDays": 30
  },
  "metrics": {
    "currentSLI": 98.5,
    "burnRate": 15.2,
    "errorBudgetConsumed": 85.3,
    "isFastBurn": true
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "dashboardUrl": "https://your-status.workers.dev/admin"
}
```

### Slack Integration

For Slack notifications, webhooks are formatted according to Slack's incoming webhook format:

```json
{
  "text": "SLO Alert: API Availability",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        {
          "title": "Current SLI",
          "value": "98.5%",
          "short": true
        },
        {
          "title": "Burn Rate",
          "value": "15.2x",
          "short": true
        }
      ]
    }
  ]
}
```

## Example API Usage

### Basic Operations

```bash
# List all services
curl -H "X-API-Key: your-admin-password" \
     https://your-worker.your-subdomain.workers.dev/api/services

# Create HTTP/HTTPS monitor
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"Website","url":"https://example.com","monitorType":"http","expectedStatus":200}' \
     https://your-worker.your-subdomain.workers.dev/api/services

# Create keyword monitor
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"Landing Page","url":"https://example.com","monitorType":"keyword","keyword":"Welcome"}' \
     https://your-worker.your-subdomain.workers.dev/api/services

# Create API monitor with authentication
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"API Health","url":"https://api.example.com/health","monitorType":"api","method":"POST","requestBody":"{\"check\":\"health\"}","bearerToken":"your-api-token"}' \
     https://your-worker.your-subdomain.workers.dev/api/services

# Create database monitor (requires Hyperdrive setup)
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"Database","monitorType":"postgresql","hyperdriveId":"b5f27764f6f74e1a9d72089b2445e21d","postgresqlQuery":"SELECT 1"}' \
     https://your-worker.your-subdomain.workers.dev/api/services
```

### SLO and Notification Setup

```bash
# Create SLO for availability monitoring
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"serviceId":1,"name":"API Availability","sliType":"availability","targetPercentage":99.9,"timeWindowDays":30,"enabled":true}' \
     https://your-worker.your-subdomain.workers.dev/api/slos

# Create webhook notification channel
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"Slack Alerts","type":"webhook","config":"{\"url\":\"https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK\",\"format\":\"slack\"}","enabled":true}' \
     https://your-worker.your-subdomain.workers.dev/api/notification-channels

# Create SLO notification rule
curl -H "X-API-Key: your-admin-password" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"sloId":1,"notificationChannelId":1,"burnRateThreshold":10,"enabled":true}' \
     https://your-worker.your-subdomain.workers.dev/api/slo-notifications

# Get SLO metrics and burn rate
curl -H "X-API-Key: your-admin-password" \
     https://your-worker.your-subdomain.workers.dev/api/slo-metrics?slo_id=1
```

## Error Responses

All API endpoints return error responses in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Error Status Codes

- `400 Bad Request` - Invalid request data or parameters
- `401 Unauthorized` - Missing or invalid authentication
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - HTTP method not supported for endpoint
- `409 Conflict` - Resource already exists (e.g., duplicate service name)
- `500 Internal Server Error` - Unexpected server error

## Rate Limiting

Currently, no rate limiting is implemented. For production deployments, consider implementing rate limiting based on your usage requirements and Cloudflare Workers limits.

## Data Types

### Service Object

```typescript
interface Service {
  id: number;
  name: string;
  url: string;
  monitorType: 'http' | 'keyword' | 'api' | 'postgresql' | 'mysql';
  method: string;
  expectedStatus: number;
  expectedContent?: string;
  keyword?: string;
  requestBody?: string;
  requestHeaders?: string;
  bearerToken?: string;
  hyperdriveId?: string;
  postgresqlQuery?: string;
  timeoutMs: number;
  categoryId?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### SLO Object

```typescript
interface SLO {
  id: number;
  serviceId: number;
  name: string;
  sliType: 'availability' | 'latency';
  targetPercentage: number;
  timeWindowDays: number;
  latencyThresholdMs?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Status Check Object

```typescript
interface StatusCheck {
  id: number;
  serviceId: number;
  status: 'up' | 'down' | 'degraded';
  responseTimeMs?: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: Date;
}
```

### Notification Channel Object

```typescript
interface NotificationChannel {
  id: number;
  name: string;
  type: 'webhook' | 'email' | 'sms';
  config: string; // JSON configuration
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## SDK Usage

While no official SDK is provided, you can easily integrate with the API using standard HTTP clients:

### JavaScript/TypeScript

```javascript
const apiBase = 'https://your-worker.your-subdomain.workers.dev';
const apiKey = 'your-admin-password';

const headers = {
  'X-API-Key': apiKey,
  'Content-Type': 'application/json'
};

// Get all services
const response = await fetch(`${apiBase}/api/services`, { headers });
const services = await response.json();

// Create a service
const newService = await fetch(`${apiBase}/api/services`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'My API',
    url: 'https://myapi.example.com/health',
    monitorType: 'http',
    expectedStatus: 200
  }),
});

// Create an SLO
const newSLO = await fetch(`${apiBase}/api/slos`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    serviceId: 1,
    name: 'API Availability',
    sliType: 'availability',
    targetPercentage: 99.9,
    timeWindowDays: 30,
    enabled: true
  }),
});
```

### Python

```python
import requests

api_base = 'https://your-worker.your-subdomain.workers.dev'
api_key = 'your-admin-password'

headers = {
    'X-API-Key': api_key,
    'Content-Type': 'application/json'
}

# Get all services
response = requests.get(f'{api_base}/api/services', headers=headers)
services = response.json()

# Create a service
new_service = requests.post(f'{api_base}/api/services', headers=headers, json={
    'name': 'My API',
    'url': 'https://myapi.example.com/health',
    'monitorType': 'http',
    'expectedStatus': 200
})
```