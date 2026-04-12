# GetAeon Panel

React Router frontend for the GetAeon control plane.

## What It Does

- Authenticated operator dashboard
- Coolify-backed site creation for WordPress, Node.js, PHP, and static apps
- GitHub connection flow for private repository onboarding
- Site operations for deploys, restarts, logs, domains, databases, and team access
- Admin console for panel app env vars, health checks, and user management

## Local Development

```bash
npm install
npm run dev
```

The frontend expects a backend API origin through one of these variables:

- `API_BASE_URL`
- `VITE_API_BASE_URL`
- `VITE_BACKEND_ORIGIN`

## Branding And DNS

Default public panel URL is `https://app.getaeon.co`.

Optional frontend runtime/server variables:

- `PUBLIC_PANEL_URL`
- `PUBLIC_DNS_TARGET`

`PUBLIC_DNS_TARGET` is used in the site-domain UI so operators see the correct ingress target instead of a hard-coded IP.
