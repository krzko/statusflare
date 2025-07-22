# SLO (Service Level Objective) Monitoring

## Overview

The Statusflare provides comprehensive SLO monitoring capabilities following Google SRE best practices. This system allows you to define, monitor, and alert on service reliability metrics with automated burn rate detection and multi-channel notifications.

## What are SLOs?

Service Level Objectives (SLOs) are reliability targets for your services, typically expressed as a percentage of successful requests over a time period. They help teams balance reliability with feature velocity and provide early warning when services are at risk of missing their reliability targets.

### Key Concepts

- **SLI (Service Level Indicator)**: The actual measurement (e.g., % of successful requests)
- **SLO (Service Level Objective)**: The target threshold (e.g., 99.9% availability)
- **Error Budget**: The allowed failure rate (100% - SLO target)
- **Burn Rate**: How quickly you're consuming your error budget
- **Time Window**: The period over which the SLO is measured

## SLO Types

### 1. Availability SLOs

Measures the percentage of successful requests over total requests.

**Formula**: `(Successful Requests / Total Requests) × 100`

**Example**: 99.9% of HTTP requests should return non-5xx status codes over 28 days.

### 2. Latency SLOs

Measures the percentage of requests that complete within a specified time threshold.

**Formula**: `(Requests Under Threshold / Total Requests) × 100`

**Example**: 95% of HTTP requests should complete within 500ms over 7 days.

## Creating SLOs

### Via Admin Interface

1. Navigate to the **SLOs** tab in the admin interface
2. Click **Create SLO**
3. Fill in the required fields:
   - **SLO Name**: Descriptive name (e.g., "API Availability")
   - **Service**: Select the service to monitor
   - **SLI Type**: Choose Availability or Latency
   - **Target Percentage**: Your reliability target (e.g., 99.0)
   - **Time Window**: Evaluation period in days (1-90)
   - **Latency Threshold**: Required for latency SLOs (in milliseconds)

### Via API

```bash
curl -X POST https://your-worker.workers.dev/api/slos \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": 1,
    "name": "API Availability",
    "sliType": "availability",
    "targetPercentage": 99.0,
    "timeWindowDays": 28,
    "enabled": true
  }'
```

## Burn Rate Detection

### What is Burn Rate?

Burn rate indicates how quickly you're consuming your error budget. A burn rate of:

- **1x**: You'll exhaust your budget exactly at the end of the time window
- **14.4x**: You'll exhaust your 30-day budget in 2 hours (fast burn)
- **36x**: You'll exhaust your 30-day budget in 20 hours

### Fast Burn Alerts

The system automatically detects "fast burn" scenarios where you're consuming error budget at **14.4x** the normal rate, meaning you'll exhaust your 30-day budget in just 2 hours.

**Formula**: `Burn Rate = (Current Error Rate / SLO Error Rate)`

### Alert Thresholds

- **14.4x**: Default fast burn threshold (30-day budget in 2 hours)
- **6x**: Medium burn (30-day budget in 5 days)
- **3x**: Slow burn (30-day budget in 10 days)

## SLO Metrics

### Real-time Calculations

The system provides real-time SLO metrics:

```json
{
	"slo": {
		"id": 1,
		"name": "API Availability",
		"targetPercentage": 99.0,
		"sliType": "availability"
	},
	"calculation": {
		"currentSLI": 98.5,
		"errorRate": 1.5,
		"burnRate": 15.0,
		"errorBudgetConsumed": 85.7,
		"timeToExhaustion": 1.2,
		"isFastBurn": true
	},
	"timeWindow": {
		"days": 28,
		"startTime": "2024-01-01T00:00:00Z",
		"endTime": "2024-01-29T00:00:00Z"
	},
	"checksCount": 40320
}
```

### Metric Definitions

- **currentSLI**: Current service level indicator percentage
- **errorRate**: Current error rate percentage
- **burnRate**: Rate of error budget consumption
- **errorBudgetConsumed**: Percentage of error budget used
- **timeToExhaustion**: Hours until error budget is exhausted
- **isFastBurn**: Whether burn rate exceeds fast burn threshold

## Best Practices

### 1. SLO Target Selection

- **Start Conservative**: Begin with achievable targets (99.0% vs 99.99%)
- **Historical Data**: Use past performance to inform targets
- **Business Impact**: Align targets with user experience requirements

### 2. Time Windows

- **Short Windows (1-7 days)**: Good for rapid feedback and development
- **Long Windows (28-90 days)**: Better for stable services and compliance
- **Multiple Windows**: Consider both short and long-term SLOs

### 3. Error Budget Policy

Define how to respond when error budgets are consumed:

- **50% consumed**: Investigate and review
- **75% consumed**: Focus on reliability over features
- **100% consumed**: Stop feature releases, focus on reliability

### 4. SLO Hierarchy

- **User-Facing Services**: Highest priority SLOs
- **Critical Dependencies**: Important but secondary
- **Internal Tools**: Lower targets acceptable

## Troubleshooting

### Common Issues

1. **No Data for SLO**
   - Ensure the service has status checks configured
   - Verify the service is enabled and running checks
   - Check the time window isn't too short

2. **Incorrect SLI Calculations**
   - Verify status check configuration matches SLO type
   - For latency SLOs, ensure timeout values are appropriate
   - Check for sufficient data points in the time window

3. **False Alerts**
   - Review burn rate thresholds
   - Consider longer time windows for more stable metrics
   - Adjust SLO targets based on actual service capabilities

### Debugging SLO Calculations

Use the **View Metrics** button in the admin interface to see:

- Current SLI values
- Error budget consumption
- Burn rate calculations
- Number of checks analysed
- Time window details

## Integration with Monitoring

### Scheduled Evaluation

SLOs are automatically evaluated every minute as part of the scheduled worker execution:

```typescript
// Runs every minute via cron trigger
await sloMonitoringUseCase.evaluateAllSLOs();
```

### Alert Generation

When burn rate thresholds are exceeded:

1. System calculates current burn rate
2. Compares against configured thresholds
3. Generates alert payload with context
4. Sends notifications via configured channels
5. Logs burn events for historical analysis

### Historical Tracking

The system maintains historical records of:

- SLO burn events with timestamps
- Error budget consumption over time
- Alert notifications sent
- SLO target changes and updates

This enables trend analysis and helps teams understand reliability patterns over time.
