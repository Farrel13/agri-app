# Vercel deployment notes

## Prisma connection pool

Set `DATABASE_URL` in the Vercel project to the database provider's pooled endpoint (PgBouncer/Neon pooled endpoint, for example). A conservative Prisma 5 URL shape for serverless instances is:

```text
postgresql://USER:PASSWORD@POOL_HOST/DB?sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=10
```

Use the provider's documented URL parameters and keep migration commands on a direct connection URL if required. Do not commit credentials. `lib/prisma.ts` uses a singleton within each warm function instance; pool sizing is still required because each serverless instance can open its own pool.

## Chatbot function duration

The chatbot waits on database queries and the Gemini stream. To set its Vercel function execution ceiling, add this route-segment config at module scope in `app/api/chatbot/route.ts`:

```ts
export const maxDuration = 60;
```

Choose a value within the maximum allowed by the project's Vercel plan and function runtime. This is an upper timeout, not a way to make upstream calls finish sooner; retain timeouts/error handling for external services. The route's streamed response should be consumed promptly by the client.

## Document generator

The PDF is a manually invoked local utility (`npm run generate:ta-pdf`), not part of `npm run build`. `.vercelignore` excludes its source and generated temporary/output files from deployment.
