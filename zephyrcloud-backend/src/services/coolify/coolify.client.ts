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
            typeof data === 'string' ? data : JSON.stringify(data)
          }`,
        );
      }
      if (body !== undefined) {
        this.logger.error(
          `[Coolify ${method}] request body: ${
            typeof body === 'string' ? body : JSON.stringify(body)
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
}
