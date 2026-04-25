import { N8nDeploymentVariant } from '@prisma/client';

export type BuildN8nDockerComposeInput = {
  variant: N8nDeploymentVariant;
  publicUrl: string;
  serviceName: string;
  encryptionKey: string;
  postgresPassword?: string;
  redisPassword?: string;
  timezone?: string;
  n8nImage?: string;
  postgresImage?: string;
  redisImage?: string;
  workerConcurrency?: number;
};

type EnvEntry = [string, string];

export function buildN8nDockerCompose(
  input: BuildN8nDockerComposeInput,
): string {
  const publicUrl = normalizePublicUrl(input.publicUrl);
  const host = new URL(publicUrl).host;
  const timezone = input.timezone?.trim() || 'UTC';
  const n8nImage = input.n8nImage?.trim() || 'docker.n8n.io/n8nio/n8n:latest';
  const postgresImage = input.postgresImage?.trim() || 'postgres:16-alpine';
  const redisImage = input.redisImage?.trim() || 'redis:7-alpine';
  const serviceSlug = safeComposeName(input.serviceName);
  const commonEnv: EnvEntry[] = [
    ['N8N_HOST', host],
    ['N8N_PROTOCOL', 'https'],
    ['N8N_PORT', '5678'],
    ['WEBHOOK_URL', `${publicUrl}/`],
    ['N8N_ENCRYPTION_KEY', input.encryptionKey],
    ['N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS', 'true'],
    ['N8N_RUNNERS_ENABLED', 'true'],
    ['GENERIC_TIMEZONE', timezone],
    ['TZ', timezone],
  ];

  if (input.variant === N8nDeploymentVariant.SIMPLE) {
    return [
      'services:',
      renderN8nService({
        name: 'n8n',
        image: n8nImage,
        environment: commonEnv,
        volumes: ['n8n_data:/home/node/.n8n'],
        expose: true,
      }),
      'volumes:',
      '  n8n_data:',
      '',
    ].join('\n');
  }

  const postgresPassword = requireSecret(
    input.postgresPassword,
    'postgresPassword',
  );
  const postgresEnv: EnvEntry[] = [
    ['DB_TYPE', 'postgresdb'],
    ['DB_POSTGRESDB_HOST', 'postgres'],
    ['DB_POSTGRESDB_PORT', '5432'],
    ['DB_POSTGRESDB_DATABASE', 'n8n'],
    ['DB_POSTGRESDB_USER', 'n8n'],
    ['DB_POSTGRESDB_PASSWORD', postgresPassword],
  ];

  if (input.variant === N8nDeploymentVariant.POSTGRES) {
    return [
      'services:',
      renderPostgresService(
        postgresImage,
        postgresPassword,
        `${serviceSlug}_postgres_data`,
      ),
      renderN8nService({
        name: 'n8n',
        image: n8nImage,
        environment: [...commonEnv, ...postgresEnv],
        dependsOn: ['postgres'],
        volumes: ['n8n_data:/home/node/.n8n'],
        expose: true,
      }),
      'volumes:',
      '  n8n_data:',
      `  ${serviceSlug}_postgres_data:`,
      '',
    ].join('\n');
  }

  const redisPassword = requireSecret(input.redisPassword, 'redisPassword');
  const queueEnv: EnvEntry[] = [
    ['EXECUTIONS_MODE', 'queue'],
    ['QUEUE_BULL_REDIS_HOST', 'redis'],
    ['QUEUE_BULL_REDIS_PORT', '6379'],
    ['QUEUE_BULL_REDIS_PASSWORD', redisPassword],
    ['QUEUE_HEALTH_CHECK_ACTIVE', 'true'],
    ['N8N_DEFAULT_BINARY_DATA_MODE', 'database'],
  ];
  const workerConcurrency = Math.max(
    1,
    Math.trunc(input.workerConcurrency ?? 5),
  );

  return [
    'services:',
      renderPostgresService(
        postgresImage,
        postgresPassword,
        `${serviceSlug}_postgres_data`,
      ),
      renderRedisService(redisImage, redisPassword, `${serviceSlug}_redis_data`),
    renderN8nService({
      name: 'n8n',
      image: n8nImage,
      environment: [...commonEnv, ...postgresEnv, ...queueEnv],
      dependsOn: ['postgres', 'redis'],
      volumes: ['n8n_data:/home/node/.n8n'],
      expose: true,
    }),
    renderN8nService({
      name: 'worker',
      image: n8nImage,
      command: `worker --concurrency=${workerConcurrency}`,
      environment: [...commonEnv, ...postgresEnv, ...queueEnv],
      dependsOn: ['postgres', 'redis'],
      volumes: ['n8n_data:/home/node/.n8n'],
      expose: false,
    }),
    'volumes:',
    '  n8n_data:',
    `  ${serviceSlug}_postgres_data:`,
    `  ${serviceSlug}_redis_data:`,
    '',
  ].join('\n');
}

function renderN8nService(args: {
  name: string;
  image: string;
  command?: string;
  environment: EnvEntry[];
  dependsOn?: string[];
  volumes: string[];
  expose: boolean;
}): string {
  const lines = [
    `  ${args.name}:`,
    `    image: ${quoteYaml(args.image)}`,
    '    restart: unless-stopped',
  ];
  if (args.command) {
    lines.push(`    command: ${quoteYaml(args.command)}`);
  }
  if (args.dependsOn?.length) {
    lines.push('    depends_on:');
    for (const service of args.dependsOn) {
      lines.push(`      ${service}:`);
      lines.push('        condition: service_healthy');
    }
  }
  lines.push('    environment:');
  for (const [key, value] of args.environment) {
    lines.push(`      ${key}: ${quoteYaml(value)}`);
  }
  if (args.expose) {
    lines.push('    expose:');
    lines.push('      - "5678"');
  }
  lines.push('    volumes:');
  for (const volume of args.volumes) {
    lines.push(`      - ${quoteYaml(volume)}`);
  }
  return lines.join('\n');
}

function renderPostgresService(
  image: string,
  password: string,
  volumeName: string,
): string {
  return [
    '  postgres:',
    `    image: ${quoteYaml(image)}`,
    '    restart: unless-stopped',
    '    environment:',
    '      POSTGRES_USER: "n8n"',
    `      POSTGRES_PASSWORD: ${quoteYaml(password)}`,
    '      POSTGRES_DB: "n8n"',
    '    volumes:',
    `      - ${quoteYaml(`${volumeName}:/var/lib/postgresql/data`)}`,
    '    healthcheck:',
    '      test: ["CMD-SHELL", "pg_isready -U n8n -d n8n"]',
    '      interval: 10s',
    '      timeout: 5s',
    '      retries: 5',
  ].join('\n');
}

function renderRedisService(
  image: string,
  password: string,
  volumeName: string,
): string {
  return [
    '  redis:',
    `    image: ${quoteYaml(image)}`,
    '    restart: unless-stopped',
    `    command: ${quoteYaml(`redis-server --appendonly yes --requirepass ${password}`)}`,
    '    volumes:',
    `      - ${quoteYaml(`${volumeName}:/data`)}`,
    '    healthcheck:',
    `      test: ["CMD", "redis-cli", "-a", ${quoteYaml(password)}, "ping"]`,
    '      interval: 10s',
    '      timeout: 5s',
    '      retries: 5',
  ].join('\n');
}

function normalizePublicUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('publicUrl is required');
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function safeComposeName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'n8n'
  );
}

function requireSecret(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}
