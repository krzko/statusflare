# Statusflare

This is a status service that runson top of Cloudlare Workers and uses D1 as its backend state store. The difference is this worker will be invoked via a cron job every so often, perform the checks, by getting the config fro the D1 fatabase and then storing the render public page on R2 object storage.

This service takes inspiration by the many other status services out there, with rendering the outcomes in a beautiful web UI.

- We should copy how https://www.atlassian.com/software/statuspage works, but keeping the features very lightweight
- We need to be able to store configs in the database
- We need to be able to store the time series data as we'll check endpoints each each minute
- For now we'll use HTTP/HTTPS checks that look for certain values and statuses
- We will use typescript
- We should always use the context7 MCP server for documentation we dont understand
- Since this is cloudflare we will use the `wrangler` cli to manage configs
- We will use Cloudflare D1 for the database
- In the rendered static page we should have a public front end to showcase the service names, the graphs bar like statuspage for the services and the admin ui as well
- Browse https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/databases/connecting-to-databases.mdx to understand how to connect to cloudflare databases

## Language

- Use en-AU and not en-US.

## Tools

- Use `wrangler` for all cloudflare related tasks, this is performend by runnin `npx wrangler`
- Use `vitest` for all testing
- Use `typescript` for all code
- Use `cloudflare` for all cloudflare related code
- Use `cloudflare-d1` for all cloudflare d1 related code
- Use `cloudflare-r2` for all cloudflare r2 related code
- Use `cloudflare-workers` for all cloudflare workers related code
- Use `cloudflare-d1-types` for all cloudflare d1 types
- Use `cloudflare-r2-types` for all cloudflare r2 types
- Use `cloudflare-workers-types` for all cloudflare workers types

## Architecture

- Use clean architecture
- Use SOLID principals
- Use the ports and adapters architecture
- Use the hexagonal architecture
