# Statusflare

A lightweight, serverless status monitoring service built on Cloudflare Workers, D1, and R2. Inspired by StatusPage but designed for simplicity and cost-effectiveness.

<!-- Schreenshot of Statusflare -->
<img src="https://user-images.githubusercontent.com/101152/279966662-5c29c25f-3606-4226-912b-6b9b9b9b9b9b.png" alt="Statusflare Screenshot">

## Overview

Statusflare automatically monitors your services using multiple monitor types and displays their availability on a beautiful status page. It runs entirely on Cloudflare's edge infrastructure with scheduled health checks and static page generation.

## Key Features

- 🚀 **Serverless**: Built on Cloudflare Workers with zero server management
- 📊 **Real-time Monitoring**: Multiple monitor types with checks every minute
- 💾 **Persistent Storage**: Uses Cloudflare D1 for configuration and time series data
- ⚡ **Fast Loading**: Static pages cached on Cloudflare R2
- 🔧 **Easy Management**: Web-based admin panel for service configuration
- 📈 **Historical Data**: Track uptime percentages and response times with visual latency bars
- 🚨 **Incident Management**: Create and manage incidents with timeline updates
- 🏷️ **Service Categories**: Organise services into logical groups
- 📋 **Dynamic Status**: Page title and favicon change based on overall system status
- 🎯 **SLO Monitoring**: Define and monitor Service Level Objectives with automated burn rate detection
- 📢 **Smart Notifications**: Webhook-based alerts for SLO violations and incident updates
- 📡 **RSS Feeds**: Subscribe to incident updates via RSS/Atom feeds
- 📊 **API Endpoints**: RESTful API for programmatic access

## Prerequisites

- Node.js 18+
- `pnpm`
- Cloudflare account with Workers enabled
- Cloudflare account with D1 enabled
- Cloudflare account with R2 enabled
- Cloudflare account with Hyperdrive enabled, if you plan to monitor databases

## Quick Start

1. **Clone and Install**

   ```bash
   git clone https://github.com/krzko/statusflare.git
   cd statusflare
   pnpm install
   ```

2. **Set Up Cloudflare Resources**

   ```bash
   # Create D1 database
   pnpm dlx wrangler d1 create statusflare-db

   # Create R2 bucket
   pnpm dlx wrangler r2 bucket create statusflare-pages
   ```

3. **Configure Database**

   ```bash
   # Update wrangler.jsonc with your database ID
   # Apply schema (for new deployments)
   pnpm dlx wrangler d1 execute statusflare-db --remote --file=db/schema-v4.sql

   # For existing installations, run migration for monitor types support
   pnpm dlx wrangler d1 execute statusflare-db --remote --file=db/migrate-v4-to-v5.sql
   ```

4. **Create Admin Secret**

   ```bash
   pnpm dlx wrangler secret put STATUSFLARE_ADMIN_PASSWORD
   ```

5. **Deploy**

   ```bash
   pnpm run deploy
   ```

6. **Access Your Status Page**
   - Public status page: `https://your-worker.your-subdomain.workers.dev/`
   - Admin panel: `https://your-worker.your-subdomain.workers.dev/admin`

## Technologies

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (Object Storage)
- **Language**: TypeScript
- **Testing**: Vitest
- **Deployment**: Wrangler CLI

## Configuration

### Service Configuration

Services are configured through the admin UI with the following options:

#### Monitor Types

Choose from four monitor types to suit your monitoring needs:

- **HTTP/HTTPS Monitor**: Checks your URLs for specific HTTP status codes (default: 200 for success)
- **Keyword Monitor**: Searches for a specified keyword or phrase in the page response (case-insensitive lookup)
- **API Monitor**: Monitors APIs with support for request bodies, custom headers, and Bearer token authentication (expects 2xx status codes)
- **Database Monitor**: Monitors PostgreSQL and MySQL databases by executing SQL queries and checking connection health (requires Hyperdrive configuration)

#### Configuration Options

- **Name**: Display name for the service
- **URL**: Endpoint to monitor
- **Monitor Type**: HTTP/HTTPS, Keyword, or API monitoring
- **Method**: HTTP method (GET, POST, HEAD, PUT, DELETE)
- **Expected Status**: HTTP status code to expect (HTTP monitor only)
- **Keyword**: Specific keyword to search for (Keyword monitor only)
- **Request Body**: JSON body for API requests (API monitor only)
- **Request Headers**: Custom headers as JSON (API monitor only)
- **Bearer Token**: Authentication token (API monitor only)
- **Hyperdrive ID**: Hyperdrive configuration ID for database monitoring (Database monitor only)
- **Database Query**: SQL query to execute for health check (Database monitor only)
- **Expected Content**: Optional content to verify in response (HTTP monitor legacy support)
- **Timeout**: Request timeout in milliseconds
- **Category**: Logical grouping for services
- **Enabled**: Whether monitoring is active

### Page Configuration

Customise your status page through the admin interface:

- **Page Title**: Custom name for your status page
- **Banner Message**: Custom status banner (e.g., "All Systems Operational")

## API Access

The service provides a comprehensive RESTful API for programmatic access to all features including services, SLOs, notifications, incidents, and monitoring configurations.

**Key API Features:**
- Complete CRUD operations for all resources
- SLO monitoring and metrics endpoints
- Webhook notification management
- Real-time status check data access
- RSS feeds for incident updates

For complete API documentation, request/response examples, and integration guides, see the [API Reference](./docs/api.md).

## Monitoring

The service automatically:

- Performs health checks every minute via cron triggers for all monitor types
- Records response times and status codes
- Validates HTTP status codes, searches for keywords, or checks API responses based on monitor type
- Calculates uptime percentages for individual services and categories
- Generates visual latency bars showing 24-hour performance history
- Updates page title and favicon based on overall system status
- Generates and caches status pages on R2
- Stores historical data for trend analysis
- Preserves critical status changes (outages/degradation) in history sampling

### Cloudflare Free Plan Limitations

When using the Cloudflare Workers free plan, be aware of **Wall Time** limitations:

- **Wall Time**: The total execution time from start to end of a Worker invocation, including `ctx.waitUntil`
- **Free Plan Limit**: 5 seconds of wall time per invocation
- **Practical Impact**: You can monitor approximately **4-5 services maximum** before hitting this limit
- **Depends on**: Individual check duration (HTTP request timeout + processing time)

If you need to monitor more services, consider:

- Upgrading to Cloudflare Workers Paid plan for higher wall time limits
- Reducing individual service timeout values to fit more checks within 5 seconds
- Splitting services across multiple Workers for distributed monitoring

Learn more about [Cloudflare Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/).

## Documentation

For detailed documentation, see the [docs](./docs) folder:

- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Database Monitoring Guide (PostgreSQL & MySQL)](./docs/postgresql-monitoring.md)
- [SLO Monitoring Guide](./docs/slo-monitoring.md)

## Development

```bash
# Start local development
pnpm run dev

# Run tests
pnpm run test

# Type checking
pnpm run cf-typegen
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Add tests for new functionality
5. Submit a pull request
