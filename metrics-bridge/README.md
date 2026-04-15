# ZephyrCloud Metrics Bridge

Small Express service that proxies Coolify Sentinel metrics behind a separate VPS endpoint.

## Environment

- `SENTINEL_URL` optional when Sentinel is exposed on the host
- `SENTINEL_DOCKER_CONTAINER` optional alternative for Coolify installs where Sentinel only exists as a Docker container
- `SENTINEL_PORT` defaults to `7777`
- `SENTINEL_RESOLVE_TTL_MS` defaults to `30000`
- `SENTINEL_TOKEN`
- `BRIDGE_API_KEY`
- `PORT` defaults to `40177`
- `CACHE_TTL_MS` defaults to `15000`
- `RATE_LIMIT_WINDOW_MS` defaults to `60000`
- `RATE_LIMIT_MAX` defaults to `120`
- `UPSTREAM_TIMEOUT_MS` defaults to `8000`
- `MAX_RANGE_MS` defaults to `21600000`
- `ALLOWED_IPS` optional comma-separated allowlist
- `TRUST_PROXY` optional

## Run

```bash
npm install
cp .env.example .env
pm2 start ecosystem.config.cjs
```
