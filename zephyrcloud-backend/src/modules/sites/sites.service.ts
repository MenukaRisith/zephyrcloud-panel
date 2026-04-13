import crypto from 'crypto';
import * as sshpk from 'sshpk';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  DomainStatus,
  PrismaClient,
  SubscriptionPlan,
  type Site,
  type Domain,
  type SiteDatabase,
  type SiteDeployKey,
  type UserDatabase,
  SiteMemberRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantPlanResources } from '../../common/plans/tenant-plan';
import type { JwtPayload } from '../../common/types/auth.types';
import { GithubService } from '../github/github.service';
import {
  CoolifyService,
  type CoolifyResourceType,
  type CoolifyDbDetails,
  type ManagedDatabaseEngine,
} from '../../services/coolify/coolify.service';
import { CloudflareDnsService } from '../../services/cloudflare/cloudflare.service';
import { SiteTypeDto, type CreateSiteDto } from './dto/create-site.dto';
import type { CreateDeployKeyDto } from './dto/create-deploy-key.dto';
import type { AddDomainDto } from './dto/add-domain.dto';
import type { CreateSiteDatabaseDto } from './dto/create-site-database.dto';
import type { AddSiteMemberDto } from './dto/add-site-member.dto';
import type { CreateUserDatabaseDto } from './dto/create-user-database.dto';
import { DomainAutomationService } from './domain-automation.service';
import { DomainVerificationService } from './domain-verification.service';

// --- Helpers ---

function toBigIntStrict(id: string, fieldName = 'id'): bigint {
  try {
    return BigInt(id);
  } catch {
    throw new ForbiddenException(`${fieldName} must be a valid integer string`);
  }
}

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function rand(bytes = 18): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a safe service name for Docker containers.
 */
function safeSvc(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function safeDatabaseIdentifier(name: string, maxLength = 32): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, maxLength) || 'workspace';
}

function toTeamRole(role?: string): SiteMemberRole {
  return role === 'editor' ? SiteMemberRole.editor : SiteMemberRole.viewer;
}

function normalizeGithubAppSelection(
  value?: string | null,
): string | undefined {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '0') return undefined;
  return normalized;
}

function isGithubOwnerRepo(value: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

// --- DTO / Payload Types ---

type SitePayload = Site;
type DomainPayload = Domain;
type DeploymentPayload = {
  id: string;
  site_id: string;
  status: string;
  triggered_by: string;
  commit_message: string | null;
  commit_hash: string | null;
  created_at: Date;
  updated_at: Date;
};
type SiteDatabasePayload = SiteDatabase;
type UserDatabasePayload = UserDatabase;
type SiteDeployKeyPayload = SiteDeployKey;
type CoolifyCreateProjectInput = Parameters<CoolifyService['createProject']>[0];
type CoolifyCreateProjectResult = Awaited<
  ReturnType<CoolifyService['createProject']>
>;
type SiteTeamMemberPayload = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'viewer' | 'editor';
  created_at: Date;
};
type SiteTeamInvitePayload = {
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted' | 'revoked';
  created_at: Date;
};
type SiteTeamPayload = {
  can_write: boolean;
  members: SiteTeamMemberPayload[];
  invites: SiteTeamInvitePayload[];
};

type TenantPolicyPayload = {
  id: bigint;
  plan: SubscriptionPlan;
  max_sites: number | null;
  max_cpu_per_site: number | null;
  max_memory_mb_per_site: number | null;
  max_team_members_per_site: number | null;
};

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly coolify: CoolifyService,
    private readonly github: GithubService,
    private readonly cloudflare: CloudflareDnsService,
    private readonly domainAutomation: DomainAutomationService,
    private readonly domainVerifier: DomainVerificationService,
  ) {}

  private getHostBaseDomain(): string {
    const value = (process.env.HOST_BASE_DOMAIN ?? '').trim().toLowerCase();
    if (!value) {
      throw new Error('HOST_BASE_DOMAIN is missing in .env');
    }
    return value.replace(/\.$/, '');
  }

  private getHostCnameTarget(): string {
    const value = (process.env.HOST_CNAME_TARGET ?? '').trim().toLowerCase();
    if (!value) {
      throw new Error('HOST_CNAME_TARGET is missing in .env');
    }
    return value.replace(/\.$/, '');
  }

  private buildDefaultDomainTarget(siteId: bigint): string {
    const prefix = (process.env.HOSTNAME_PREFIX ?? 'site')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'site';
    return `${prefix}-${siteId.toString()}.${this.getHostBaseDomain()}`;
  }

  private buildInitialDomainInstructions(
    domain: string,
    target: string,
    routingMode: 'subdomain_cname' | 'apex_flattening' | 'apex_alias',
  ): string {
    if (routingMode === 'apex_alias') {
      return `Point ${domain} to ${target} using an ALIAS or ANAME record, then click Verify.`;
    }

    return `Point ${domain} to ${target} using a CNAME record, then click Verify.`;
  }

  private async getTenantPolicyOrThrow(
    tenantId: bigint,
  ): Promise<TenantPolicyPayload> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        max_sites: true,
        max_cpu_per_site: true,
        max_memory_mb_per_site: true,
        max_team_members_per_site: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  private async enforceTenantSiteLimit(
    tenantId: bigint,
    tenantPolicy: TenantPolicyPayload,
  ): Promise<void> {
    const resources = resolveTenantPlanResources(tenantPolicy);
    const siteCount = await this.prisma.site.count({
      where: { tenant_id: tenantId },
    });

    if (siteCount >= resources.maxSites) {
      throw new ForbiddenException(
        `This tenant has reached its site limit (${resources.maxSites}).`,
      );
    }
  }

  private resolveRequestedSiteResources(
    tenantPolicy: TenantPolicyPayload,
    dto: CreateSiteDto,
  ): { cpuLimit: number; memoryMb: number } {
    const resources = resolveTenantPlanResources(tenantPolicy);
    const requestedCpu =
      typeof dto.cpu_limit === 'number' && Number.isFinite(dto.cpu_limit)
        ? dto.cpu_limit
        : Math.min(1, resources.maxCpuPerSite);
    const requestedMemory =
      typeof dto.memory_mb === 'number' && Number.isFinite(dto.memory_mb)
        ? dto.memory_mb
        : Math.min(512, resources.maxMemoryMbPerSite);

    if (requestedCpu <= 0 || requestedCpu > resources.maxCpuPerSite) {
      throw new BadRequestException(
        `CPU must be between 0.1 and ${resources.maxCpuPerSite} for this tenant.`,
      );
    }

    if (
      requestedMemory < 128 ||
      requestedMemory > resources.maxMemoryMbPerSite
    ) {
      throw new BadRequestException(
        `Memory must be between 128MB and ${resources.maxMemoryMbPerSite}MB for this tenant.`,
      );
    }

    return {
      cpuLimit: requestedCpu,
      memoryMb: Math.trunc(requestedMemory),
    };
  }

  // -------------------------
  // Ownership / Tenant Helpers
  // -------------------------

  private requireTenantId(user: JwtPayload): bigint {
    if (!user.tenant_id) throw new ForbiddenException('No tenant assigned');
    return toBigIntStrict(user.tenant_id, 'tenant_id');
  }

  private requireUserId(user: JwtPayload): bigint {
    return toBigIntStrict(user.sub, 'user_id');
  }

  private async getOwnedSiteOrThrow(
    siteId: bigint,
    user: JwtPayload,
    options?: { requireWrite?: boolean },
  ): Promise<SitePayload> {
    if (user.role === 'admin') {
      const site = await this.prisma.site.findUnique({ where: { id: siteId } });
      if (!site) throw new NotFoundException('Site not found');
      return site;
    }

    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');

    const tenantId = user.tenant_id
      ? toBigIntStrict(user.tenant_id, 'tenant_id')
      : null;
    const isTenantOwner = tenantId !== null && tenantId === site.tenant_id;
    if (isTenantOwner) return site;

    const userId = this.requireUserId(user);
    const member = await this.prisma.siteMember.findUnique({
      where: {
        site_id_user_id: {
          site_id: siteId,
          user_id: userId,
        },
      },
      select: { role: true },
    });

    if (!member) throw new NotFoundException('Site not found');
    if (options?.requireWrite && member.role !== SiteMemberRole.editor) {
      throw new ForbiddenException('You do not have write access to this site');
    }

    return site;
  }

  public async listSites(user: JwtPayload): Promise<SitePayload[]> {
    if (user.role === 'admin') {
      const sites = await this.prisma.site.findMany({
        include: { domains: true },
        orderBy: { created_at: 'desc' },
      });
      return Promise.all(sites.map((site) => this.refreshLiveSiteRecord(site)));
    }

    const userId = this.requireUserId(user);
    const tenantId = user.tenant_id
      ? toBigIntStrict(user.tenant_id, 'tenant_id')
      : null;

    const where = tenantId
      ? {
          OR: [
            { tenant_id: tenantId },
            {
              members: {
                some: { user_id: userId },
              },
            },
          ],
        }
      : {
          members: {
            some: { user_id: userId },
          },
        };

    const sites = await this.prisma.site.findMany({
      where,
      include: { domains: true },
      orderBy: { created_at: 'desc' },
    });
    return Promise.all(sites.map((site) => this.refreshLiveSiteRecord(site)));
  }

  public async deleteSitesByName(user: JwtPayload, name: string) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can delete sites by name.');
    }

    if (!user.tenant_id) {
      throw new ForbiddenException('Tenant is required to delete sites by name.');
    }
    const tenantId = toBigIntStrict(user.tenant_id, 'tenant_id');
    const sites = await this.prisma.site.findMany({
      where: { tenant_id: tenantId, name },
      select: { id: true },
    });
    if (!sites.length) {
      return { deleted_sites: 0, deleted_domains: 0 };
    }

    const siteIds = sites.map((site) => site.id);
    const [domainsResult, sitesResult] = await this.prisma.$transaction([
      this.prisma.domain.deleteMany({ where: { site_id: { in: siteIds } } }),
      this.prisma.site.deleteMany({ where: { id: { in: siteIds } } }),
    ]);

    return {
      deleted_sites: sitesResult.count,
      deleted_domains: domainsResult.count,
    };
  }

  public async deleteSite(user: JwtPayload, id: string) {
    const siteId = toBigIntStrict(id);
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    const cloudflareRecordId = site.cloudflare_dns_record_id;
    const [domainsResult, sitesResult] = await this.prisma.$transaction([
      this.prisma.domain.deleteMany({ where: { site_id: siteId } }),
      this.prisma.site.deleteMany({ where: { id: siteId } }),
    ]);

    if (cloudflareRecordId) {
      await this.cloudflare.deleteRecord(cloudflareRecordId).catch((error) => {
        this.logger.warn(
          `[deleteSite] Failed to remove Cloudflare DNS record ${cloudflareRecordId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }

    return {
      deleted_sites: sitesResult.count,
      deleted_domains: domainsResult.count,
    };
  }

  // -------------------------
  // Git Helpers
  // -------------------------

  private extractGithubRepositoryRef(input: string): string | null {
    const v = String(input || '').trim();
    if (!v) return null;

    const simple = v.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (simple) return `${simple[1]}/${simple[2]}`;

    const https = v.match(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/i,
    );
    if (https) {
      const repo = https[2].replace(/\.git$/i, '');
      if (repo) return `${https[1]}/${repo}`;
    }

    const ssh = v.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
    if (ssh) {
      const repo = ssh[2].replace(/\.git$/i, '');
      if (repo) return `${ssh[1]}/${repo}`;
    }

    this.logger.warn(
      `[extractGithubRepositoryRef] Could not parse owner/repo from: "${v}"`,
    );
    return null;
  }

  private normalizeGitRepositoryForCoolify(input: string): string | null {
    const repoRef = this.extractGithubRepositoryRef(input);
    if (!repoRef) return null;
    return `https://github.com/${repoRef}.git`;
  }

  private normalizePrivateGitRepositoryForCoolify(
    input: string,
  ): string | null {
    const repoRef = this.extractGithubRepositoryRef(input);
    if (!repoRef) return null;
    return `git@github.com:${repoRef}.git`;
  }

  private requireAdminForPrivateGithubApp(user: JwtPayload) {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Private GitHub app connections are only available to administrators.',
      );
    }
  }

  private async getAvailableDeployKeyOrThrow(
    tenantId: bigint,
    userId: bigint,
    coolifyKeyUuid: string,
  ): Promise<SiteDeployKeyPayload> {
    const deployKey = await this.prisma.siteDeployKey.findFirst({
      where: {
        tenant_id: tenantId,
        created_by_user_id: userId,
        coolify_key_uuid: coolifyKeyUuid,
        site_id: null,
      },
    });

    if (!deployKey) {
      throw new ForbiddenException(
        'Deploy key not found or no longer available for this tenant.',
      );
    }

    return deployKey;
  }

  private normalizeCoolifyStatus(
    raw: string | undefined | null,
  ): Site['status'] {
    const s = String(raw ?? '')
      .toLowerCase()
      .trim();

    if (s.includes('running') || s.includes('healthy') || s === 'up')
      return 'running';
    if (
      s.includes('stopped') ||
      s.includes('down') ||
      s.includes('exited') ||
      s.includes('removed')
    )
      return 'stopped';
    if (
      s.includes('error') ||
      s.includes('failed') ||
      s.includes('unhealthy') ||
      s.includes('crash')
    )
      return 'error';
    if (
      s.includes('build') ||
      s.includes('deploy') ||
      s.includes('progress') ||
      s.includes('queued') ||
      s.includes('pull')
    )
      return 'building';
    if (
      s.includes('provision') ||
      s.includes('restart') ||
      s.includes('prepar') ||
      s.includes('starting') ||
      s.includes('pending') ||
      s.includes('creat')
    )
      return 'provisioning';

    return 'provisioning';
  }

  private async refreshLiveSiteRecord<T extends SitePayload>(
    site: T,
  ): Promise<T> {
    if (!site.coolify_resource_id) {
      return site;
    }

    const live = await this.coolify.getResourceStatus({
      resourceId: site.coolify_resource_id,
      resourceType: this.getResourceType(site),
    });

    if (!live.found) {
      return site;
    }

    const normalized = this.normalizeCoolifyStatus(live.status);
    if (normalized === site.status) {
      return site;
    }

    await this.prisma.site.update({
      where: { id: site.id },
      data: { status: normalized },
    });

    return {
      ...site,
      status: normalized,
    };
  }

  // -------------------------
  // Create Site
  // -------------------------

  private async createDeployKeyRecord(
    user: JwtPayload,
    dto: CreateDeployKeyDto,
  ): Promise<SiteDeployKeyPayload> {
    const tenantId = this.requireTenantId(user);
    const userId = this.requireUserId(user);
    const siteName = String(dto.site_name ?? '').trim() || 'private-node-app';
    const repoFullName = dto.repo_url
      ? this.extractGithubRepositoryRef(dto.repo_url)
      : null;

    if (dto.repo_url && !repoFullName) {
      throw new BadRequestException(
        'Only GitHub repositories in owner/repo or GitHub URL format are supported.',
      );
    }

    const privateKey = sshpk.generatePrivateKey('ed25519');
    const privateKeyValue = privateKey.toString('openssh');
    const publicKeyValue = privateKey.toPublic().toString('ssh');
    const fingerprint = privateKey.toPublic().fingerprint('sha256').toString();
    const keyName = `${safeSvc(siteName)}-${rand(4)}`;
    const description = repoFullName
      ? `Tenant ${tenantId.toString()} deploy key for ${repoFullName}`
      : `Tenant ${tenantId.toString()} deploy key for private repository access`;

    const created = await this.coolify.createPrivateKey({
      name: keyName,
      description,
      private_key: privateKeyValue,
      is_git_related: true,
    });

    try {
      return await this.prisma.siteDeployKey.create({
        data: {
          tenant_id: tenantId,
          created_by_user_id: userId,
          coolify_key_uuid: created.uuid,
          name: keyName,
          description,
          public_key: publicKeyValue,
          fingerprint,
          github_repo_full_name: repoFullName,
        },
      });
    } catch (error) {
      await this.coolify.deletePrivateKey(created.uuid).catch(() => {});
      throw error;
    }
  }

  private async cleanupAutoProvisionedDeployKey(
    user: JwtPayload,
    deployKeyRecord: SiteDeployKeyPayload,
  ): Promise<void> {
    if (
      deployKeyRecord.github_repo_full_name &&
      typeof deployKeyRecord.github_deploy_key_id === 'number'
    ) {
      await this.github.removeRepositoryDeployKey(
        user,
        deployKeyRecord.github_repo_full_name,
        deployKeyRecord.github_deploy_key_id,
      );
    }

    await this.coolify
      .deletePrivateKey(deployKeyRecord.coolify_key_uuid)
      .catch(() => {});

    await this.prisma.siteDeployKey
      .delete({
        where: { id: deployKeyRecord.id },
      })
      .catch(() => {});
  }

  public async createDeployKey(
    user: JwtPayload,
    dto: CreateDeployKeyDto,
  ): Promise<{
    uuid: string;
    public_key: string;
    fingerprint: string;
    repo_full_name: string | null;
  }> {
    const deployKey = await this.createDeployKeyRecord(user, dto);

    return {
      uuid: deployKey.coolify_key_uuid,
      public_key: deployKey.public_key,
      fingerprint: deployKey.fingerprint ?? '',
      repo_full_name: deployKey.github_repo_full_name,
    };
  }

  public async createSite(
    user: JwtPayload,
    dto: CreateSiteDto,
  ): Promise<SitePayload> {
    this.cloudflare.ensureConfig();
    const hostCnameTarget = this.getHostCnameTarget();
    const tenantId = this.requireTenantId(user);
    const userId = this.requireUserId(user);
    const tenantPolicy = await this.getTenantPolicyOrThrow(tenantId);
    await this.enforceTenantSiteLimit(tenantId, tenantPolicy);
    const { cpuLimit, memoryMb } = this.resolveRequestedSiteResources(
      tenantPolicy,
      dto,
    );
    this.logger.debug(
      `[createSite] Starting creation for ${dto.name} (tenant: ${tenantId})`,
    );

    if (
      dto.type !== SiteTypeDto.wordpress &&
      dto.type !== SiteTypeDto.node &&
      dto.type !== SiteTypeDto.static &&
      dto.type !== SiteTypeDto.php &&
      dto.type !== SiteTypeDto.python
    ) {
      throw new ForbiddenException('That site type is not enabled right now.');
    }

    const requestedPrivateKeyUuid =
      String(dto.private_key_uuid ?? '').trim() || undefined;
    const usesGithubConnection = Boolean(dto.use_github_connection);
    let privateKeyUuid = requestedPrivateKeyUuid;
    const usesPrivateDeployKey =
      Boolean(privateKeyUuid) || usesGithubConnection;
    const repoForCoolify = dto.repo_url
      ? usesPrivateDeployKey
        ? this.normalizePrivateGitRepositoryForCoolify(dto.repo_url)
        : this.normalizeGitRepositoryForCoolify(dto.repo_url)
      : null;
    const repoFullName = dto.repo_url
      ? this.extractGithubRepositoryRef(dto.repo_url)
      : null;
    const githubAppId = normalizeGithubAppSelection(dto.github_app_id);
    const requiresRepository = dto.type !== SiteTypeDto.wordpress;
    const siteName = dto.name.trim();

    if (!siteName) {
      throw new BadRequestException('Site name is required.');
    }

    if (dto.repo_url && !repoForCoolify) {
      throw new BadRequestException(
        usesPrivateDeployKey
          ? 'Private repositories must be valid GitHub repositories. SSH, HTTPS, and owner/repo formats are supported.'
          : 'Only GitHub repositories in owner/repo or GitHub URL format are supported.',
      );
    }

    if (githubAppId) {
      this.requireAdminForPrivateGithubApp(user);
    }

    if (githubAppId && usesPrivateDeployKey) {
      throw new BadRequestException(
        'Choose either a GitHub App connection or a private deploy key, not both.',
      );
    }

    if (usesGithubConnection && requestedPrivateKeyUuid) {
      throw new BadRequestException(
        'Choose either a connected GitHub account or a manual deploy key, not both.',
      );
    }

    if (requiresRepository && !repoForCoolify) {
      throw new BadRequestException(
        dto.type === SiteTypeDto.static
          ? 'Static site creation requires a GitHub repository.'
          : dto.type === SiteTypeDto.php
            ? 'PHP site creation requires a GitHub repository.'
            : dto.type === SiteTypeDto.python
              ? 'Python app creation requires a GitHub repository.'
              : 'Node.js site creation requires a GitHub repository.',
      );
    }

    if (repoFullName && !isGithubOwnerRepo(repoFullName)) {
      throw new BadRequestException(
        'Repository must be a valid GitHub owner/repo pair.',
      );
    }

    let deployKeyRecord: SiteDeployKeyPayload | null = null;
    let shouldCleanupAutoProvisionedKey = false;

    let site: SitePayload | null = null;
    let cloudflareRecordId: string | null = null;
    try {
      if (usesGithubConnection) {
        if (!repoFullName) {
          throw new BadRequestException(
            'Connected GitHub automation requires a valid GitHub repository.',
          );
        }

        deployKeyRecord = await this.createDeployKeyRecord(user, {
          site_name: siteName,
          repo_url: repoFullName,
        });

        shouldCleanupAutoProvisionedKey = true;
        privateKeyUuid = deployKeyRecord.coolify_key_uuid;

        const githubDeployKey = await this.github.createRepositoryDeployKey(
          user,
          repoFullName,
          {
            title: deployKeyRecord.name,
            key: deployKeyRecord.public_key,
            read_only: true,
          },
        );

        deployKeyRecord = {
          ...deployKeyRecord,
          github_repo_full_name: repoFullName,
          github_deploy_key_id: githubDeployKey.id,
        };

        deployKeyRecord = await this.prisma.siteDeployKey.update({
          where: { id: deployKeyRecord.id },
          data: {
            github_repo_full_name: repoFullName,
            github_deploy_key_id: githubDeployKey.id,
          },
        });
      } else if (privateKeyUuid) {
        deployKeyRecord = await this.getAvailableDeployKeyOrThrow(
          tenantId,
          userId,
          privateKeyUuid,
        );
      }

      site = await this.prisma.site.create({
        data: {
          tenant_id: tenantId,
          name: siteName,
          type: dto.type,
          status: 'provisioning',
          cpu_limit: cpuLimit,
          memory_mb: memoryMb,
          repo_url: repoForCoolify,
          repo_branch: repoForCoolify ? dto.repo_branch || 'main' : null,
          auto_deploy:
            dto.auto_deploy ?? (requiresRepository && !usesPrivateDeployKey),
          coolify_project_id: null,
          coolify_resource_id: null,
          coolify_server_uuid: null,
          coolify_resource_type: null,
          coolify_destination_uuid: null,
          default_domain_target: null,
          cloudflare_dns_record_id: null,
          coolify_default_hostname: null,
        },
      });

      const defaultDomainTarget = this.buildDefaultDomainTarget(site.id);

      // 2. Prepare config and send to Coolify
      const coolifyPayload: CoolifyCreateProjectInput = {
        name: siteName,
        type: dto.type,
        cpu_limit: cpuLimit,
        memory_mb: memoryMb,
        auto_deploy:
          dto.auto_deploy ?? (requiresRepository && !usesPrivateDeployKey),
      };

      if (repoForCoolify) {
        coolifyPayload.repo_url = repoForCoolify;
        coolifyPayload.repo_branch = dto.repo_branch || 'main';
      }

      if (githubAppId) {
        coolifyPayload.github_app_id =
          await this.coolify.resolveGithubAppUuid(githubAppId);
      }

      if (privateKeyUuid) {
        coolifyPayload.private_key_uuid = privateKeyUuid;
      }

      let wpDb: CoolifyDbDetails | null = null;
      if (dto.type === SiteTypeDto.wordpress) {
        const rootPassword = rand(24);
        const safeName = safeSvc(dto.name);
        wpDb = {
          db_name: 'wordpress',
          username: 'root',
          password: rootPassword,
          root_password: rootPassword,
          host: `${safeName}-db`,
          port: 3306,
          engine: 'mariadb',
        };
        coolifyPayload.db = wpDb;
      }

      const coolifyResult: CoolifyCreateProjectResult =
        await this.coolify.createProject(coolifyPayload);

      // 3. Save Database Info for WordPress sites
      if (wpDb) {
        const finalDbHost = coolifyResult.dbHost || wpDb.host;
        const finalDbPassword = coolifyResult.dbPassword || wpDb.password;
        const finalDbUser = coolifyResult.dbUser || 'root';
        const finalDbName = coolifyResult.dbName || 'wordpress';

        await this.prisma.siteDatabase.create({
          data: {
            site_id: site.id,
            engine: 'mariadb',
            host: finalDbHost,
            port: 3306,
            db_name: finalDbName,
            username: finalDbUser,
            password: finalDbPassword,
          },
        });
      }

      // 4. Update Site with Coolify IDs
      const updatedSite = await this.prisma.site.update({
        where: { id: site.id },
        data: {
          coolify_project_id: coolifyResult.projectId,
          coolify_resource_id: coolifyResult.resourceId,
          coolify_resource_type: coolifyResult.resourceType || 'application',
          coolify_server_uuid: coolifyResult.serverUuid,
          coolify_destination_uuid: coolifyResult.destinationUuid,
          default_domain_target: defaultDomainTarget,
          coolify_default_hostname: defaultDomainTarget,
        },
      });

      const cloudflareRecord =
        await this.cloudflare.createSiteHostnameRecord(
          defaultDomainTarget,
          hostCnameTarget,
        );
      cloudflareRecordId = cloudflareRecord.recordId;

      await this.coolify.addDomain(
        this.getResourceType(updatedSite),
        coolifyResult.resourceId,
        `https://${defaultDomainTarget}`,
      );

      const finalizedSite = await this.prisma.site.update({
        where: { id: site.id },
        data: {
          cloudflare_dns_record_id: cloudflareRecord.recordId,
        },
      });

      if (deployKeyRecord) {
        await this.prisma.siteDeployKey.update({
          where: { id: deployKeyRecord.id },
          data: { site_id: site.id },
        });
      }

      return finalizedSite;
    } catch (error) {
      this.logger.error(
        `[createSite] Failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (cloudflareRecordId) {
        await this.cloudflare.deleteRecord(cloudflareRecordId).catch((cleanupError) => {
          this.logger.warn(
            `[createSite] Failed to clean up Cloudflare DNS record ${cloudflareRecordId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        });
      }

      if (site) {
        await this.prisma.site.update({
          where: { id: site.id },
          data: { status: 'error' },
        });
      }

      if (shouldCleanupAutoProvisionedKey && deployKeyRecord) {
        await this.cleanupAutoProvisionedDeployKey(user, deployKeyRecord);
      }

      throw error;
    }
  }

  // --- GitHub Proxy ---
  public async getGithubApps(user: JwtPayload) {
    if (user.role !== 'admin') {
      return [];
    }

    const apps = await this.coolify.getGithubApps();
    return apps.filter((app) => app.id > 0);
  }

  public getGithubRepos(
    user: JwtPayload,
    appUuid: string,
    page = 1,
    limit = 100,
  ) {
    this.requireAdminForPrivateGithubApp(user);
    return this.coolify.getGithubRepos(appUuid, page, limit);
  }

  public getGithubBranches(
    user: JwtPayload,
    appUuid: string,
    owner: string,
    repo: string,
  ) {
    this.requireAdminForPrivateGithubApp(user);
    return this.coolify.getGithubBranches(appUuid, owner, repo);
  }

  public createSiteDeployKey(user: JwtPayload, dto: CreateDeployKeyDto) {
    return this.createDeployKey(user, dto);
  }

  // --- Read Site ---
  public async getSite(user: JwtPayload, id: string): Promise<SitePayload> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user);
    return this.refreshLiveSiteRecord(site);
  }

  // --- Live Status Sync ---
  public async getLiveStatus(
    user: JwtPayload,
    id: string,
  ): Promise<{
    status: string;
    source: 'coolify' | 'db';
    raw?: unknown;
    updatedAt: string;
  }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.refreshLiveSiteRecord(
      await this.getOwnedSiteOrThrow(siteId, user),
    );

    if (!site.coolify_resource_id) {
      return {
        status: String(site.status).toUpperCase(),
        source: 'db',
        updatedAt: new Date().toISOString(),
      };
    }

    const type = this.getResourceType(site);
    const live = await this.coolify.getResourceStatus({
      resourceId: site.coolify_resource_id,
      resourceType: type,
    });

    if (!live.found) {
      return {
        status: String(site.status).toUpperCase(),
        source: 'db',
        updatedAt: new Date().toISOString(),
      };
    }

    const normalized = this.normalizeCoolifyStatus(live.status);

    if (normalized !== site.status) {
      await this.prisma.site.update({
        where: { id: site.id },
        data: { status: normalized },
      });
    }

    return {
      status: String(normalized).toUpperCase(),
      source: 'coolify',
      raw: live.raw,
      updatedAt: new Date().toISOString(),
    };
  }

  // --- Helper: Resource Type ---
  private getResourceType(site: SitePayload): CoolifyResourceType {
    if (site.coolify_resource_type === 'application') return 'application';
    if (site.coolify_resource_type === 'service') return 'service';
    if (site.coolify_resource_type === 'database') return 'database';
    return site.type === 'wordpress' ? 'application' : 'application';
  }

  // --- Deploy / Restart / Logs ---
  public async deploySite(
    user: JwtPayload,
    id: string,
    options?: { force?: boolean },
  ): Promise<{ ok: true }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id) {
      throw new ForbiddenException(
        'Site not provisioned yet (missing coolify_resource_id)',
      );
    }

    await this.prisma.deployment.create({
      data: {
        site_id: site.id,
        status: 'queued',
        triggered_by: 'user',
      },
    });

    const type = this.getResourceType(site);
    await this.coolify.deployResource(type, site.coolify_resource_id, {
      force: options?.force ?? false,
    });

    await this.prisma.site.update({
      where: { id: site.id },
      data: { status: 'provisioning' },
    });

    return { ok: true };
  }

  public async restartSite(
    user: JwtPayload,
    id: string,
  ): Promise<{ ok: true }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id) {
      throw new ForbiddenException('Site not provisioned yet');
    }

    const type = this.getResourceType(site);
    await this.coolify.restartResource(type, site.coolify_resource_id);

    await this.prisma.site.update({
      where: { id: site.id },
      data: { status: 'provisioning' },
    });

    return { ok: true };
  }

  public async startSite(user: JwtPayload, id: string): Promise<{ ok: true }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id) {
      throw new ForbiddenException('Site not provisioned yet');
    }

    const type = this.getResourceType(site);
    await this.coolify.startResource(type, site.coolify_resource_id);

    await this.prisma.site.update({
      where: { id: site.id },
      data: { status: 'provisioning' },
    });

    return { ok: true };
  }

  public async stopSite(user: JwtPayload, id: string): Promise<{ ok: true }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id) {
      throw new ForbiddenException('Site not provisioned yet');
    }

    const type = this.getResourceType(site);
    await this.coolify.stopResource(type, site.coolify_resource_id);

    await this.prisma.site.update({
      where: { id: site.id },
      data: { status: 'stopped' },
    });

    return { ok: true };
  }

  public async getLogs(
    user: JwtPayload,
    id: string,
    lines?: number,
  ): Promise<{
    logs: string;
    lines: number;
    updatedAt: string;
    source: string;
  }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id) {
      throw new ForbiddenException('Site not provisioned yet');
    }

    const requestedLines = lines || 200;
    const boundedLines = Math.min(
      5000,
      Math.max(10, Math.trunc(requestedLines)),
    );
    const type = this.getResourceType(site);

    try {
      const logs = await this.coolify.getLogs(
        type,
        site.coolify_resource_id,
        boundedLines,
      );
      return {
        logs,
        lines: boundedLines,
        updatedAt: new Date().toISOString(),
        source: 'coolify',
      };
    } catch (error) {
      return {
        logs: `Error fetching logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lines: boundedLines,
        updatedAt: new Date().toISOString(),
        source: 'error',
      };
    }
  }

  // --- Deployments History ---
  public async getDeployments(
    user: JwtPayload,
    id: string,
  ): Promise<DeploymentPayload[]> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user);

    let realDeploys: DeploymentPayload[] = [];
    if (site.coolify_resource_id) {
      try {
        const type = this.getResourceType(site);
        const coolifyDeploys = await this.coolify.getDeployments(
          site.coolify_resource_id,
          type,
        );

        if (coolifyDeploys.length > 0) {
          const latest = coolifyDeploys[0];
          const latestStatus = (latest.status || '').toLowerCase();
          const siteStatus = (site.status || '').toLowerCase();

          // Auto-sync status if deploy finished
          if (
            (latestStatus === 'finished' || latestStatus === 'success') &&
            siteStatus !== 'running'
          ) {
            // Double check live status to be sure
            const live = await this.getLiveStatus(user, id);
            if (live.status === 'RUNNING') {
              await this.prisma.site.update({
                where: { id: siteId },
                data: { status: 'running' },
              });
            }
          }
        }

        realDeploys = coolifyDeploys.map((d) => ({
          id: d.deployment_uuid || d.uuid || '0',
          site_id: site.id.toString(),
          status: this.mapCoolifyDeploymentStatus(d.status),
          triggered_by: d.is_webhook ? 'git_push' : 'manual',
          commit_message: d.commit_message || null,
          commit_hash: d.commit || d.commit_sha || null,
          created_at: new Date(d.created_at || d.updated_at || new Date()),
          updated_at: new Date(d.updated_at || new Date()),
        }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.debug(
          `[getDeployments] Failed to fetch from Coolify: ${msg}`,
        );
      }
    }

    if (realDeploys.length > 0) {
      return realDeploys;
    }

    const localDeploys = await this.prisma.deployment.findMany({
      where: { site_id: site.id },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return localDeploys.map((d) => ({
      id: d.id.toString(),
      site_id: d.site_id.toString(),
      status: d.status,
      triggered_by: d.triggered_by || 'manual',
      commit_message: null,
      commit_hash: null,
      created_at: d.created_at,
      updated_at: d.finished_at ?? d.started_at ?? d.created_at,
    }));
  }

  private mapCoolifyDeploymentStatus(status: string): string {
    const s = status?.toLowerCase() || '';
    if (s === 'success' || s === 'finished') return 'success';
    if (s === 'queued') return 'queued';
    if (s === 'in_progress' || s === 'building') return 'in_progress';
    if (s === 'error' || s === 'failed') return 'failed';
    return s;
  }

  // --- Domains ---
  public async getDomains(
    user: JwtPayload,
    id: string,
  ): Promise<DomainPayload[]> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user);

    return this.prisma.domain.findMany({
      where: { site_id: site.id },
      orderBy: { created_at: 'desc' },
    });
  }

  public async addDomain(
    user: JwtPayload,
    id: string,
    dto: AddDomainDto,
  ): Promise<DomainPayload> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });
    const domain = normalizeDomain(dto.domain);
    if (!domain) {
      throw new BadRequestException('Domain is required');
    }

    if (!site.default_domain_target) {
      throw new BadRequestException(
        'Site is missing a default domain target. Recreate or repair the site before adding custom domains.',
      );
    }

    const existing = await this.prisma.domain.findUnique({
      where: { domain },
    });
    if (existing) {
      throw new BadRequestException('That domain is already connected to another site.');
    }

    const routingMode = this.domainVerifier.classifyDomain(domain);

    return this.prisma.domain.create({
      data: {
        tenant_id: site.tenant_id,
        site_id: site.id,
        domain,
        status: DomainStatus.pending_dns,
        ssl_enabled: false,
        coolify_domain_id: null,
        target_hostname: site.default_domain_target,
        routing_mode: routingMode,
        verification_started_at: new Date(),
        diagnostic_message: this.buildInitialDomainInstructions(
          domain,
          site.default_domain_target,
          routingMode,
        ),
      },
    });
  }

  public async verifyDomain(
    user: JwtPayload,
    id: string,
    domainId: string,
  ): Promise<DomainPayload> {
    const siteId = toBigIntStrict(id, 'siteId');
    const parsedDomainId = toBigIntStrict(domainId, 'domainId');
    await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    return this.domainAutomation.verifyNow(siteId, parsedDomainId);
  }

  public async retryDomain(
    user: JwtPayload,
    id: string,
    domainId: string,
  ): Promise<DomainPayload> {
    const siteId = toBigIntStrict(id, 'siteId');
    const parsedDomainId = toBigIntStrict(domainId, 'domainId');
    await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    return this.domainAutomation.retryDomain(siteId, parsedDomainId);
  }

  // --- Team Access ---
  public async getTeam(user: JwtPayload, id: string): Promise<SiteTeamPayload> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user);
    const userId = this.requireUserId(user);
    const tenantId = user.tenant_id
      ? toBigIntStrict(user.tenant_id, 'tenant_id')
      : null;
    const currentMembership = await this.prisma.siteMember.findUnique({
      where: {
        site_id_user_id: {
          site_id: site.id,
          user_id: userId,
        },
      },
      select: { role: true },
    });
    const canWrite =
      user.role === 'admin' ||
      (tenantId !== null && tenantId === site.tenant_id) ||
      currentMembership?.role === SiteMemberRole.editor;

    const [members, invites] = await Promise.all([
      this.prisma.siteMember.findMany({
        where: { site_id: site.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.siteInvite.findMany({
        where: { site_id: site.id, status: 'pending' },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      can_write: canWrite,
      members: members.map((member) => ({
        id: member.id.toString(),
        user_id: member.user.id.toString(),
        email: member.user.email,
        name: member.user.name,
        role: member.role === SiteMemberRole.editor ? 'editor' : 'viewer',
        created_at: member.created_at,
      })),
      invites: invites.map((invite) => ({
        id: invite.id.toString(),
        email: invite.email,
        role: invite.role === SiteMemberRole.editor ? 'editor' : 'viewer',
        status: invite.status,
        created_at: invite.created_at,
      })),
    };
  }

  public async addTeamMember(
    user: JwtPayload,
    id: string,
    dto: AddSiteMemberDto,
  ): Promise<{
    mode: 'member' | 'invite';
  }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    const email = String(dto.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const role = toTeamRole(dto.role);
    const actorUserId = this.requireUserId(user);
    const tenantPolicy = await this.getTenantPolicyOrThrow(site.tenant_id);
    const resources = resolveTenantPlanResources(tenantPolicy);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const currentMember = await this.prisma.siteMember.findUnique({
        where: {
          site_id_user_id: {
            site_id: site.id,
            user_id: existingUser.id,
          },
        },
        select: { id: true },
      });

      if (!currentMember) {
        const memberCount = await this.prisma.siteMember.count({
          where: { site_id: site.id },
        });
        if (memberCount >= resources.maxTeamMembersPerSite) {
          throw new ForbiddenException(
            `This site has reached its team member limit (${resources.maxTeamMembersPerSite}).`,
          );
        }
      }

      await this.prisma.siteMember.upsert({
        where: {
          site_id_user_id: {
            site_id: site.id,
            user_id: existingUser.id,
          },
        },
        update: {
          role,
          invited_by_user_id: actorUserId,
        },
        create: {
          site_id: site.id,
          user_id: existingUser.id,
          role,
          invited_by_user_id: actorUserId,
        },
      });

      await this.prisma.siteInvite.updateMany({
        where: {
          site_id: site.id,
          email,
          status: 'pending',
        },
        data: {
          status: 'accepted',
          accepted_by_user_id: existingUser.id,
          accepted_at: new Date(),
        },
      });

      return { mode: 'member' };
    }

    await this.prisma.siteInvite.upsert({
      where: {
        site_id_email: {
          site_id: site.id,
          email,
        },
      },
      update: {
        role,
        status: 'pending',
        invited_by_user_id: actorUserId,
        accepted_by_user_id: null,
        accepted_at: null,
      },
      create: {
        site_id: site.id,
        tenant_id: site.tenant_id,
        email,
        role,
        status: 'pending',
        invited_by_user_id: actorUserId,
      },
    });

    return { mode: 'invite' };
  }

  public async removeTeamMember(
    user: JwtPayload,
    id: string,
    memberId: string,
  ): Promise<{ ok: true }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const parsedMemberId = toBigIntStrict(memberId, 'memberId');
    await this.getOwnedSiteOrThrow(siteId, user, { requireWrite: true });

    const removed = await this.prisma.siteMember.deleteMany({
      where: {
        id: parsedMemberId,
        site_id: siteId,
      },
    });

    if (!removed.count) {
      throw new NotFoundException('Team member not found');
    }

    return { ok: true };
  }

  public async revokeTeamInvite(
    user: JwtPayload,
    id: string,
    inviteId: string,
  ): Promise<{ ok: true }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const parsedInviteId = toBigIntStrict(inviteId, 'inviteId');
    await this.getOwnedSiteOrThrow(siteId, user, { requireWrite: true });

    const updated = await this.prisma.siteInvite.updateMany({
      where: {
        id: parsedInviteId,
        site_id: siteId,
        status: 'pending',
      },
      data: {
        status: 'revoked',
      },
    });

    if (!updated.count) {
      throw new NotFoundException('Pending invite not found');
    }

    return { ok: true };
  }

  // --- Database ---
  public async getWorkspaceDatabase(
    user: JwtPayload,
  ): Promise<{
    id: string;
    engine: string;
    host: string;
    port: number;
    db_name: string;
    username: string;
    password: string;
    public_url: string;
    ssl_mode?: string | null;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const userId = this.requireUserId(user);
    const db = await this.prisma.userDatabase.findUnique({
      where: { user_id: userId },
    });

    if (!db) return null;

    return {
      id: db.id.toString(),
      engine: db.engine,
      host: db.host,
      port: db.port,
      db_name: db.db_name,
      username: db.username,
      password: db.password,
      public_url: db.public_url,
      ssl_mode: db.ssl_mode,
      created_at: db.created_at,
      updated_at: db.updated_at,
    };
  }

  public async createWorkspaceDatabase(
    user: JwtPayload,
    dto: CreateUserDatabaseDto,
  ): Promise<UserDatabasePayload> {
    const tenantId = this.requireTenantId(user);
    const userId = this.requireUserId(user);

    const existing = await this.prisma.userDatabase.findUnique({
      where: { user_id: userId },
    });
    if (existing) {
      return existing;
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenant_id: true,
      },
    });

    if (!userRecord || userRecord.tenant_id !== tenantId) {
      throw new ForbiddenException('Workspace database cannot be created.');
    }

    const naming = this.buildWorkspaceDatabaseNaming(
      userRecord.email,
      userRecord.id,
    );
    const dbPassword = rand(24);
    const rootPassword = rand(24);
    const provisioned = await this.coolify.createPublicDatabase({
      name: naming.resourceName,
      engine: dto.engine as ManagedDatabaseEngine,
      dbName: naming.databaseName,
      username: naming.username,
      password: dbPassword,
      rootPassword,
    });

    return this.prisma.userDatabase.create({
      data: {
        user_id: userId,
        tenant_id: tenantId,
        engine: provisioned.engine,
        host: provisioned.host,
        port: provisioned.port,
        db_name: provisioned.dbName,
        username: provisioned.username,
        password: provisioned.password,
        public_url: provisioned.externalUrl,
        ssl_mode: provisioned.sslMode,
        coolify_project_id: provisioned.projectId,
        coolify_database_id: provisioned.databaseId,
      },
    });
  }

  public async getDatabase(
    user: JwtPayload,
    id: string,
  ): Promise<{
    id: string;
    engine: string;
    host: string;
    port: number;
    db_name: string;
    username: string;
    password?: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    const db = await this.prisma.siteDatabase.findUnique({
      where: { site_id: site.id },
    });

    if (!db) return null;

    return {
      id: db.id.toString(),
      engine: db.engine,
      host: db.host,
      port: db.port,
      db_name: db.db_name,
      username: db.username,
      password: db.password,
      created_at: db.created_at,
      updated_at: db.updated_at,
    };
  }

  public async createOrReplaceDatabase(
    user: JwtPayload,
    id: string,
    dto: CreateSiteDatabaseDto,
  ): Promise<SiteDatabasePayload> {
    const siteId = toBigIntStrict(id, 'siteId');
    await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    const existing = await this.prisma.siteDatabase.findUnique({
      where: { site_id: siteId },
    });

    if (existing) {
      return this.prisma.siteDatabase.update({
        where: { site_id: siteId },
        data: {
          host: dto.host.trim(),
          port: dto.port ?? 3306,
          db_name: dto.db_name.trim(),
          username: dto.username.trim(),
          password: dto.password,
        },
      });
    }

    return this.prisma.siteDatabase.create({
      data: {
        site_id: siteId,
        engine: 'mariadb',
        host: dto.host.trim(),
        port: dto.port ?? 3306,
        db_name: dto.db_name.trim(),
        username: dto.username.trim(),
        password: dto.password,
      },
    });
  }

  public async listDatabaseTables(
    user: JwtPayload,
    id: string,
  ): Promise<{
    connected: boolean;
    database: string;
    engine: string;
    tables: Array<{ name: string; approxRows: number | null }>;
  }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const db = await this.getOwnedDatabaseOrThrow(siteId, user);

    return this.withDatabaseClient(db, async (client) => {
      const tables = await client.$queryRawUnsafe<
        Array<{ tableName: string; tableRows: number | bigint | null }>
      >(
        'SELECT TABLE_NAME AS tableName, TABLE_ROWS AS tableRows FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME ASC',
        db.db_name,
      );

      return {
        connected: true,
        database: db.db_name,
        engine: db.engine,
        tables: tables.map((t) => ({
          name: String(t.tableName),
          approxRows: t.tableRows == null ? null : Number(t.tableRows),
        })),
      };
    });
  }

  public async getDatabaseTableRows(
    user: JwtPayload,
    id: string,
    table: string,
    options?: { limit?: string; offset?: string },
  ): Promise<{
    table: string;
    columns: string[];
    rows: Record<string, unknown>[];
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  }> {
    const siteId = toBigIntStrict(id, 'siteId');
    const db = await this.getOwnedDatabaseOrThrow(siteId, user);

    const safeTable = this.assertSafeIdentifier(table, 'table');
    const limit = this.parseBoundedInt(options?.limit, 25, 1, 100);
    const offset = this.parseBoundedInt(options?.offset, 0, 0, 100_000);

    return this.withDatabaseClient(db, async (client) => {
      const tableExists = await client.$queryRawUnsafe<
        Array<{ total: number | bigint }>
      >(
        'SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        db.db_name,
        safeTable,
      );
      const total = Number(tableExists?.[0]?.total ?? 0);
      if (!total) {
        throw new NotFoundException(`Table "${safeTable}" not found`);
      }

      const columnsRaw = await client.$queryRawUnsafe<Array<{ Field: string }>>(
        `SHOW COLUMNS FROM \`${safeTable}\``,
      );
      const columns = columnsRaw.map((c) => String(c.Field));

      const queryLimit = limit + 1;
      const rowsPlusOne = await client.$queryRawUnsafe<
        Record<string, unknown>[]
      >(`SELECT * FROM \`${safeTable}\` LIMIT ${queryLimit} OFFSET ${offset}`);

      const hasMore = rowsPlusOne.length > limit;
      const rows = hasMore ? rowsPlusOne.slice(0, limit) : rowsPlusOne;

      return {
        table: safeTable,
        columns,
        rows,
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      };
    });
  }

  private buildWorkspaceDatabaseNaming(email: string, userId: bigint): {
    resourceName: string;
    databaseName: string;
    username: string;
  } {
    const emailLocalPart = email.split('@')[0] ?? 'workspace';
    const suffix = userId.toString();
    const base = safeDatabaseIdentifier(emailLocalPart, 18);
    const databaseName = safeDatabaseIdentifier(`${base}_${suffix}`, 32);
    const username = safeDatabaseIdentifier(`u_${base}_${suffix}`, 24);

    return {
      resourceName: safeSvc(`${base}-${suffix}-db`).slice(0, 40),
      databaseName,
      username,
    };
  }

  private async getOwnedDatabaseOrThrow(
    siteId: bigint,
    user: JwtPayload,
  ): Promise<SiteDatabasePayload> {
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    const db = await this.prisma.siteDatabase.findUnique({
      where: { site_id: site.id },
    });

    if (!db) {
      throw new NotFoundException('Database not configured for this site');
    }

    return db;
  }

  private buildSiteDatabaseUrl(db: SiteDatabasePayload): string {
    const user = encodeURIComponent(db.username);
    const password = encodeURIComponent(db.password || '');
    const host = db.host.trim();
    const port = Number(db.port || 3306);
    const dbName = encodeURIComponent(db.db_name);

    return `mysql://${user}:${password}@${host}:${port}/${dbName}`;
  }

  private async withDatabaseClient<T>(
    db: SiteDatabasePayload,
    run: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    const client = new PrismaClient({
      datasources: {
        db: {
          url: this.buildSiteDatabaseUrl(db),
        },
      },
    });

    try {
      await client.$connect();
      return await run(client);
    } finally {
      await client.$disconnect();
    }
  }

  private assertSafeIdentifier(value: string, fieldName: string): string {
    const trimmed = String(value ?? '').trim();
    if (!trimmed || !/^[A-Za-z0-9_]+$/.test(trimmed)) {
      throw new ForbiddenException(
        `${fieldName} contains unsupported characters`,
      );
    }
    return trimmed;
  }

  private parseBoundedInt(
    input: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (input === undefined || input === null || input === '') return fallback;
    const parsed = Number.parseInt(input, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  // --- Environment Variables ---
  public async getEnvs(user: JwtPayload, id: string) {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id) return [];

    return this.coolify.getEnvs(site.coolify_resource_id);
  }

  public async createEnv(
    user: JwtPayload,
    id: string,
    body: {
      key: string;
      value: string;
      is_preview?: boolean;
      is_multiline?: boolean;
      is_shown_once?: boolean;
      is_build_time?: boolean;
      is_buildtime?: boolean;
      is_literal?: boolean;
    },
  ) {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id)
      throw new ForbiddenException('Resource not provisioned');

    return this.coolify.createEnv(site.coolify_resource_id, body);
  }

  public async deleteEnv(user: JwtPayload, id: string, key: string) {
    const siteId = toBigIntStrict(id, 'siteId');
    const site = await this.getOwnedSiteOrThrow(siteId, user, {
      requireWrite: true,
    });

    if (!site.coolify_resource_id)
      throw new ForbiddenException('Resource not provisioned');

    return this.coolify.deleteEnv(site.coolify_resource_id, key);
  }
}
