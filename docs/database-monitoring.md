# Database Monitoring Guide (PostgreSQL & MySQL)

This guide explains how to set up PostgreSQL and MySQL database monitoring using Cloudflare Hyperdrive for optimal performance and reduced subrequest usage.

## Overview

Database monitoring (PostgreSQL and MySQL) in this status service uses Cloudflare Hyperdrive to provide:

- Efficient connection pooling and management
- Reduced subrequest usage (avoiding the 100 subrequest limit)
- Global connection caching for improved performance
- Secure, optimised database connectivity
- Support for both PostgreSQL and MySQL databases

## Prerequisites

- Cloudflare Workers on a paid plan (required for Hyperdrive)
- PostgreSQL or MySQL database with SSL enabled
- Database credentials with appropriate read permissions

## Setup Guide

### 1. Create Hyperdrive Configuration

For each database you want to monitor, create a Hyperdrive configuration:

**PostgreSQL:**

```bash
# Create Hyperdrive binding for PostgreSQL database
pnpm dlx wrangler hyperdrive create my-postgres-db --connection-string="postgresql://username:password@host:port/database?sslmode=require"
```

**MySQL:**

```bash
# Create Hyperdrive binding for MySQL database
pnpm dlx hyperdrive create my-mysql-db --connection-string="mysql://username:password@host:port/database?ssl-mode=REQUIRED"
```

**Examples:**

```bash
# PostgreSQL
pnpm dlx hyperdrive create production-postgres --connection-string="postgresql://myuser:mypass@db.example.com:5432/myapp?sslmode=require"

# MySQL
pnpm dlx hyperdrive create production-mysql --connection-string="mysql://myuser:mypass@mysql.example.com:3306/myapp?ssl-mode=REQUIRED"
```

This will output a Hyperdrive ID like: `b5f27764f6f74e1a9d72089b2445e21d`

**Important Note:** The connection string is stored securely within the Hyperdrive configuration, not in your database or Worker code.

### 2. Update Wrangler Configuration

Add the Hyperdrive binding to your `wrangler.jsonc`:

```json
{
	"hyperdrive": [
		{
			"binding": "HYPERDRIVE",
			"id": "your-hyperdrive-id-here"
		}
	]
}
```

**For multiple databases** (PostgreSQL and/or MySQL), you can create multiple bindings:

```json
{
	"hyperdrive": [
		{
			"binding": "HYPERDRIVE_DIGITALOCEAN_DB",
			"id": "b5f27764f6f74e1a9d72089b2445e21d"
		},
		{
			"binding": "HYPERDRIVE_SUPABASE_DB",
			"id": "f1906b89bc244286b00f42b31807a452"
		},
		{
			"binding": "HYPERDRIVE_STAGING",
			"id": "staging-hyperdrive-id"
		}
	],
	"vars": {
		"HYPERDRIVE_DIGITALOCEAN_DB_ID": "b5f27764f6f74e1a9d72089b2445e21d",
		"HYPERDRIVE_SUPABASE_DB_ID": "f1906b89bc244286b00f42b31807a452",
		"HYPERDRIVE_STAGING_ID": "staging-hyperdrive-id"
	}
}
```

### 3. Update TypeScript Definitions

Add the Hyperdrive bindings to your environment types in `worker-configuration.d.ts`:

```typescript
declare namespace Cloudflare {
	interface Env {
		// ... existing bindings
		HYPERDRIVE: Hyperdrive;
		// For multiple databases:
		HYPERDRIVE_DIGITALOCEAN_DB: Hyperdrive;
		HYPERDRIVE_SUPABASE_DB: Hyperdrive;
		HYPERDRIVE_STAGING: Hyperdrive;
		// Environment variables for ID mapping:
		HYPERDRIVE_DIGITALOCEAN_DB_ID: string;
		HYPERDRIVE_SUPABASE_DB_ID: string;
		HYPERDRIVE_STAGING_ID: string;
	}
}
```

### 4. Configure Service in Admin UI

1. Go to your admin panel: `https://your-worker.workers.dev/admin`
2. Navigate to the **Services** tab
3. Click **Add Service**
4. Configure the database monitor:
   - **Service Name**: Descriptive name (e.g., "Production PostgreSQL" or "Analytics MySQL")
   - **Monitor Type**: Select "Database Monitor (PostgreSQL/MySQL)"
   - **Hyperdrive ID**: The ID returned from your `wrangler hyperdrive create` command
   - **Query**: SQL query to execute (default: `SELECT 1`)
   - **Timeout**: Connection timeout in milliseconds

**Example Configuration:**

**PostgreSQL:**

- **Service Name**: "Production PostgreSQL"
- **Hyperdrive ID**: `b5f27764f6f74e1a9d72089b2445e21d`
- **Query**: `SELECT COUNT(*) FROM users`
- **Timeout**: `10000` (10 seconds)

**MySQL:**

- **Service Name**: "Analytics MySQL"
- **Hyperdrive ID**: `c6e38865g7g85f2b0e83180c3556f32e`
- **Query**: `SELECT VERSION()`
- **Timeout**: `8000` (8 seconds)

## Adding Additional Databases

To monitor multiple databases (PostgreSQL and/or MySQL), you have two options:

### Option 1: Single Hyperdrive Binding (Recommended for similar databases)

If your databases are in the same region/provider and have similar performance characteristics, you can use one Hyperdrive binding for multiple monitors.

**Steps:**

1. Create one Hyperdrive configuration pointing to your primary database
2. In the admin UI, create multiple database monitors, each with the same Hyperdrive ID
3. The service will route all monitors with that ID to the same Hyperdrive connection

### Option 2: Multiple Hyperdrive Bindings (Recommended for different providers/regions)

For databases in different regions, providers, or with different performance requirements:

1. **Create additional Hyperdrive configurations:**

   ```bash
   # PostgreSQL databases
   pnpm dlx hyperdrive create staging-postgres --connection-string="postgresql://user:pass@staging-host:5432/db?sslmode=require"
   pnpm dlx hyperdrive create analytics-postgres --connection-string="postgresql://user:pass@analytics-host:5432/db?sslmode=require"

   # MySQL databases
   pnpm dlx hyperdrive create staging-mysql --connection-string="mysql://user:pass@staging-mysql:3306/db?ssl-mode=REQUIRED"
   pnpm dlx hyperdrive create analytics-mysql --connection-string="mysql://user:pass@analytics-mysql:3306/db?ssl-mode=REQUIRED"
   ```

2. **Update wrangler.jsonc:**

   ```json
   {
   	"hyperdrive": [
   		{
   			"binding": "HYPERDRIVE_PROD_POSTGRES",
   			"id": "production-postgres-hyperdrive-id"
   		},
   		{
   			"binding": "HYPERDRIVE_STAGING_POSTGRES",
   			"id": "staging-postgres-hyperdrive-id"
   		},
   		{
   			"binding": "HYPERDRIVE_ANALYTICS_MYSQL",
   			"id": "analytics-mysql-hyperdrive-id"
   		}
   	],
   	"vars": {
   		"HYPERDRIVE_PROD_POSTGRES_ID": "production-postgres-hyperdrive-id",
   		"HYPERDRIVE_STAGING_POSTGRES_ID": "staging-postgres-hyperdrive-id",
   		"HYPERDRIVE_ANALYTICS_MYSQL_ID": "analytics-mysql-hyperdrive-id"
   	}
   }
   ```

3. **Add environment variable mappings**:
   For each Hyperdrive binding, add an environment variable that maps the binding name to its ID. This allows the service to automatically select the correct Hyperdrive configuration based on the ID stored in your database service.

## How Hyperdrive ID Mapping Works

The service uses a smart routing system to connect each database monitor to the correct Hyperdrive configuration:

1. **You specify a Hyperdrive ID** in your database monitor (e.g., `b5f27764f6f74e1a9d72089b2445e21d`)

2. **The service scans all available Hyperdrive bindings** in your environment (e.g., `HYPERDRIVE_DIGITALOCEAN_DB`, `HYPERDRIVE_SUPABASE_DB`)

3. **It checks environment variables** to find which binding corresponds to your ID:
   - `HYPERDRIVE_DIGITALOCEAN_DB_ID` = `b5f27764f6f74e1a9d72089b2445e21d` ✅ Match!
   - `HYPERDRIVE_SUPABASE_DB_ID` = `f1906b89bc244286b00f42b31807a452` ❌ No match

4. **Uses the matching Hyperdrive binding** for that database connection

This means:

- ✅ Each database monitor uses its specific Hyperdrive configuration
- ✅ Multiple databases can be monitored independently
- ✅ You can easily add new databases by creating new Hyperdrive configs and adding their IDs
- ✅ No code changes needed to support additional databases

## Connection String Requirements

**Important:** Connection strings are stored securely in Hyperdrive configurations, not in your Worker or database.

### PostgreSQL Connection Strings

**Required Parameters:**

- **SSL Mode**: Must include `sslmode=require` for production security
- **Host**: Fully qualified domain name or IP address
- **Port**: Database port (typically 5432 for PostgreSQL)
- **Database**: Target database name
- **Credentials**: Valid username and password with read permissions

**Example PostgreSQL Connection Strings:**

**DigitalOcean Managed Database:**

```
postgresql://username:password@db-name-do-user-123-0.b.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

**AWS RDS:**

```
postgresql://username:password@mydb.region.rds.amazonaws.com:5432/myapp?sslmode=require
```

**Google Cloud SQL:**

```
postgresql://username:password@project:region:instance/database?sslmode=require
```

**Self-hosted with SSL:**

```
postgresql://username:password@myserver.com:5432/database?sslmode=require
```

### MySQL Connection Strings

**Required Parameters:**

- **SSL Mode**: Must include `ssl-mode=REQUIRED` for production security
- **Host**: Fully qualified domain name or IP address
- **Port**: Database port (typically 3306 for MySQL)
- **Database**: Target database name
- **Credentials**: Valid username and password with read permissions

**Example MySQL Connection Strings:**

**AWS RDS MySQL:**

```
mysql://username:password@mydb.region.rds.amazonaws.com:3306/myapp?ssl-mode=REQUIRED
```

**Google Cloud SQL MySQL:**

```
mysql://username:password@project:region:instance/database?ssl-mode=REQUIRED
```

**DigitalOcean Managed MySQL:**

```
mysql://username:password@mysql-db-name-do-user-123-0.b.db.ondigitalocean.com:25060/defaultdb?ssl-mode=REQUIRED
```

**Self-hosted MySQL with SSL:**

```
mysql://username:password@mysql.myserver.com:3306/database?ssl-mode=REQUIRED
```

## Health Check Queries

### Default Query

The service uses `SELECT 1` by default, which is lightweight and tests basic connectivity for both PostgreSQL and MySQL.

### PostgreSQL Custom Queries

You can specify custom queries to test specific functionality:

**Check table accessibility:**

```sql
SELECT COUNT(*) FROM users LIMIT 1
```

**Check recent data:**

```sql
SELECT MAX(created_at) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'
```

**Check database responsiveness:**

```sql
SELECT version(), now()
```

**Performance test:**

```sql
SELECT pg_database_size(current_database())
```

### MySQL Custom Queries

**Check table accessibility:**

```sql
SELECT COUNT(*) FROM users LIMIT 1
```

**Check recent data:**

```sql
SELECT MAX(created_at) FROM orders WHERE created_at > NOW() - INTERVAL 1 HOUR
```

**Check database responsiveness:**

```sql
SELECT VERSION(), NOW()
```

**Performance test:**

```sql
SELECT TABLE_SCHEMA, SUM(DATA_LENGTH + INDEX_LENGTH) as size FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
```

### Query Guidelines

- Keep queries lightweight to avoid impacting database performance
- Use `LIMIT 1` when checking row counts
- Avoid complex JOINs or aggregations
- Test queries manually before adding to monitoring
- Consider read-only user permissions for monitoring

## Security Best Practices

### Database User Permissions

Create a dedicated monitoring user with minimal permissions:

**PostgreSQL:**

```sql
-- Create monitoring user
CREATE USER monitor_user WITH PASSWORD 'secure_random_password';

-- Grant minimal permissions
GRANT CONNECT ON DATABASE your_database TO monitor_user;
GRANT USAGE ON SCHEMA public TO monitor_user;
GRANT SELECT ON specific_tables TO monitor_user;

-- For basic connectivity checks only
-- No additional permissions needed beyond CONNECT
```

**MySQL:**

```sql
-- Create monitoring user
CREATE USER 'monitor_user'@'%' IDENTIFIED BY 'secure_random_password';

-- Grant minimal permissions
GRANT SELECT ON your_database.* TO 'monitor_user'@'%';

-- For basic connectivity checks only
GRANT USAGE ON *.* TO 'monitor_user'@'%';

-- Apply changes
FLUSH PRIVILEGES;
```

### Connection Security

- **Always use SSL**:
  - PostgreSQL: Include `sslmode=require` in connection strings
  - MySQL: Include `ssl-mode=REQUIRED` in connection strings
- **Use strong passwords**: Generate cryptographically secure passwords
- **Restrict network access**: Configure database firewall rules
- **Monitor access logs**: Review database connection logs regularly

### Secret Management

- Store sensitive credentials securely
- Use Cloudflare's secret management for passwords when possible
- Rotate database passwords regularly
- Audit access to connection strings

## Troubleshooting

### Common Issues

**"Too many subrequests" Error:**

- Verify Hyperdrive is properly configured
- Check that the service is using the Hyperdrive connection
- Ensure you're on a paid Cloudflare plan

**Connection Timeout:**

- Verify database hostname and port
- Check SSL requirements:
  - PostgreSQL: `sslmode=require`
  - MySQL: `ssl-mode=REQUIRED`
- Test connection string manually
- Increase timeout values if needed

**Authentication Failed:**

- Verify username and password
- Check user permissions
- Ensure user can connect from external IPs

**SSL Connection Error:**

- Verify SSL configuration in connection string:
  - PostgreSQL: `sslmode=require`
  - MySQL: `ssl-mode=REQUIRED`
- Check database SSL configuration
- Ensure certificates are valid

### Debugging Steps

1. **Test connection string manually:**

   ```bash
   # PostgreSQL
   psql "postgresql://user:pass@host:port/db?sslmode=require"

   # MySQL
   mysql --host=host --port=port --user=user --password=pass --database=db --ssl-mode=REQUIRED
   ```

2. **Check Hyperdrive configuration:**

   ```bash
   pnpm dlx hyperdrive list
   ```

3. **Review Worker logs:**

   ```bash
   pnpm dlx tail
   ```

4. **Verify database permissions:**

   ```sql
   # PostgreSQL
   \du monitor_user
   \l

   # MySQL
   SHOW GRANTS FOR 'monitor_user'@'%';
   SHOW DATABASES;
   ```

## Performance Considerations

### Query Performance

- Use simple queries that execute quickly (< 100ms)
- Avoid queries that scan large tables
- Consider database indexing for custom queries
- Monitor query execution times

### Connection Management

- Hyperdrive handles connection pooling automatically
- Each health check creates a temporary connection
- Connections are closed immediately after checks
- No persistent connections are maintained

### Monitoring Frequency

- Default: Every minute via cron trigger
- Consider reducing frequency for expensive queries
- Balance between responsiveness and database load
- Monitor database connection limits

## Migration from Direct Connections

If you're upgrading from direct database connections:

1. **Create Hyperdrive configurations** for your databases as described above
2. **Update wrangler.jsonc** with Hyperdrive bindings
3. **Run the migration script** to update existing monitors:
   ```bash
   pnpm dlx d1 execute status-db --remote --file=migrate-database-fields.sql
   ```
4. **Update your service configurations** to use Hyperdrive IDs instead of connection strings
5. **Deploy the updated service**
6. **Test database monitoring** in admin panel
7. **Verify reduced subrequest usage** in Cloudflare Analytics

The service will automatically use Hyperdrive connections for all database monitors after deployment.

## Cost Implications

### Cloudflare Hyperdrive Pricing

- Requires Workers Paid plan ($5/month minimum)
- Hyperdrive usage charges apply based on queries and data transfer
- See [Cloudflare Hyperdrive Pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/) for current rates

### Database Provider Costs

- Monitor connection limits to avoid exceeding plans
- Consider read replica usage for monitoring
- Factor in data transfer costs for cloud providers
