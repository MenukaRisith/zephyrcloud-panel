import { N8nDeploymentVariant } from '@prisma/client';
import { buildN8nDockerCompose } from './n8n-compose';

const baseInput = {
  publicUrl: 'https://n8n-1.example.com',
  serviceName: 'Customer N8N',
  encryptionKey: 'encryption-key',
  postgresPassword: 'postgres-secret',
  redisPassword: 'redis-secret',
};

describe('buildN8nDockerCompose', () => {
  it('builds the simple one-container variant', () => {
    const compose = buildN8nDockerCompose({
      ...baseInput,
      variant: N8nDeploymentVariant.SIMPLE,
    });

    expect(compose).toContain('n8n:');
    expect(compose).toContain('/home/node/.n8n');
    expect(compose).toContain('WEBHOOK_URL: "https://n8n-1.example.com/"');
    expect(compose).not.toContain('postgres:');
    expect(compose).not.toContain('redis:');
    expect(compose).not.toContain('worker:');
  });

  it('builds the n8n plus Postgres variant', () => {
    const compose = buildN8nDockerCompose({
      ...baseInput,
      variant: N8nDeploymentVariant.POSTGRES,
    });

    expect(compose).toContain('postgres:');
    expect(compose).toContain('DB_TYPE: "postgresdb"');
    expect(compose).toContain('DB_POSTGRESDB_HOST: "postgres"');
    expect(compose).not.toContain('redis:');
    expect(compose).not.toContain('worker:');
  });

  it('builds queue mode with Redis and a worker', () => {
    const compose = buildN8nDockerCompose({
      ...baseInput,
      variant: N8nDeploymentVariant.QUEUE,
      workerConcurrency: 7,
    });

    expect(compose).toContain('postgres:');
    expect(compose).toContain('redis:');
    expect(compose).toContain('worker:');
    expect(compose).toContain('EXECUTIONS_MODE: "queue"');
    expect(compose).toContain('QUEUE_BULL_REDIS_HOST: "redis"');
    expect(compose).toContain('command: "worker --concurrency=7"');
  });
});
