import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

type CloudflareRecordResponse = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: T;
};

@Injectable()
export class CloudflareDnsService {
  private readonly logger = new Logger(CloudflareDnsService.name);
  private readonly client: AxiosInstance;
  private readonly zoneId: string;

  public constructor(private readonly config: ConfigService) {
    this.zoneId = this.getEnv('CLOUDFLARE_ZONE_ID');

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public ensureConfig(): void {
    const token = this.getEnv('CLOUDFLARE_API_TOKEN');
    const apiKey = this.getEnv('CLOUDFLARE_API_KEY');
    const email = this.getEnv('CLOUDFLARE_EMAIL');
    const hasToken = Boolean(token);
    const hasKeyAuth = Boolean(apiKey && email);
    if (!hasToken && !hasKeyAuth) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN or (CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL) is required.',
      );
    }
    if (!this.zoneId) {
      throw new Error('CLOUDFLARE_ZONE_ID is missing in .env');
    }
  }

  private buildAuthHeaders(): Record<string, string> {
    const token = this.getEnv('CLOUDFLARE_API_TOKEN');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }

    const apiKey = this.getEnv('CLOUDFLARE_API_KEY');
    const email = this.getEnv('CLOUDFLARE_EMAIL');
    if (apiKey && email) {
      return {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
      };
    }

    return {};
  }

  private getEnv(key: string): string {
    const fromConfig = (this.config.get<string>(key) ?? '').trim();
    if (fromConfig) return fromConfig;
    return (process.env[key] ?? '').trim();
  }

  public async createSiteHostnameRecord(
    fqdn: string,
    target: string,
  ): Promise<{ recordId: string }> {
    this.ensureConfig();

    const payload = {
      type: 'CNAME',
      name: fqdn,
      content: target,
      ttl: 1,
      proxied: false,
    };

    const { data } = await this.client.post<
      CloudflareEnvelope<CloudflareRecordResponse>
    >(`/zones/${this.zoneId}/dns_records`, payload, {
      headers: this.buildAuthHeaders(),
    });

    if (!data.success || !data.result?.id) {
      if (this.isAuthError(data.errors)) {
        const verified = await this.verifyToken();
        if (verified) {
          throw new Error(
            'Cloudflare token is valid but lacks DNS edit permissions for this zone.',
          );
        }
      }
      throw new Error(
        this.formatError(
          data.errors,
          'Failed to create DNS record in Cloudflare.',
        ),
      );
    }

    this.logger.log(
      `[createSiteHostnameRecord] Created CNAME ${fqdn} -> ${target} (${data.result.id})`,
    );

    return { recordId: data.result.id };
  }

  public async getRecord(recordId: string): Promise<CloudflareRecordResponse> {
    this.ensureConfig();

    const { data } = await this.client.get<
      CloudflareEnvelope<CloudflareRecordResponse>
    >(`/zones/${this.zoneId}/dns_records/${recordId}`, {
      headers: this.buildAuthHeaders(),
    });

    if (!data.success || !data.result) {
      throw new Error(
        this.formatError(data.errors, `Failed to fetch Cloudflare DNS record ${recordId}.`),
      );
    }

    return data.result;
  }

  public async deleteRecord(recordId: string): Promise<void> {
    this.ensureConfig();

    const { data } = await this.client.delete<CloudflareEnvelope<{ id: string }>>(
      `/zones/${this.zoneId}/dns_records/${recordId}`,
      { headers: this.buildAuthHeaders() },
    );

    if (!data.success) {
      throw new Error(
        this.formatError(data.errors, `Failed to delete Cloudflare DNS record ${recordId}.`),
      );
    }

    this.logger.log(`[deleteRecord] Deleted Cloudflare DNS record ${recordId}`);
  }

  private formatError(
    errors: Array<{ message?: string }> | undefined,
    fallback: string,
  ): string {
    const message = errors?.map((entry) => entry.message).find(Boolean);
    return message ? String(message) : fallback;
  }

  private isAuthError(errors: Array<{ message?: string; code?: number }> | undefined): boolean {
    return Boolean(errors?.some((error) => error.code === 10000));
  }

  private async verifyToken(): Promise<boolean> {
    const token = this.getEnv('CLOUDFLARE_API_TOKEN');
    if (!token) return false;
    try {
      const { data } = await this.client.get<
        CloudflareEnvelope<{ status: string }>
      >('/user/tokens/verify', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }
}
