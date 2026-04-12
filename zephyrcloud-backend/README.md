# GetAeon Backend

NestJS API for the GetAeon panel.

## Responsibilities

- Authentication and session support
- Tenant, site, domain, team, and database management
- Coolify API orchestration for provisioning and operations
- GitHub OAuth and deploy-key automation
- Admin APIs for panel app health, env management, and user administration

## Local Development

```bash
npm install
npm run start:dev
```

## Key Environment Variables

- `COOLIFY_BASE_URL`
- `COOLIFY_API_TOKEN`
- `COOLIFY_DESTINATION_UUID` optional
- `COOLIFY_SERVER_UUID` optional
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `ADMIN_PANEL_BACKEND_APP_NAME` or `ADMIN_PANEL_BACKEND_APP_UUID`
- `ADMIN_PANEL_FRONTEND_APP_NAME` or `ADMIN_PANEL_FRONTEND_APP_UUID`

The admin panel app resolver supports both legacy `zephyrcloud-*` names and new `getaeon-*` names.
