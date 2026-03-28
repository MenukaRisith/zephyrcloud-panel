import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

type CoolifyRequestMethod = 'GET' | 'POST' | 'DELETE' | 'PATCH';

type CoolifyErrorDetails = {
  status?: number;
  data?: unknown;
  method: CoolifyRequestMethod;
  path: string;
  body?: unknown;
};

type ErrorWithCoolifyDetails = Error & {
  coolify?: CoolifyErrorDetails;
};

@Injectable()
export class CoolifyClient {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(CoolifyClient.name);
  private static readonly sensitiveKeyPattern =
    /(authorization|cookie|token|secret|password|passwd|private|session|jwt|api[_-]?key|credential)/i;

  public constructor(private readonly config: ConfigService) {
    const baseURL = (this.config.get<string>('COOLIFY_BASE_URL') ?? '').trim();
    const token = (this.config.get<string>('COOLIFY_API_TOKEN') ?? '').trim();

    if (!baseURL) {
      throw new Error('COOLIFY_BASE_URL is missing in .env');
    }
    if (!token) {
      throw new Error('COOLIFY_API_TOKEN is missing in .env');
    }

    this.http = axios.create({
      baseURL,
      timeout: 20_000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  public async get<T>(path: string): Promise<T> {
    try {
      const res = await this.http.get<T>(path);
      return res.data;
    } catch (err) {
      throw this.wrapAxiosError(err, 'GET', path);
    }
  }

  public async post<T>(path: string, body?: unknown): Promise<T> {
    try {
      const res = await this.http.post<T>(path, body ?? {});
      return res.data;
    } catch (err) {
      throw this.wrapAxiosError(err, 'POST', path, body);
    }
  }

  public async patch<T>(path: string, body?: unknown): Promise<T> {
    try {
      const res = await this.http.patch<T>(path, body ?? {});
      return res.data;
    } catch (err) {
      throw this.wrapAxiosError(err, 'PATCH', path, body);
    }
  }

  public async delete<T>(path: string): Promise<T> {
    try {
      const res = await this.http.delete<T>(path);
      return res.data;
    } catch (err) {
      throw this.wrapAxiosError(err, 'DELETE', path);
    }
  }

  /**
   * Converts Axios errors into something extremely useful for debugging.
   * - Logs HTTP status
   * - Logs response body from Coolify
   * - Logs request payload (for POST/PATCH)
   * - Attaches structured info to the error object
   */
  private wrapAxiosError(
    err: unknown,
    method: CoolifyRequestMethod,
    path: string,
    body?: unknown,
  ): Error {
    if (axios.isAxiosError<unknown>(err)) {
      const status = err.response?.status;
      const data = err.response?.data;

      const message = `[Coolify ${method}] ${path} failed: HTTP ${status}`;

      // Log response context to make API failures diagnosable.
      this.logger.error(message);
      if (data !== undefined) {
        this.logger.error(
          `[Coolify ${method}] response body: ${
            JSON.stringify(this.redactForLog(data, path))
          }`,
        );
      }
      if (body !== undefined) {
        this.logger.error(
          `[Coolify ${method}] request body: ${
            JSON.stringify(this.redactForLog(body, path))
          }`,
        );
      }

      const enrichedError = err as ErrorWithCoolifyDetails;
      enrichedError.coolify = {
        status,
        data,
        method,
        path,
        body,
      };

      return enrichedError;
    }

    // Non-Axios error
    return err instanceof Error ? err : new Error(String(err));
  }

  private redactForLog(value: unknown, path: string): unknown {
    if (typeof value === 'string') {
      return this.shouldRedactString(path) ? '[REDACTED]' : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactForLog(item, path));
    }

    if (!this.isRecord(value)) {
      return value;
    }

    const normalizedPath = path.toLowerCase();
    const isEnvPayload =
      normalizedPath.includes('/envs') &&
      typeof value.key === 'string' &&
      Object.prototype.hasOwnProperty.call(value, 'value');
    const envKey =
      typeof value.key === 'string' ? value.key.toLowerCase() : undefined;

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const shouldRedact =
          CoolifyClient.sensitiveKeyPattern.test(key) ||
          (isEnvPayload && (key === 'value' || key === 'real_value')) ||
          (envKey !== undefined &&
            key === 'value' &&
            CoolifyClient.sensitiveKeyPattern.test(envKey));

        if (shouldRedact) {
          return [key, '[REDACTED]'];
        }

        return [key, this.redactForLog(nestedValue, path)];
      }),
    );
  }

  private shouldRedactString(path: string): boolean {
    return path.toLowerCase().includes('/envs');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
