import axios from 'axios';

import {
  DomainRoutingMode,
  DomainStatus,
  type Domain,
  type Site,
} from '@prisma/client';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CoolifyService,
  type CoolifyResourceType,
} from '../../services/coolify/coolify.service';
import { DomainVerificationService } from './domain-verification.service';

type DomainWithSite = Domain & {
  site: Site | null;
};

@Injectable()
export class DomainAutomationService {
  private readonly logger = new Logger(DomainAutomationService.name);
  private readonly verifyTimeoutMs: number;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly coolify: CoolifyService,
    private readonly verifier: DomainVerificationService,
  ) {
    const timeoutMinutes = Number.parseInt(
      process.env.DOMAIN_VERIFY_TIMEOUT_MINUTES ?? '120',
      10,
    );
    this.verifyTimeoutMs =
      (Number.isFinite(timeoutMinutes) ? timeoutMinutes : 120) * 60_000;
  }

  @Cron('0 * * * * *')
  public async runScheduledChecks(): Promise<void> {
    await this.processPendingDomains();
    await this.processAttachingDomains();
  }

  public async verifyNow(siteId: bigint, domainId: bigint): Promise<Domain> {
    const domain = await this.getDomainWithSite(domainId, siteId);
    if (!domain.site) {
      throw new NotFoundException('Domain is no longer attached to a site');
    }

    return this.verifyDomain(domain);
  }

  public async retryDomain(siteId: bigint, domainId: bigint): Promise<Domain> {
    const domain = await this.getDomainWithSite(domainId, siteId);

    const resetDomain = await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: DomainStatus.pending_dns,
        verification_started_at: new Date(),
        verification_checked_at: null,
        verified_at: null,
        coolify_attached_at: null,
        ssl_ready_at: null,
        diagnostic_message: null,
        retry_count: { increment: 1 },
        ssl_enabled: false,
      },
      include: { site: true },
    });
    return this.verifyDomain(resetDomain);
  }

  public async processPendingDomains(): Promise<void> {
    const rows = await this.prisma.domain.findMany({
      where: {
        status: DomainStatus.pending_dns,
      },
      include: { site: true },
    });

    for (const row of rows) {
      await this.verifyDomain(row).catch((error) => {
        this.logger.warn(
          `[processPendingDomains] ${row.domain}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }
  }

  public async processAttachingDomains(): Promise<void> {
    const rows = await this.prisma.domain.findMany({
      where: {
        status: {
          in: [DomainStatus.attaching, DomainStatus.ssl_issuing],
        },
      },
      include: { site: true },
    });

    for (const row of rows) {
      await this.refreshAttachedDomain(row).catch((error) => {
        this.logger.warn(
          `[processAttachingDomains] ${row.domain}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }
  }

  private async verifyDomain(domain: DomainWithSite): Promise<Domain> {
    if (!domain.site) {
      throw new NotFoundException('Domain is no longer attached to a site');
    }

    const startedAt =
      domain.verification_started_at ?? domain.created_at ?? new Date();
    if (Date.now() - startedAt.getTime() >= this.verifyTimeoutMs) {
      return this.failTimeout(domain.id);
    }

    const expectedTarget = this.resolveVerificationTarget(domain);
    if (!expectedTarget) {
      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.error,
          diagnostic_message: 'Site is missing a default domain target.',
          verification_checked_at: new Date(),
        },
      });
    }

    const result = await this.verifier.verify(domain.domain, expectedTarget);
    const baseUpdate = {
      verification_checked_at: new Date(),
      routing_mode: result.routingMode as DomainRoutingMode,
      target_hostname: expectedTarget,
      diagnostic_message: result.message,
    };

    if (!result.ok) {
      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          ...baseUpdate,
          status: DomainStatus.pending_dns,
        },
      });
    }

    await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        ...baseUpdate,
        status: DomainStatus.verified_dns,
        verified_at: new Date(),
      },
    });

    return this.attachVerifiedDomain(domain, expectedTarget);
  }

  private async attachVerifiedDomain(
    domain: DomainWithSite,
    expectedTarget: string,
  ): Promise<Domain> {
    if (!domain.site?.coolify_resource_id) {
      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.error,
          diagnostic_message: 'Site is not ready for domain attachment yet.',
          verification_checked_at: new Date(),
        },
      });
    }

    let syncResult: Awaited<ReturnType<CoolifyService['addDomain']>>;
    try {
      syncResult = await this.coolify.addDomain(
        this.getResourceType(domain.site),
        domain.site.coolify_resource_id,
        `https://${domain.domain}`,
        { restartAfterUpdate: true },
      );
    } catch (error) {
      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.error,
          diagnostic_message: `Domain attach failed: ${error instanceof Error ? error.message : String(error)}`,
          verification_checked_at: new Date(),
        },
      });
    }

    await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: DomainStatus.attaching,
        coolify_attached_at: new Date(),
        target_hostname: expectedTarget,
        diagnostic_message: this.buildAttachMessage(syncResult),
      },
    });

    return this.refreshAttachedDomain(
      await this.getDomainWithSite(domain.id, domain.site.id),
    );
  }

  private async refreshAttachedDomain(domain: DomainWithSite): Promise<Domain> {
    const startedAt =
      domain.verification_started_at ?? domain.created_at ?? new Date();
    if (Date.now() - startedAt.getTime() >= this.verifyTimeoutMs) {
      return this.failTimeout(domain.id);
    }

    if (!domain.site?.coolify_resource_id) {
      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.error,
          diagnostic_message: 'Site is not ready for domain attachment yet.',
          verification_checked_at: new Date(),
        },
      });
    }

    const resourceType = this.getResourceType(domain.site);
    const normalizedExpected = this.normalizeDomain(domain.domain);
    const hasCoolifyDomain =
      resourceType === 'service'
        ? Boolean(domain.coolify_attached_at)
        : (
            await this.coolify.getResourceDomains(
              resourceType,
              domain.site.coolify_resource_id,
            )
          ).some((value) => this.normalizeDomain(value) === normalizedExpected);

    if (!hasCoolifyDomain) {
      let syncResult: Awaited<ReturnType<CoolifyService['addDomain']>>;
      try {
        syncResult = await this.coolify.addDomain(
          resourceType,
          domain.site.coolify_resource_id,
          `https://${domain.domain}`,
          { restartAfterUpdate: true },
        );
      } catch (error) {
        return this.prisma.domain.update({
          where: { id: domain.id },
          data: {
            status: DomainStatus.error,
            diagnostic_message: `Domain attach failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            verification_checked_at: new Date(),
          },
        });
      }

      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.attaching,
          verification_checked_at: new Date(),
          diagnostic_message: this.buildAttachMessage(syncResult),
        },
      });
    }

    const isReady = await this.checkHttps(domain.domain);
    if (isReady) {
      return this.prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.active,
          ssl_enabled: true,
          ssl_ready_at: new Date(),
          verification_checked_at: new Date(),
          diagnostic_message:
            'Domain is reachable over HTTPS and SSL is active.',
        },
      });
    }

    return this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: DomainStatus.ssl_issuing,
        ssl_enabled: false,
        verification_checked_at: new Date(),
        diagnostic_message:
          'DNS is verified and Coolify is still issuing SSL for this domain.',
      },
    });
  }

  private normalizeDomain(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
  }

  private getHostCnameTarget(): string | null {
    const value = (process.env.HOST_CNAME_TARGET ?? '').trim().toLowerCase();
    return value ? value.replace(/\.$/, '') : null;
  }

  private resolveVerificationTarget(domain: DomainWithSite): string | null {
    const hostTarget = this.getHostCnameTarget();
    if (hostTarget) {
      return hostTarget;
    }

    return domain.target_hostname ?? domain.site?.default_domain_target ?? null;
  }

  private buildAttachMessage(
    result: Awaited<ReturnType<CoolifyService['addDomain']>>,
  ): string {
    if (result.updated && result.restarted) {
      return 'DNS verified. Domain updated and restart queued.';
    }
    if (result.updated) {
      return 'DNS verified. Domain updated.';
    }
    if (result.restarted) {
      return 'DNS verified. Restart queued for the attached domain.';
    }
    return 'DNS verified. Waiting for the domain to attach.';
  }

  private async checkHttps(domain: string): Promise<boolean> {
    try {
      const response = await axios.get(`https://${domain}`, {
        timeout: 10_000,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      return response.status > 0;
    } catch {
      return false;
    }
  }

  private async failTimeout(domainId: bigint): Promise<Domain> {
    return this.prisma.domain.update({
      where: { id: domainId },
      data: {
        status: DomainStatus.verification_failed_timeout,
        diagnostic_message:
          'DNS verification did not succeed within 2 hours. Update DNS and retry.',
        verification_checked_at: new Date(),
      },
    });
  }

  private async getDomainWithSite(
    domainId: bigint,
    siteId: bigint,
  ): Promise<DomainWithSite> {
    const domain = await this.prisma.domain.findFirst({
      where: {
        id: domainId,
        site_id: siteId,
      },
      include: { site: true },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return domain;
  }

  private getResourceType(site: Site): CoolifyResourceType {
    if (site.coolify_resource_type === 'service') return 'service';
    if (site.coolify_resource_type === 'database') return 'database';
    return 'application';
  }
}
