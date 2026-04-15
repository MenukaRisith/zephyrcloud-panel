import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const execFileAsync = promisify(execFile);

const DEFAULT_RANGE_MS = 60 * 60 * 1000;
const DEFAULT_PORT = 40177;

function readEnv(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function readRequiredEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readPositiveIntEnv(name, fallback) {
  const rawValue = readEnv(name, String(fallback));
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function normalizeIp(value) {
  return String(value ?? '')
    .replace(/^::ffff:/, '')
    .trim();
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sentinelUrl = normalizeBaseUrl(readEnv('SENTINEL_URL'));
const sentinelDockerContainer = readEnv('SENTINEL_DOCKER_CONTAINER');
const sentinelPort = readPositiveIntEnv('SENTINEL_PORT', 7777);
const sentinelResolveTtlMs = readPositiveIntEnv('SENTINEL_RESOLVE_TTL_MS', 30000);
const sentinelToken = readRequiredEnv('SENTINEL_TOKEN');
const bridgeApiKey = readRequiredEnv('BRIDGE_API_KEY');
const port = readPositiveIntEnv('PORT', DEFAULT_PORT);
const cacheTtlMs = readPositiveIntEnv('CACHE_TTL_MS', 15000);
const rateLimitWindowMs = readPositiveIntEnv('RATE_LIMIT_WINDOW_MS', 60000);
const rateLimitMax = readPositiveIntEnv('RATE_LIMIT_MAX', 120);
const upstreamTimeoutMs = readPositiveIntEnv('UPSTREAM_TIMEOUT_MS', 8000);
const maxRangeMs = readPositiveIntEnv('MAX_RANGE_MS', 6 * 60 * 60 * 1000);
const allowedIps = readEnv('ALLOWED_IPS')
  .split(',')
  .map((value) => normalizeIp(value))
  .filter(Boolean);
const trustProxy = readEnv('TRUST_PROXY', 'false').toLowerCase();

if (!sentinelUrl && !sentinelDockerContainer) {
  throw new Error('SENTINEL_URL or SENTINEL_DOCKER_CONTAINER is required.');
}

if (trustProxy === 'true') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        code: 'bridge_rate_limited',
        error: 'Too many metrics requests. Retry shortly.',
      });
    },
  }),
);

const responseCache = new Map();
let resolvedSentinelBaseUrl = sentinelUrl || null;
let resolvedSentinelBaseUrlExpiresAt = sentinelUrl ? Number.POSITIVE_INFINITY : 0;

function getCachedPayload(cacheKey) {
  const entry = responseCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function setCachedPayload(cacheKey, payload) {
  responseCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + cacheTtlMs,
  });
}

function cleanupExpiredCache() {
  const now = Date.now();
  for (const [cacheKey, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) {
      responseCache.delete(cacheKey);
    }
  }
}

setInterval(cleanupExpiredCache, Math.max(10000, cacheTtlMs)).unref();

async function resolveSentinelBaseUrl() {
  if (resolvedSentinelBaseUrl && resolvedSentinelBaseUrlExpiresAt > Date.now()) {
    return resolvedSentinelBaseUrl;
  }

  if (!sentinelDockerContainer) {
    throw new HttpError(
      500,
      'bridge_config_error',
      'Sentinel routing is not configured on the bridge.',
    );
  }

  try {
    const { stdout } = await execFileAsync('docker', [
      'inspect',
      sentinelDockerContainer,
      '--format',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}',
    ]);
    const sentinelIp = stdout
      .split(/\s+/)
      .map((value) => value.trim())
      .find(Boolean);

    if (!sentinelIp) {
      throw new Error('missing container IP');
    }

    resolvedSentinelBaseUrl = `http://${sentinelIp}:${sentinelPort}`;
    resolvedSentinelBaseUrlExpiresAt = Date.now() + sentinelResolveTtlMs;
    return resolvedSentinelBaseUrl;
  } catch (error) {
    throw new HttpError(
      502,
      'sentinel_unreachable',
      error instanceof Error
        ? `Sentinel container lookup failed: ${error.message}`
        : 'Sentinel container lookup failed.',
    );
  }
}

function readBearerToken(req) {
  const authorization = String(req.headers.authorization ?? '').trim();
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return String(req.headers['x-bridge-key'] ?? '').trim();
}

function requireBridgeAuth(req, _res, next) {
  const providedToken = readBearerToken(req);
  if (!providedToken || !timingSafeEqual(providedToken, bridgeApiKey)) {
    return next(
      new HttpError(401, 'bridge_unauthorized', 'Metrics bridge authorization failed.'),
    );
  }
  return next();
}

function enforceIpAllowlist(req, _res, next) {
  if (allowedIps.length === 0) {
    return next();
  }

  const requestIp = normalizeIp(req.ip || req.socket?.remoteAddress || '');
  if (!requestIp || !allowedIps.includes(requestIp)) {
    return next(
      new HttpError(403, 'bridge_ip_forbidden', 'Metrics bridge IP is not allowed.'),
    );
  }

  return next();
}

function readRange(queryValue, fallbackDate) {
  if (typeof queryValue === 'string' && queryValue.trim()) {
    const parsed = new Date(queryValue);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, 'invalid_range', 'Metrics range must be valid ISO timestamps.');
    }
    return parsed;
  }
  return fallbackDate;
}

function readMetricsRange(req) {
  const to = readRange(req.query.to, new Date());
  const from = readRange(req.query.from, new Date(to.getTime() - DEFAULT_RANGE_MS));

  if (from >= to) {
    throw new HttpError(400, 'invalid_range', '`from` must be before `to`.');
  }

  if (to.getTime() - from.getTime() > maxRangeMs) {
    throw new HttpError(
      400,
      'range_too_large',
      `Metrics range cannot exceed ${maxRangeMs} milliseconds.`,
    );
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function readContainerId(req) {
  const id = String(req.params.id ?? '').trim();
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(id)) {
    throw new HttpError(400, 'invalid_container_id', 'Container id is invalid.');
  }
  return id;
}

function expandContainerIdentifiers(containerId) {
  const identifiers = [containerId];
  const projectStyleId = containerId.replace(/-\d{12,}$/, '');
  if (projectStyleId && projectStyleId !== containerId) {
    identifiers.push(projectStyleId);
  }
  return identifiers;
}

async function fetchSentinelHistory(kind, containerId, from, to) {
  const sentinelBaseUrl = await resolveSentinelBaseUrl();
  const target = new URL(
    `/api/container/${encodeURIComponent(containerId)}/${kind}/history`,
    `${sentinelBaseUrl}/`,
  );
  target.searchParams.set('from', from);
  target.searchParams.set('to', to);

  let response;
  try {
    response = await fetch(target, {
      headers: {
        Authorization: `Bearer ${sentinelToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.message === 'fetch failed' ||
        /network|timeout|connect|socket/i.test(error.message))
    ) {
      throw new HttpError(
        504,
        'sentinel_timeout',
        'Sentinel did not respond before the upstream timeout.',
      );
    }
    throw new HttpError(502, 'sentinel_unreachable', 'Sentinel could not be reached.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new HttpError(404, 'sentinel_not_found', 'Metrics are not available yet.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(
        502,
        'sentinel_unauthorized',
        'Sentinel rejected the configured bridge token.',
      );
    }
    throw new HttpError(
      502,
      'sentinel_error',
      `Sentinel returned HTTP ${response.status}.`,
    );
  }

  const payload = await response.json().catch(() => {
    throw new HttpError(
      502,
      'sentinel_invalid_json',
      'Sentinel returned an invalid JSON payload.',
    );
  });

  if (!Array.isArray(payload)) {
    throw new HttpError(
      502,
      'sentinel_invalid_payload',
      'Sentinel returned an unexpected metrics payload.',
    );
  }

  return payload;
}

async function fetchMetricsPayload(containerId, from, to) {
  const identifiers = expandContainerIdentifiers(containerId);
  let lastCpu = [];
  let lastMemory = [];

  for (const identifier of identifiers) {
    const [cpu, memory] = await Promise.all([
      fetchSentinelHistory('cpu', identifier, from, to),
      fetchSentinelHistory('memory', identifier, from, to),
    ]);

    lastCpu = cpu;
    lastMemory = memory;

    if (cpu.length > 0 || memory.length > 0 || identifier === identifiers[identifiers.length - 1]) {
      return {
        cpu,
        memory,
        resolvedContainerId: identifier,
      };
    }
  }

  return {
    cpu: lastCpu,
    memory: lastMemory,
    resolvedContainerId: containerId,
  };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    cache_ttl_ms: cacheTtlMs,
    rate_limit_window_ms: rateLimitWindowMs,
    rate_limit_max: rateLimitMax,
  });
});

app.get('/metrics/:id', requireBridgeAuth, enforceIpAllowlist, async (req, res, next) => {
  try {
    const containerId = readContainerId(req);
    const { from, to } = readMetricsRange(req);
    const cacheKey = `${containerId}:${from}:${to}`;
    const cachedPayload = getCachedPayload(cacheKey);

    if (cachedPayload) {
      res.set('Cache-Control', `private, max-age=${Math.max(1, Math.floor(cacheTtlMs / 1000))}`);
      res.set('X-Cache', 'HIT');
      return res.json(cachedPayload);
    }

    const { cpu, memory, resolvedContainerId } = await fetchMetricsPayload(
      containerId,
      from,
      to,
    );

    const payload = {
      cpu,
      memory,
      meta: {
        container_id: containerId,
        resolved_container_id: resolvedContainerId,
        from,
        to,
        fetched_at: new Date().toISOString(),
      },
    };

    setCachedPayload(cacheKey, payload);

    res.set('Cache-Control', `private, max-age=${Math.max(1, Math.floor(cacheTtlMs / 1000))}`);
    res.set('X-Cache', 'MISS');
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
    });
  }

  console.error('[metrics-bridge] unexpected error', error);
  return res.status(500).json({
    code: 'bridge_internal_error',
    error: 'Metrics bridge failed unexpectedly.',
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[metrics-bridge] listening on ${port}`);
});

server.keepAliveTimeout = upstreamTimeoutMs + 2000;
server.requestTimeout = upstreamTimeoutMs + 3000;
server.headersTimeout = upstreamTimeoutMs + 5000;
