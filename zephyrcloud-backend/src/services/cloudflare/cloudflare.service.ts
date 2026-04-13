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
    const token = (this.config.get<string>('CLOUDFLARE_API_TOKEN') ?? '').trim();
    this.zoneId = (this.config.get<string>('CLOUDFLARE_ZONE_ID') ?? '').trim();

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public ensureConfig(): void {
    const token = (
      this.config.get<string>('CLOUDFLARE_API_TOKEN') ?? ''
    ).trim();
    if (!token) {
      throw new Error('CLOUDFLARE_API_TOKEN is missing in .env');
    }
    if (!this.zoneId) {
      throw new Error('CLOUDFLARE_ZONE_ID is missing in .env');
    }
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
    >(`/zones/${this.zoneId}/dns_records`, payload);

    if (!data.success || !data.result?.id) {
      throw new Error(this.formatError(data.errors, 'Failed to create DNS record in Cloudflare.'));
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
    >(`/zones/${this.zoneId}/dns_records/${recordId}`);

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
}
