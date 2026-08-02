# Reframely deployment environment

Supabase authentication is fail-closed. The Vite frontend is hosted on
Netlify; the Fastify backend must remain on a server host that supports
long-running Node processes and WebSocket upgrades.

## Netlify frontend site

The repository-root `netlify.toml` builds `frontend/` and publishes
`frontend/dist`. In Netlify, add these environment variables for Production
and any Deploy Preview/Branch Deploy context that should support login:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
```

The anon key is designed to be public and is embedded by Vite. Never add the
service-role key to Netlify or any `VITE_*` variable.

The frontend currently sends HTTP API requests to same-origin `/api`. Add a
Netlify `/api/*` reverse-proxy redirect to the deployed Fastify backend before
the SPA fallback once the backend URL is known. The browser WebSocket client
also needs the backend's public `wss://` endpoint; Netlify should not host the
Fastify WebSocket server.

## Fastify backend host

Set in the backend provider's Production environment:

```text
AUTH_MODE=on
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role secret>
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Private development environments
may use `AUTH_MODE=dev`, which injects the fixed `local-user`; production
startup rejects `dev`, `off`, and an unset mode. Never expose a `dev` backend
publicly because every visitor shares that identity.

Also configure the existing backend infrastructure variables, including
`DATABASE_URL`, S3 settings, and `DEPLOY_BASE_URL`.

## Supabase dashboard

In Authentication > URL Configuration:

- Set **Site URL** to the production Netlify URL or custom frontend domain.
- Add the production URL with `/**` to **Redirect URLs**.
- Add only the Netlify Deploy Preview patterns you intend to authenticate.

Enable Email authentication under Authentication > Providers and decide
whether email confirmation is required before testing sign-up.

## Post-deployment security check

1. Sign up and sign in as user A, then create/import a project.
2. Sign up and sign in as user B. Requests for user A's project id must return
   `403`, including the page-sync WebSocket handshake.
3. Sign out. Protected routes must return to `/login`, and subsequent API calls
   must remain blocked with `401` until sign-in succeeds again.
4. Confirm backend logs show `AUTH_MODE=on` and no "Invalid environment
   configuration" startup error.
