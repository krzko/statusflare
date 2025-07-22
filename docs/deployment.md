# Deployment Guide

## Prerequisites

Before deploying the Statusflare, ensure you have:

- Node.js 18+ installed
- A Cloudflare account with Workers enabled
- Wrangler CLI installed globally: `ppnpm install -g wrangler`
- Authenticated with Cloudflare: `wrangler auth login`

## Step-by-Step Deployment

### 1. Clone and Setup

```bash
git clone https://github.com/krzko/statusflare.git
cd statusflare
pnpm install
```

### 2. Create Cloudflare Resources

#### Create D1 Database

```bash
pnpm dlx wrangler d1 create statusflare-db
```

This will output database information. Copy the `database_id` for the next step.

#### Create R2 Bucket

```bash
pnpm dlx wrangler r2 bucket create statusflare-pages
```

### 3. Configure Wrangler

Update `wrangler.jsonc` with your actual database ID:

```json
{
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "statusflare-db",
			"database_id": "your-actual-database-id-here"
		}
	]
}
```

### 4. Initialise Database Schema

```bash
pnpm dlx wrangler d1 execute statusflare-db --remote --file=db/schema-v4.sql
```

Verify the schema was applied:

```bash
pnpm dlx wrangler d1 execute statusflare-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 5. Deploy Worker

#### Development Deployment

```bash
pnpm run dev
```

This starts a local development server at `http://localhost:8787`

#### Production Deployment

```bash
pnpm run deploy
```

### 6. Verify Deployment

After deployment, Wrangler will provide your worker URL. Test the endpoints:

```bash
# Test status page
curl https://your-worker.your-subdomain.workers.dev/

# Test admin interface
curl https://your-worker.your-subdomain.workers.dev/admin

# Test API
curl https://your-worker.your-subdomain.workers.dev/api/services
```

## Environment Configuration

### Development Environment

For local development, create a `.dev.vars` file:

```bash
# .dev.vars (not committed to git)
ENVIRONMENT=development
```

### Production Environment

Set production environment variables:

```bash
pnpm dlx wrangler secret put ENVIRONMENT
# Enter: production
```

## Database Management

### Backup Database

```bash
# Export all data
pnpm dlx wrangler d1 execute statusflare-db --remote --command="SELECT * FROM services;" > services_backup.sql
pnpm dlx wrangler d1 execute statusflare-db --remote --command="SELECT * FROM status_checks;" > status_checks_backup.sql
```

### Restore Database

```bash
# Import data (example)
pnpm dlx wrangler d1 execute statusflare-db --remote --file=services_backup.sql
```

### Database Maintenance

Clean old status check data:

```bash
pnpm dlx wrangler d1 execute statusflare-db --remote --command="DELETE FROM status_checks WHERE checked_at < datetime('now', '-30 days');"
```

## Monitoring Setup

### View Logs

```bash
# Tail worker logs
pnpm dlx wrangler tail

# Filter logs
pnpm dlx wrangler tail --format=pretty --grep="error"
```

### Analytics

Monitor your worker performance in the Cloudflare dashboard:

1. Go to Workers & Pages
2. Select your worker
3. View the Analytics tab

## Custom Domain Setup

### 1. Add Custom Domain

In Cloudflare dashboard:

1. Go to Workers & Pages
2. Select your worker
3. Go to Settings → Triggers
4. Add custom domain

### 2. Configure DNS

Add a CNAME record pointing to your worker:

```
status.yourdomain.com CNAME your-worker.your-subdomain.workers.dev
```

### 3. SSL Configuration

Cloudflare automatically provides SSL certificates for custom domains.

## Scaling Considerations

### Worker Limits

Cloudflare Workers have the following limits:

- **CPU Time**: 50ms per request (free), 50ms-30s (paid)
- **Memory**: 128MB
- **Requests**: 100,000 per day (free), unlimited (paid)

### D1 Limits

- **Storage**: 25GB per database
- **Queries**: 100,000 per day (free), 25 million (paid)
- **Connections**: Automatic scaling

### R2 Limits

- **Storage**: Unlimited
- **Operations**: 1 million per month (free tier)

### Caching Strategy

The service uses multiple caching layers:

1. **R2 Cache**: Generated status pages
2. **Worker Cache**: In-memory caching of frequently accessed data
3. **Browser Cache**: Static assets and status pages

## Security Hardening

### Environment Variables

Never commit sensitive data to git. Use Wrangler secrets:

```bash
pnpm dlx wrangler secret put API_KEY
pnpm dlx wrangler secret put DATABASE_ENCRYPTION_KEY
```

### Access Control

Consider implementing authentication for the admin interface:

```typescript
// Example middleware
function requireAuth(request: Request): boolean {
	const authHeader = request.headers.get('Authorization');
	return authHeader === 'Bearer your-secret-token';
}
```

### Content Security Policy

Add CSP headers to prevent XSS:

```typescript
const headers = {
	'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
};
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check D1 binding
pnpm dlx wrangler d1 list

# Test database connection
pnpm dlx wrangler d1 execute statusflare-db --remote --command="SELECT 1;"
```

#### Worker Deployment Failures

```bash
# Check worker status
pnpm dlx wrangler whoami

# Validate wrangler.jsonc
pnpm dlx wrangler validate
```

#### R2 Access Issues

```bash
# List R2 buckets
pnpm dlx wrangler r2 bucket list

# Test R2 access
pnpm dlx wrangler r2 object put status-pages/test.txt --file=test.txt
```

### Debug Mode

Enable debug logging:

```bash
# Local development
pnpm run dev -- --verbose

# Production debugging
wrangler tail --debug
```

### Performance Issues

Check Worker analytics for:

- High CPU usage
- Memory consumption
- Request latency
- Error rates

## Rollback Procedure

### Worker Rollback

```bash
# List deployments
pnpm dlx wrangler deployments list

# Rollback to previous version
pnpm dlx wrangler rollback --deployment-id=<previous-deployment-id>
```

### Database Rollback

```bash
# Restore from backup
pnpm dlx wrangler d1 execute statusflare-db --remote --file=backup.sql
```
