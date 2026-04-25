import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DomainStatus,
  HostingPackageKind,
  ManagedServiceStatus,
  N8nDeploymentVariant,
  Role,
  SiteMemberRole,
  SiteStatus,
  SubscriptionPlan,
  type SiteType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  TENANT_PLAN_CATALOG,
  resolveTenantPlanResources,
} from '../../common/plans/tenant-plan';
import {
  N8N_VARIANT_DETAILS,
  PackageAccessError,
  assertPackageAllowsN8nServices,
} from '../../common/packages/package-access';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/auth.types';
import type { CreateSiteDto } from '../sites/dto/create-site.dto';
import { SitesService } from '../sites/sites.service';
import { CloudflareDnsService } from '../../services/cloudflare/cloudflare.service';
import {
  type CoolifyApplicationSummary,
  type CoolifyEnvVar,
  CoolifyService,
} from '../../services/coolify/coolify.service';

type AdminPanelTarget = 'backend' | 'frontend';

type GroupedPanelEnv = {
  key: string;
  value: string;
  is_buildtime: boolean;
  is_literal: boolean;
  is_multiline: boolean;
  is_shown_once: boolean;
  has_preview: boolean;
  variant_count: number;
};

type PanelAppResponse = {
  target: AdminPanelTarget;
  label: string;
  uuid: string;
  name: string;
  status?: string;
  fqdn?: string;
  base_directory?: string;
  envs: GroupedPanelEnv[];
};

type SerializedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  last_login_at: Date | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_package_id: string | null;
  tenant_package_name: string | null;
  tenant_package_kind: HostingPackageKind | null;
  site_memberships: number;
};

type SerializedPackage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: HostingPackageKind;
  is_active: boolean;
  n8n_variant: N8nDeploymentVariant | null;
  legacy_plan: SubscriptionPlan | null;
  resources: {
    max_sites: number | null;
    max_services: number | null;
    max_cpu_total: number | null;
    max_memory_mb_total: number | null;
    max_storage_gb_total: number | null;
    max_team_members_per_site: number | null;
  };
  variant_details: {
    label: string;
    description: string;
  } | null;
  usage: {
    tenants: number;
    managed_services: number;
  };
  created_at: Date;
  updated_at: Date;
};

type SerializedTenant = {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  package_id: string | null;
  package_name: string | null;
  package_kind: HostingPackageKind | null;
  package_is_active: boolean | null;
  n8n_variant: N8nDeploymentVariant | null;
  is_active: boolean;
  suspended_at: Date | null;
  created_at: Date;
  updated_at: Date;
  usage: {
    users: number;
    sites: number;
    services: number;
    assigned_sites: number;
    unassigned_sites: number;
  };
  resources: {
    overrides: {
      max_sites: number | null;
      max_cpu_total: number | null;
      max_memory_mb_total: number | null;
      max_storage_gb_total: number | null;
      max_team_members_per_site: number | null;
    };
    effective: {
      max_sites: number;
      max_cpu_total: number;
      max_memory_mb_total: number;
      max_storage_gb_total: number;
      max_team_members_per_site: number;
    };
  };
};

type SerializedSite = {
  id: string;
  name: string;
  type: SiteType;
  status: string;
  tenant_id: string;
  tenant_name: string;
  tenant_plan: SubscriptionPlan;
  tenant_package_id: string | null;
  tenant_package_name: string | null;
  tenant_package_kind: HostingPackageKind | null;
  primary_domain: string | null;
  repo_url: string | null;
  repo_branch: string | null;
  auto_deploy: boolean;
  cpu_limit: number;
  memory_mb: number;
  member_count: number;
  is_unassigned: boolean;
  assigned_users: Array<{
    id: string;
    email: string;
    name: string;
    role: 'viewer' | 'editor';
  }>;
  created_at: Date;
  updated_at: Date;
};

type SerializedManagedService = {
  id: string;
  name: string;
  type: string;
  status: string;
  tenant_id: string;
  tenant_name: string;
  tenant_package_id: string | null;
  tenant_package_name: string | null;
  n8n_variant: N8nDeploymentVariant;
  primary_domain: string | null;
  cpu_limit: number;
  memory_mb: number;
  storage_gb: number;
  coolify_service_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type CoolifySiteCandidate = {
  uuid: string;
  name: string;
  status?: string;
  fqdn?: string;
  base_directory?: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toSiteMemberRole(role?: string): SiteMemberRole {
  return role === 'viewer' ? SiteMemberRole.viewer : SiteMemberRole.editor;
}

async function bcryptHash(password: string, rounds = 12): Promise<string> {
  return (
    bcrypt as unknown as { hash: (s: string, n: number) => Promise<string> }
  ).hash(password, rounds);
}

@Injectable()
export class AdminService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly coolify: CoolifyService,
    private readonly sites: SitesService,
    private readonly cloudflare: CloudflareDnsService,
  ) {}

  public async listPanelApps(user: JwtPayload): Promise<PanelAppResponse[]> {
    this.requireAdmin(user);
    const applications = await this.coolify.getApplications();

    return Promise.all(
      (['backend', 'frontend'] as const).map((target) =>
        this.buildPanelAppResponse(target, applications),
      ),
    );
  }

  public async restartPanelApp(user: JwtPayload, target: string) {
    this.requireAdmin(user);
    const normalizedTarget = this.normalizePanelTarget(target);
    const app = await this.resolvePanelApplication(normalizedTarget);
    await this.coolify.restartResource('application', app.uuid);
    return { ok: true, target: normalizedTarget, action: 'restart' };
  }

  public async redeployPanelApp(user: JwtPayload, target: string) {
    this.requireAdmin(user);
    const normalizedTarget = this.normalizePanelTarget(target);
    const app = await this.resolvePanelApplication(normalizedTarget);
    await this.coolify.deployResource('application', app.uuid, {
      force: true,
      instantDeploy: true,
    });
    return { ok: true, target: normalizedTarget, action: 'redeploy' };
  }

  public async upsertPanelEnv(
    user: JwtPayload,
    target: string,
    body: {
      key: string;
      value: string;
      is_buildtime?: boolean;
      is_literal?: boolean;
      is_multiline?: boolean;
      is_shown_once?: boolean;
    },
  ) {
    this.requireAdmin(user);
    const normalizedTarget = this.normalizePanelTarget(target);
    const app = await this.resolvePanelApplication(normalizedTarget);

    await this.coolify.createEnv(app.uuid, {
      key: body.key,
      value: body.value,
      is_buildtime: body.is_buildtime,
      is_literal: body.is_literal ?? true,
      is_multiline: body.is_multiline,
      is_shown_once: body.is_shown_once,
    });

    await this.reloadPanelApplication(app.uuid, Boolean(body.is_buildtime));

    return {
      ok: true,
      target: normalizedTarget,
      reloaded_with: body.is_buildtime ? 'deploy' : 'restart',
    };
  }

  public async deletePanelEnv(user: JwtPayload, target: string, key: string) {
    this.requireAdmin(user);
    const normalizedTarget = this.normalizePanelTarget(target);
    const app = await this.resolvePanelApplication(normalizedTarget);
    const existingEnvs = await this.coolify.getEnvs(app.uuid);
    const matching = existingEnvs.filter((env) => env.key === key);

    if (!matching.length) {
      throw new NotFoundException(
        `Environment variable "${key}" was not found.`,
      );
    }

    await this.coolify.deleteEnv(app.uuid, key);
    await this.reloadPanelApplication(
      app.uuid,
      matching.some((env) => Boolean(env.is_buildtime || env.is_build_time)),
    );

    return { ok: true, target: normalizedTarget };
  }

  public async listUsers(user: JwtPayload) {
    this.requireAdmin(user);

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true,
        last_login_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            package: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        _count: {
          select: {
            site_members: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { created_at: 'desc' }],
    });

    const normalized = users.map((entry) => this.serializeUser(entry));

    return {
      stats: {
        total_users: normalized.length,
        active_users: normalized.filter((entry) => entry.is_active).length,
        admin_users: normalized.filter((entry) => entry.role === Role.admin)
          .length,
      },
      admin_emails: normalized
        .filter((entry) => entry.role === Role.admin)
        .map((entry) => entry.email),
      users: normalized,
    };
  }

  public async createUser(
    currentUser: JwtPayload,
    body: {
      name: string;
      email: string;
      password: string;
      role?: Role;
      plan?: SubscriptionPlan;
      package_id?: string;
      tenant_id?: string;
      tenant_name?: string;
    },
  ) {
    this.requireAdmin(currentUser);

    const name = body.name.trim();
    const email = body.email.toLowerCase().trim();
    if (!name) {
      throw new BadRequestException('Name is required.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Email already in use.');
    }

    const role = body.role ?? Role.user;
    const tenantId = await this.resolveTenantForUserCreation(body, role, name);

    const created = await this.prisma.user.create({
      data: {
        name,
        email,
        password_hash: await bcryptHash(body.password, 12),
        role,
        is_active: true,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true,
        last_login_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            package: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        _count: {
          select: {
            site_members: true,
          },
        },
      },
    });

    return {
      ok: true,
      user: this.serializeUser(created),
    };
  }

  public async listTenants(user: JwtPayload) {
    this.requireAdmin(user);

    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        package_id: true,
        package: {
          select: {
            id: true,
            name: true,
            kind: true,
            is_active: true,
            n8n_variant: true,
            max_sites: true,
            max_cpu_total: true,
            max_memory_mb_total: true,
            max_storage_gb_total: true,
            max_team_members_per_site: true,
          },
        },
        is_active: true,
        suspended_at: true,
        created_at: true,
        updated_at: true,
        max_sites: true,
        max_cpu_total: true,
        max_memory_mb_total: true,
        max_storage_gb_total: true,
        max_cpu_per_site: true,
        max_memory_mb_per_site: true,
        max_team_members_per_site: true,
        users: {
          select: { id: true },
        },
        sites: {
          select: {
            id: true,
            _count: {
              select: { members: true },
            },
          },
        },
        managed_services: {
          where: { status: { not: ManagedServiceStatus.deleted } },
          select: { id: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const [normalized, packages] = [
      tenants.map((tenant) => this.serializeTenant(tenant)),
      await this.loadSerializedPackages(),
    ];

    return {
      stats: {
        total_tenants: normalized.length,
        active_tenants: normalized.filter((tenant) => tenant.is_active).length,
        suspended_tenants: normalized.filter((tenant) => !tenant.is_active)
          .length,
      },
      packages,
      plan_catalog: this.getPlanCatalog(),
      tenants: normalized,
    };
  }

  public async listPackages(user: JwtPayload) {
    this.requireAdmin(user);
    const packages = await this.loadSerializedPackages();
    return {
      stats: {
        total_packages: packages.length,
        active_packages: packages.filter((pkg) => pkg.is_active).length,
        web_packages: packages.filter(
          (pkg) => pkg.kind === HostingPackageKind.WEB,
        ).length,
        n8n_packages: packages.filter(
          (pkg) => pkg.kind === HostingPackageKind.N8N,
        ).length,
      },
      n8n_variants: Object.values(N8N_VARIANT_DETAILS),
      packages,
    };
  }

  public async createPackage(
    user: JwtPayload,
    body: {
      name: string;
      description?: string;
      kind: HostingPackageKind;
      is_active?: boolean;
      n8n_variant?: N8nDeploymentVariant;
      max_sites?: number | null;
      max_services?: number | null;
      max_cpu_total?: number | null;
      max_memory_mb_total?: number | null;
      max_storage_gb_total?: number | null;
      max_team_members_per_site?: number | null;
    },
  ) {
    this.requireAdmin(user);
    const name = body.name.trim();
    if (!name) throw new BadRequestException('Package name is required.');

    const kind = body.kind;
    const data = this.normalizePackageData({
      ...body,
      description: body.description,
      n8n_variant:
        kind === HostingPackageKind.N8N
          ? body.n8n_variant ?? N8nDeploymentVariant.SIMPLE
          : null,
      max_sites: kind === HostingPackageKind.WEB ? body.max_sites : 0,
      max_services: kind === HostingPackageKind.N8N ? body.max_services : 0,
    });

    const created = await this.prisma.hostingPackage.create({
      data: {
        ...data,
        name,
        slug: await this.generateUniquePackageSlug(name),
        kind,
        is_active: body.is_active ?? true,
        n8n_variant:
          kind === HostingPackageKind.N8N
            ? body.n8n_variant ?? N8nDeploymentVariant.SIMPLE
            : null,
      },
      select: this.packageSelect(),
    });

    return {
      ok: true,
      package: this.serializePackage(created),
    };
  }

  public async updatePackage(
    user: JwtPayload,
    id: string,
    body: {
      name?: string;
      description?: string | null;
      kind?: HostingPackageKind;
      is_active?: boolean;
      n8n_variant?: N8nDeploymentVariant | null;
      max_sites?: number | null;
      max_services?: number | null;
      max_cpu_total?: number | null;
      max_memory_mb_total?: number | null;
      max_storage_gb_total?: number | null;
      max_team_members_per_site?: number | null;
    },
  ) {
    this.requireAdmin(user);
    const packageId = this.toBigIntStrict(id, 'packageId');
    const existing = await this.prisma.hostingPackage.findUnique({
      where: { id: packageId },
      select: this.packageSelect(),
    });
    if (!existing) throw new NotFoundException('Package not found.');

    const nextKind = body.kind ?? existing.kind;
    const data = this.normalizePackageData({
      ...body,
      kind: nextKind,
      name: body.name?.trim(),
      slug:
        body.name !== undefined
          ? await this.generateUniquePackageSlug(body.name, packageId)
          : undefined,
      n8n_variant:
        nextKind === HostingPackageKind.N8N
          ? body.n8n_variant === null
            ? N8nDeploymentVariant.SIMPLE
            : body.n8n_variant ?? existing.n8n_variant ?? N8nDeploymentVariant.SIMPLE
          : null,
      max_sites:
        nextKind === HostingPackageKind.WEB
          ? body.max_sites
          : body.max_sites === undefined
            ? 0
            : body.max_sites,
      max_services:
        nextKind === HostingPackageKind.N8N
          ? body.max_services
          : body.max_services === undefined
            ? 0
            : body.max_services,
    });

    if (body.name !== undefined && !data.name) {
      throw new BadRequestException('Package name cannot be empty.');
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException('No package changes were provided.');
    }

    const tenantCount = await this.prisma.tenant.count({
      where: { package_id: packageId },
    });
    if (tenantCount > 0 && existing.kind !== nextKind) {
      throw new BadRequestException(
        'Packages with tenants cannot be changed between web and n8n. Create a new package and switch compatible tenants instead.',
      );
    }

    const updated = await this.prisma.hostingPackage.update({
      where: { id: packageId },
      data,
      select: this.packageSelect(),
    });

    return {
      ok: true,
      package: this.serializePackage(updated),
    };
  }

  public async updateTenant(
    user: JwtPayload,
    id: string,
    body: {
      name?: string;
      plan?: SubscriptionPlan;
      package_id?: string;
      is_active?: boolean;
      max_sites?: number | null;
      max_cpu_total?: number | null;
      max_memory_mb_total?: number | null;
      max_storage_gb_total?: number | null;
      max_team_members_per_site?: number | null;
    },
  ) {
    this.requireAdmin(user);
    const tenantId = this.toBigIntStrict(id, 'tenantId');
    await this.assertTenantExists(tenantId);

    const currentTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        package_id: true,
        package: {
          select: {
            kind: true,
            is_active: true,
            max_sites: true,
            max_cpu_total: true,
            max_memory_mb_total: true,
            max_storage_gb_total: true,
            max_team_members_per_site: true,
          },
        },
        max_sites: true,
        max_cpu_total: true,
        max_memory_mb_total: true,
        max_storage_gb_total: true,
        max_cpu_per_site: true,
        max_memory_mb_per_site: true,
        max_team_members_per_site: true,
      },
    });
    if (!currentTenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const data: {
      name?: string;
      slug?: string;
      plan?: SubscriptionPlan;
      package_id?: bigint | null;
      is_active?: boolean;
      suspended_at?: Date | null;
      max_sites?: number | null;
      max_cpu_total?: number | null;
      max_memory_mb_total?: number | null;
      max_storage_gb_total?: number | null;
      max_team_members_per_site?: number | null;
    } = {};

    if (body.name !== undefined) {
      const normalizedName = body.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Tenant name cannot be empty.');
      }
      data.name = normalizedName;
      data.slug = await this.generateUniqueTenantSlug(normalizedName, tenantId);
    }
    if (body.plan !== undefined) data.plan = body.plan;
    let nextPackage:
      | {
          id: bigint;
          kind: HostingPackageKind;
          is_active: boolean;
          max_sites: number | null;
          max_cpu_total: number | null;
          max_memory_mb_total: number | null;
          max_storage_gb_total: number | null;
          max_team_members_per_site: number | null;
        }
      | null
      | undefined;
    if (body.package_id !== undefined) {
      nextPackage = await this.resolvePackageForTenantUpdate(
        tenantId,
        body.package_id,
      );
      data.package_id = nextPackage?.id ?? null;
    }
    if (body.is_active !== undefined) {
      data.is_active = body.is_active;
      data.suspended_at = body.is_active ? null : new Date();
    }
    if (body.max_sites !== undefined) {
      data.max_sites =
        body.max_sites === null ? null : Math.trunc(body.max_sites);
    }
    if (body.max_cpu_total !== undefined) {
      data.max_cpu_total = body.max_cpu_total;
    }
    if (body.max_memory_mb_total !== undefined) {
      data.max_memory_mb_total =
        body.max_memory_mb_total === null
          ? null
          : Math.trunc(body.max_memory_mb_total);
    }
    if (body.max_storage_gb_total !== undefined) {
      data.max_storage_gb_total =
        body.max_storage_gb_total === null
          ? null
          : Math.trunc(body.max_storage_gb_total);
    }
    if (body.max_team_members_per_site !== undefined) {
      data.max_team_members_per_site =
        body.max_team_members_per_site === null
          ? null
          : Math.trunc(body.max_team_members_per_site);
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException('No tenant changes were provided.');
    }

    const nextResourceState = {
      ...currentTenant,
      plan: body.plan ?? currentTenant.plan,
      package:
        nextPackage === undefined
          ? currentTenant.package
          : nextPackage
            ? {
                kind: nextPackage.kind,
                is_active: nextPackage.is_active,
                max_sites: nextPackage.max_sites,
                max_cpu_total: nextPackage.max_cpu_total,
                max_memory_mb_total: nextPackage.max_memory_mb_total,
                max_storage_gb_total: nextPackage.max_storage_gb_total,
                max_team_members_per_site:
                  nextPackage.max_team_members_per_site,
              }
            : null,
      max_sites:
        body.max_sites === undefined
          ? currentTenant.max_sites
          : body.max_sites === null
            ? null
            : Math.trunc(body.max_sites),
      max_cpu_total:
        body.max_cpu_total === undefined
          ? currentTenant.max_cpu_total
          : body.max_cpu_total,
      max_memory_mb_total:
        body.max_memory_mb_total === undefined
          ? currentTenant.max_memory_mb_total
          : body.max_memory_mb_total === null
            ? null
            : Math.trunc(body.max_memory_mb_total),
      max_storage_gb_total:
        body.max_storage_gb_total === undefined
          ? currentTenant.max_storage_gb_total
          : body.max_storage_gb_total === null
            ? null
            : Math.trunc(body.max_storage_gb_total),
      max_team_members_per_site:
        body.max_team_members_per_site === undefined
          ? currentTenant.max_team_members_per_site
          : body.max_team_members_per_site === null
            ? null
            : Math.trunc(body.max_team_members_per_site),
    };

    await this.sites.validateTenantResourcePool(tenantId, nextResourceState);
    const nextResources = resolveTenantPlanResources(nextResourceState);
    await this.sites.validateTenantStoragePool(
      tenantId,
      nextResources.maxStorageGbTotal,
    );

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        package_id: true,
        package: {
          select: {
            id: true,
            name: true,
            kind: true,
            is_active: true,
            n8n_variant: true,
            max_sites: true,
            max_cpu_total: true,
            max_memory_mb_total: true,
            max_storage_gb_total: true,
            max_team_members_per_site: true,
          },
        },
        is_active: true,
        suspended_at: true,
        created_at: true,
        updated_at: true,
        max_sites: true,
        max_cpu_total: true,
        max_memory_mb_total: true,
        max_storage_gb_total: true,
        max_cpu_per_site: true,
        max_memory_mb_per_site: true,
        max_team_members_per_site: true,
        users: {
          select: { id: true },
        },
        sites: {
          select: {
            id: true,
            _count: {
              select: { members: true },
            },
          },
        },
        managed_services: {
          where: { status: { not: ManagedServiceStatus.deleted } },
          select: { id: true },
        },
      },
    });

    await this.sites.rebalanceTenantResourcePool(tenantId);

    return {
      ok: true,
      tenant: this.serializeTenant(updated),
    };
  }

  public async listSites(user: JwtPayload) {
    this.requireAdmin(user);

    const sites = await this.prisma.site.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        tenant_id: true,
        repo_url: true,
        repo_branch: true,
        auto_deploy: true,
        cpu_limit: true,
        memory_mb: true,
        created_at: true,
        updated_at: true,
        tenant: {
          select: {
            name: true,
            plan: true,
            package: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        domains: {
          select: { domain: true },
          orderBy: { created_at: 'asc' },
          take: 1,
        },
        members: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const normalized = sites.map((site) => this.serializeSite(site));

    return {
      stats: {
        total_sites: normalized.length,
        unassigned_sites: normalized.filter((site) => site.is_unassigned)
          .length,
        assigned_sites: normalized.filter((site) => !site.is_unassigned).length,
      },
      sites: normalized,
    };
  }

  public async listCoolifySiteCandidates(user: JwtPayload) {
    this.requireAdmin(user);

    const applications = (await this.coolify.getApplications()).filter(
      (app) => !this.isPanelApplication(app),
    );
    const appUuids = applications.map((app) => app.uuid).filter(Boolean);

    const trackedSites = appUuids.length
      ? await this.prisma.site.findMany({
          where: {
            OR: [
              { coolify_resource_id: { in: appUuids } },
              { coolify_app_id: { in: appUuids } },
            ],
          },
          select: {
            coolify_resource_id: true,
            coolify_app_id: true,
          },
        })
      : [];

    const trackedUuids = new Set<string>();
    for (const site of trackedSites) {
      if (site.coolify_resource_id) trackedUuids.add(site.coolify_resource_id);
      if (site.coolify_app_id) trackedUuids.add(site.coolify_app_id);
    }

    const candidates = applications
      .filter((app) => !trackedUuids.has(app.uuid))
      .map((app) => this.serializeCoolifySiteCandidate(app));

    return {
      stats: {
        total_coolify_apps: applications.length,
        tracked_sites: trackedUuids.size,
        untracked_sites: candidates.length,
      },
      coolify_sites: candidates,
    };
  }

  public async importCoolifySite(
    user: JwtPayload,
    body: {
      coolify_resource_id: string;
      tenant_id: string;
      assign_user_id?: string;
      name?: string;
      type?: CreateSiteDto['type'];
      role?: string;
    },
  ) {
    this.requireAdmin(user);
    const coolifyResourceId = body.coolify_resource_id.trim();
    if (!coolifyResourceId) {
      throw new BadRequestException('Coolify resource id is required.');
    }

    const tenantId = this.toBigIntStrict(body.tenant_id, 'tenantId');
    await this.assertTenantExists(tenantId);
    const projectedAllocation =
      await this.sites.projectNewSiteResourceAllocation(tenantId);

    const applications = await this.coolify.getApplications();
    const application = applications.find(
      (app) => app.uuid === coolifyResourceId,
    );
    if (!application) {
      throw new NotFoundException('Coolify application not found.');
    }
    if (this.isPanelApplication(application)) {
      throw new BadRequestException('Panel applications cannot be imported.');
    }

    const existing = await this.prisma.site.findFirst({
      where: {
        OR: [
          { coolify_resource_id: coolifyResourceId },
          { coolify_app_id: coolifyResourceId },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      if (body.assign_user_id) {
        await this.assignUserToSiteInternal(
          existing.id,
          this.toBigIntStrict(body.assign_user_id, 'assign_user_id'),
          toSiteMemberRole(body.role),
        );
      }

      return {
        ok: true,
        imported: false,
        site: await this.getSerializedSiteOrThrow(existing.id),
      };
    }

    const created = await this.prisma.site.create({
      data: {
        tenant_id: tenantId,
        name:
          body.name?.trim() ||
          application.name?.trim() ||
          `Coolify ${coolifyResourceId.slice(0, 8)}`,
        type: this.normalizeSiteType(body.type),
        status: this.toSiteStatus(application.status),
        coolify_resource_id: application.uuid,
        coolify_app_id: application.uuid,
        coolify_resource_type: 'application',
        cpu_limit: projectedAllocation.cpuLimit,
        memory_mb: projectedAllocation.memoryMb,
        auto_deploy: false,
        last_status_sync_at: new Date(),
      },
      select: { id: true },
    });

    await this.attachCoolifyDomainsToSite(
      created.id,
      tenantId,
      application.fqdn,
    );

    if (body.assign_user_id) {
      await this.assignUserToSiteInternal(
        created.id,
        this.toBigIntStrict(body.assign_user_id, 'assign_user_id'),
        toSiteMemberRole(body.role),
      );
    }

    await this.sites.rebalanceTenantResourcePool(tenantId);

    return {
      ok: true,
      imported: true,
      site: await this.getSerializedSiteOrThrow(created.id),
    };
  }

  public async createSite(
    user: JwtPayload,
    body: {
      tenant_id: string;
      assign_user_id?: string;
      name: string;
      type: CreateSiteDto['type'];
      repo_url?: string;
      repo_branch?: string;
      auto_deploy?: boolean;
      github_app_id?: string;
      private_key_uuid?: string;
      use_github_connection?: boolean;
    },
  ) {
    this.requireAdmin(user);
    const tenantId = this.toBigIntStrict(body.tenant_id, 'tenantId');
    await this.assertTenantExists(tenantId);

    const actingAsTenantUser: JwtPayload = {
      ...user,
      tenant_id: tenantId.toString(),
    };

    const created = await this.sites.createSite(actingAsTenantUser, {
      name: body.name,
      type: body.type,
      repo_url: body.repo_url,
      repo_branch: body.repo_branch,
      auto_deploy: body.auto_deploy,
      github_app_id: body.github_app_id,
      private_key_uuid: body.private_key_uuid,
      use_github_connection: body.use_github_connection,
    });

    if (body.assign_user_id) {
      await this.assignUserToSiteInternal(
        created.id,
        this.toBigIntStrict(body.assign_user_id, 'assign_user_id'),
        SiteMemberRole.editor,
      );
    }

    return {
      ok: true,
      site: await this.getSerializedSiteOrThrow(created.id),
    };
  }

  public async listManagedServices(user: JwtPayload) {
    this.requireAdmin(user);

    const services = await this.prisma.managedService.findMany({
      where: { status: { not: ManagedServiceStatus.deleted } },
      select: this.managedServiceSelect(),
      orderBy: { created_at: 'desc' },
    });
    const normalized = services.map((service) =>
      this.serializeManagedService(service),
    );

    return {
      stats: {
        total_services: normalized.length,
        running_services: normalized.filter(
          (service) => service.status === 'RUNNING',
        ).length,
        stopped_services: normalized.filter(
          (service) => service.status === 'STOPPED',
        ).length,
      },
      services: normalized,
    };
  }

  public async createManagedService(
    user: JwtPayload,
    body: { tenant_id: string; name: string },
  ) {
    this.requireAdmin(user);
    this.cloudflare.ensureConfig();
    const hostCnameTarget = this.getHostCnameTarget();
    const tenantId = this.toBigIntStrict(body.tenant_id, 'tenantId');
    const pkg = await this.getTenantN8nPackageOrThrow(tenantId);
    const serviceCount = await this.prisma.managedService.count({
      where: {
        tenant_id: tenantId,
        status: { not: ManagedServiceStatus.deleted },
      },
    });
    const maxServices = this.normalizePositiveInt(pkg.max_services, 1);
    if (serviceCount >= maxServices) {
      throw new ForbiddenException(
        `This tenant has reached its n8n service limit (${maxServices}).`,
      );
    }

    const serviceName = body.name.trim();
    if (!serviceName) {
      throw new BadRequestException('Service name is required.');
    }

    let service = await this.prisma.managedService.create({
      data: {
        tenant_id: tenantId,
        package_id: pkg.id,
        name: serviceName,
        type: 'n8n',
        status: ManagedServiceStatus.provisioning,
        n8n_variant: pkg.n8n_variant ?? N8nDeploymentVariant.SIMPLE,
        cpu_limit: this.normalizePositiveNumber(pkg.max_cpu_total, 0.5),
        memory_mb: this.normalizePositiveInt(pkg.max_memory_mb_total, 512),
        storage_gb: this.normalizePositiveInt(pkg.max_storage_gb_total, 5),
      },
      select: { id: true },
    });

    let cloudflareRecordId: string | null = null;
    try {
      const defaultDomainTarget = this.buildDefaultN8nDomainTarget(service.id);
      const domainUrl = `https://${defaultDomainTarget}`;
      const dnsRecord = await this.cloudflare.createSiteHostnameRecord(
        defaultDomainTarget,
        hostCnameTarget,
      );
      cloudflareRecordId = dnsRecord.recordId;

      const coolifyService = await this.coolify.createN8nService({
        name: serviceName,
        domainUrl,
        variant: pkg.n8n_variant ?? N8nDeploymentVariant.SIMPLE,
        cpu_limit: this.normalizePositiveNumber(pkg.max_cpu_total, 0.5),
        memory_mb: this.normalizePositiveInt(pkg.max_memory_mb_total, 512),
        storage_gb: this.normalizePositiveInt(pkg.max_storage_gb_total, 5),
      });

      service = await this.prisma.managedService.update({
        where: { id: service.id },
        data: {
          coolify_project_id: coolifyService.projectId,
          coolify_service_id: coolifyService.serviceId,
          coolify_server_uuid: coolifyService.serverUuid,
          coolify_destination_uuid: coolifyService.destinationUuid,
          default_domain_target: defaultDomainTarget,
          cloudflare_dns_record_id: cloudflareRecordId,
          coolify_default_hostname: domainUrl,
          last_status_sync_at: new Date(),
        },
        select: { id: true },
      });
    } catch (error) {
      if (cloudflareRecordId) {
        await this.cloudflare.deleteRecord(cloudflareRecordId).catch(() => {});
      }
      await this.prisma.managedService.delete({
        where: { id: service.id },
      });
      throw error;
    }

    return {
      ok: true,
      service: await this.getSerializedManagedServiceOrThrow(service.id),
    };
  }

  public async deployManagedService(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const service = await this.getManagedServiceResourceOrThrow(id);
    await this.coolify.deployResource('service', service.coolify_service_id, {
      force: true,
      instantDeploy: true,
    });
    await this.prisma.managedService.update({
      where: { id: service.id },
      data: {
        status: ManagedServiceStatus.provisioning,
        last_status_sync_at: new Date(),
      },
    });
    return {
      ok: true,
      service: await this.getSerializedManagedServiceOrThrow(service.id),
    };
  }

  public async restartManagedService(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const service = await this.getManagedServiceResourceOrThrow(id);
    await this.coolify.restartResource('service', service.coolify_service_id);
    await this.prisma.managedService.update({
      where: { id: service.id },
      data: {
        status: ManagedServiceStatus.provisioning,
        last_status_sync_at: new Date(),
      },
    });
    return {
      ok: true,
      service: await this.getSerializedManagedServiceOrThrow(service.id),
    };
  }

  public async startManagedService(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const service = await this.getManagedServiceResourceOrThrow(id);
    await this.coolify.startResource('service', service.coolify_service_id);
    await this.prisma.managedService.update({
      where: { id: service.id },
      data: {
        status: ManagedServiceStatus.provisioning,
        last_status_sync_at: new Date(),
      },
    });
    return {
      ok: true,
      service: await this.getSerializedManagedServiceOrThrow(service.id),
    };
  }

  public async stopManagedService(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const service = await this.getManagedServiceResourceOrThrow(id);
    await this.coolify.stopResource('service', service.coolify_service_id);
    await this.prisma.managedService.update({
      where: { id: service.id },
      data: {
        status: ManagedServiceStatus.stopped,
        last_status_sync_at: new Date(),
      },
    });
    return {
      ok: true,
      service: await this.getSerializedManagedServiceOrThrow(service.id),
    };
  }

  public async deleteManagedService(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const service = await this.getManagedServiceForDeletionOrThrow(id);
    if (service.coolify_service_id) {
      await this.coolify.deleteService(service.coolify_service_id);
    }
    if (service.cloudflare_dns_record_id) {
      await this.cloudflare
        .deleteRecord(service.cloudflare_dns_record_id)
        .catch(() => {});
    }
    await this.prisma.managedService.update({
      where: { id: service.id },
      data: {
        status: ManagedServiceStatus.deleted,
        last_status_sync_at: new Date(),
      },
    });
    return { ok: true };
  }

  public async deploySite(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const siteId = this.toBigIntStrict(id, 'siteId');
    await this.sites.deploySite(user, id, { force: true });
    return { ok: true, site: await this.getSerializedSiteOrThrow(siteId) };
  }

  public async restartSite(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const siteId = this.toBigIntStrict(id, 'siteId');
    await this.sites.restartSite(user, id);
    return { ok: true, site: await this.getSerializedSiteOrThrow(siteId) };
  }

  public async startSite(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const siteId = this.toBigIntStrict(id, 'siteId');
    await this.sites.startSite(user, id);
    return { ok: true, site: await this.getSerializedSiteOrThrow(siteId) };
  }

  public async stopSite(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    const siteId = this.toBigIntStrict(id, 'siteId');
    await this.sites.stopSite(user, id);
    return { ok: true, site: await this.getSerializedSiteOrThrow(siteId) };
  }

  public async deleteSite(user: JwtPayload, id: string) {
    this.requireAdmin(user);
    return this.sites.deleteSite(user, id);
  }

  public async assignSite(
    user: JwtPayload,
    id: string,
    body: {
      user_id: string;
      role?: string;
    },
  ) {
    this.requireAdmin(user);
    await this.assignUserToSiteInternal(
      this.toBigIntStrict(id, 'siteId'),
      this.toBigIntStrict(body.user_id, 'userId'),
      toSiteMemberRole(body.role),
    );

    return {
      ok: true,
      site: await this.getSerializedSiteOrThrow(
        this.toBigIntStrict(id, 'siteId'),
      ),
    };
  }

  public async updateUser(
    currentUser: JwtPayload,
    id: string,
    body: {
      name?: string;
      email?: string;
      role?: Role;
      is_active?: boolean;
      tenant_id?: string;
      package_id?: string;
    },
  ) {
    this.requireAdmin(currentUser);
    const userId = this.toBigIntStrict(id, 'userId');
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, is_active: true, tenant_id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    const data: {
      name?: string;
      email?: string;
      role?: Role;
      is_active?: boolean;
      tenant_id?: bigint | null;
    } = {};

    if (body.name !== undefined) {
      const normalizedName = body.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Name cannot be empty.');
      }
      data.name = normalizedName;
    }
    if (body.email !== undefined) {
      const normalizedEmail = body.email.trim().toLowerCase();
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException('Email already in use.');
      }
      data.email = normalizedEmail;
    }
    if (body.role !== undefined) data.role = body.role;
    if (body.is_active !== undefined) data.is_active = body.is_active;
    if (body.tenant_id !== undefined) {
      data.tenant_id = await this.resolveOptionalTenantId(body.tenant_id);
    }

    const packageTenantId =
      data.tenant_id !== undefined ? data.tenant_id : existing.tenant_id;
    let nextPackageId: bigint | null | undefined;
    if (body.package_id !== undefined) {
      if (!packageTenantId) {
        throw new BadRequestException(
          'Assign the user to a tenant before changing its package.',
        );
      }
      const nextPackage = await this.resolvePackageForTenantUpdate(
        packageTenantId,
        body.package_id,
      );
      nextPackageId = nextPackage?.id ?? null;
    }

    if (!Object.keys(data).length && nextPackageId === undefined) {
      throw new BadRequestException('No changes were provided.');
    }

    const isSelf = existing.id.toString() === currentUser.sub;
    if (isSelf && data.role && data.role !== Role.admin) {
      throw new BadRequestException(
        'You cannot remove admin access from your current session.',
      );
    }
    if (isSelf && data.is_active === false) {
      throw new BadRequestException(
        'You cannot deactivate the account currently in use.',
      );
    }

    if (nextPackageId !== undefined && packageTenantId) {
      await this.prisma.tenant.update({
        where: { id: packageTenantId },
        data: { package_id: nextPackageId },
      });
    }

    const userSelect = {
      id: true,
      email: true,
      name: true,
      role: true,
      is_active: true,
      created_at: true,
      last_login_at: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          package: {
            select: {
              id: true,
              name: true,
              kind: true,
            },
          },
        },
      },
      _count: {
        select: {
          site_members: true,
        },
      },
    } as const;
    const updated = Object.keys(data).length
      ? await this.prisma.user.update({
          where: { id: userId },
          data,
          select: userSelect,
        })
      : await this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: userSelect,
        });

    return {
      ok: true,
      user: this.serializeUser(updated),
    };
  }

  public async setUserPassword(
    currentUser: JwtPayload,
    id: string,
    body: { password: string },
  ) {
    this.requireAdmin(currentUser);
    const userId = this.toBigIntStrict(id, 'userId');
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: await bcryptHash(body.password, 12),
      },
    });

    return { ok: true };
  }

  public async health(user: JwtPayload) {
    this.requireAdmin(user);
    return this.coolify.health();
  }

  private serializeUser(entry: {
    id: bigint;
    email: string;
    name: string;
    role: Role;
    is_active: boolean;
    created_at: Date;
    last_login_at: Date | null;
    tenant: {
      id: bigint;
      name: string;
      slug: string;
      package: {
        id: bigint;
        name: string;
        kind: HostingPackageKind;
      } | null;
    } | null;
    _count: { site_members: number };
  }): SerializedUser {
    return {
      id: entry.id.toString(),
      email: entry.email,
      name: entry.name,
      role: entry.role,
      is_active: entry.is_active,
      created_at: entry.created_at,
      last_login_at: entry.last_login_at,
      tenant_id: entry.tenant?.id?.toString() ?? null,
      tenant_name: entry.tenant?.name ?? null,
      tenant_slug: entry.tenant?.slug ?? null,
      tenant_package_id: entry.tenant?.package?.id.toString() ?? null,
      tenant_package_name: entry.tenant?.package?.name ?? null,
      tenant_package_kind: entry.tenant?.package?.kind ?? null,
      site_memberships: entry._count.site_members,
    };
  }

  private serializeTenant(entry: {
    id: bigint;
    name: string;
    slug: string;
    plan: SubscriptionPlan;
    package_id: bigint | null;
    package: {
      id: bigint;
      name: string;
      kind: HostingPackageKind;
      is_active: boolean;
      n8n_variant: N8nDeploymentVariant | null;
      max_sites: number | null;
      max_cpu_total: number | null;
      max_memory_mb_total: number | null;
      max_storage_gb_total: number | null;
      max_team_members_per_site: number | null;
    } | null;
    is_active: boolean;
    suspended_at: Date | null;
    created_at: Date;
    updated_at: Date;
    max_sites: number | null;
    max_cpu_total: number | null;
    max_memory_mb_total: number | null;
    max_storage_gb_total: number | null;
    max_cpu_per_site: number | null;
    max_memory_mb_per_site: number | null;
    max_team_members_per_site: number | null;
    users: Array<{ id: bigint }>;
    sites: Array<{ id: bigint; _count: { members: number } }>;
    managed_services: Array<{ id: bigint }>;
  }): SerializedTenant {
    const effective = resolveTenantPlanResources(entry);
    const assignedSites = entry.sites.filter(
      (site) => site._count.members > 0,
    ).length;

    return {
      id: entry.id.toString(),
      name: entry.name,
      slug: entry.slug,
      plan: entry.plan,
      package_id: entry.package_id?.toString() ?? null,
      package_name: entry.package?.name ?? null,
      package_kind: entry.package?.kind ?? null,
      package_is_active: entry.package?.is_active ?? null,
      n8n_variant: entry.package?.n8n_variant ?? null,
      is_active: entry.is_active,
      suspended_at: entry.suspended_at,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      usage: {
        users: entry.users.length,
        sites: entry.sites.length,
        services: entry.managed_services.length,
        assigned_sites: assignedSites,
        unassigned_sites: entry.sites.length - assignedSites,
      },
      resources: {
        overrides: {
          max_sites: entry.max_sites,
          max_cpu_total: entry.max_cpu_total,
          max_memory_mb_total: entry.max_memory_mb_total,
          max_storage_gb_total: entry.max_storage_gb_total,
          max_team_members_per_site: entry.max_team_members_per_site,
        },
        effective: {
          max_sites: effective.maxSites,
          max_cpu_total: effective.maxCpuTotal,
          max_memory_mb_total: effective.maxMemoryMbTotal,
          max_storage_gb_total: effective.maxStorageGbTotal,
          max_team_members_per_site: effective.maxTeamMembersPerSite,
        },
      },
    };
  }

  private serializePackage(entry: {
    id: bigint;
    name: string;
    slug: string;
    description: string | null;
    kind: HostingPackageKind;
    is_active: boolean;
    n8n_variant: N8nDeploymentVariant | null;
    legacy_plan: SubscriptionPlan | null;
    max_sites: number | null;
    max_services: number | null;
    max_cpu_total: number | null;
    max_memory_mb_total: number | null;
    max_storage_gb_total: number | null;
    max_team_members_per_site: number | null;
    created_at: Date;
    updated_at: Date;
    _count?: {
      tenants: number;
      managed_services: number;
    };
  }): SerializedPackage {
    const variant =
      entry.n8n_variant !== null ? N8N_VARIANT_DETAILS[entry.n8n_variant] : null;

    return {
      id: entry.id.toString(),
      name: entry.name,
      slug: entry.slug,
      description: entry.description,
      kind: entry.kind,
      is_active: entry.is_active,
      n8n_variant: entry.n8n_variant,
      legacy_plan: entry.legacy_plan,
      resources: {
        max_sites: entry.max_sites,
        max_services: entry.max_services,
        max_cpu_total: entry.max_cpu_total,
        max_memory_mb_total: entry.max_memory_mb_total,
        max_storage_gb_total: entry.max_storage_gb_total,
        max_team_members_per_site: entry.max_team_members_per_site,
      },
      variant_details: variant
        ? {
            label: variant.label,
            description: variant.description,
          }
        : null,
      usage: {
        tenants: entry._count?.tenants ?? 0,
        managed_services: entry._count?.managed_services ?? 0,
      },
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  private serializeSite(entry: {
    id: bigint;
    name: string;
    type: SiteType;
    status: string;
    tenant_id: bigint;
    repo_url: string | null;
    repo_branch: string | null;
    auto_deploy: boolean;
    cpu_limit: number;
    memory_mb: number;
    created_at: Date;
    updated_at: Date;
    tenant: {
      name: string;
      plan: SubscriptionPlan;
      package: {
        id: bigint;
        name: string;
        kind: HostingPackageKind;
      } | null;
    };
    domains: Array<{ domain: string }>;
    members: Array<{
      role: SiteMemberRole;
      user: { id: bigint; email: string; name: string };
    }>;
  }): SerializedSite {
    return {
      id: entry.id.toString(),
      name: entry.name,
      type: entry.type,
      status: entry.status.toUpperCase(),
      tenant_id: entry.tenant_id.toString(),
      tenant_name: entry.tenant.name,
      tenant_plan: entry.tenant.plan,
      tenant_package_id: entry.tenant.package?.id.toString() ?? null,
      tenant_package_name: entry.tenant.package?.name ?? null,
      tenant_package_kind: entry.tenant.package?.kind ?? null,
      primary_domain: entry.domains[0]?.domain ?? null,
      repo_url: entry.repo_url,
      repo_branch: entry.repo_branch,
      auto_deploy: entry.auto_deploy,
      cpu_limit: entry.cpu_limit,
      memory_mb: entry.memory_mb,
      member_count: entry.members.length,
      is_unassigned: entry.members.length === 0,
      assigned_users: entry.members.map((member) => ({
        id: member.user.id.toString(),
        email: member.user.email,
        name: member.user.name,
        role: member.role === SiteMemberRole.viewer ? 'viewer' : 'editor',
      })),
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  private serializeManagedService(entry: {
    id: bigint;
    name: string;
    type: string;
    status: ManagedServiceStatus;
    tenant_id: bigint;
    n8n_variant: N8nDeploymentVariant;
    cpu_limit: number;
    memory_mb: number;
    storage_gb: number;
    coolify_service_id: string | null;
    coolify_default_hostname: string | null;
    default_domain_target: string | null;
    created_at: Date;
    updated_at: Date;
    tenant: {
      name: string;
      package: {
        id: bigint;
        name: string;
      } | null;
    };
  }): SerializedManagedService {
    return {
      id: entry.id.toString(),
      name: entry.name,
      type: entry.type,
      status: entry.status.toUpperCase(),
      tenant_id: entry.tenant_id.toString(),
      tenant_name: entry.tenant.name,
      tenant_package_id: entry.tenant.package?.id.toString() ?? null,
      tenant_package_name: entry.tenant.package?.name ?? null,
      n8n_variant: entry.n8n_variant,
      primary_domain:
        entry.coolify_default_hostname ?? entry.default_domain_target ?? null,
      cpu_limit: entry.cpu_limit,
      memory_mb: entry.memory_mb,
      storage_gb: entry.storage_gb,
      coolify_service_id: entry.coolify_service_id,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  private packageSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      kind: true,
      is_active: true,
      n8n_variant: true,
      legacy_plan: true,
      max_sites: true,
      max_services: true,
      max_cpu_total: true,
      max_memory_mb_total: true,
      max_storage_gb_total: true,
      max_team_members_per_site: true,
      created_at: true,
      updated_at: true,
      _count: {
        select: {
          tenants: true,
          managed_services: true,
        },
      },
    } as const;
  }

  private managedServiceSelect() {
    return {
      id: true,
      name: true,
      type: true,
      status: true,
      tenant_id: true,
      n8n_variant: true,
      cpu_limit: true,
      memory_mb: true,
      storage_gb: true,
      coolify_service_id: true,
      coolify_default_hostname: true,
      default_domain_target: true,
      created_at: true,
      updated_at: true,
      tenant: {
        select: {
          name: true,
          package: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    } as const;
  }

  private async loadSerializedPackages(): Promise<SerializedPackage[]> {
    const packages = await this.prisma.hostingPackage.findMany({
      select: this.packageSelect(),
      orderBy: [{ kind: 'asc' }, { created_at: 'asc' }],
    });
    return packages.map((pkg) => this.serializePackage(pkg));
  }

  private normalizePackageData(input: {
    name?: string;
    slug?: string;
    description?: string | null;
    kind?: HostingPackageKind;
    is_active?: boolean;
    n8n_variant?: N8nDeploymentVariant | null;
    max_sites?: number | null;
    max_services?: number | null;
    max_cpu_total?: number | null;
    max_memory_mb_total?: number | null;
    max_storage_gb_total?: number | null;
    max_team_members_per_site?: number | null;
  }) {
    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
      kind?: HostingPackageKind;
      is_active?: boolean;
      n8n_variant?: N8nDeploymentVariant | null;
      max_sites?: number | null;
      max_services?: number | null;
      max_cpu_total?: number | null;
      max_memory_mb_total?: number | null;
      max_storage_gb_total?: number | null;
      max_team_members_per_site?: number | null;
    } = {};

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.description !== undefined) {
      const normalized = input.description?.trim() ?? '';
      data.description = normalized.length ? normalized : null;
    }
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.n8n_variant !== undefined) data.n8n_variant = input.n8n_variant;
    if (input.max_sites !== undefined) {
      data.max_sites =
        input.max_sites === null ? null : Math.trunc(input.max_sites);
    }
    if (input.max_services !== undefined) {
      data.max_services =
        input.max_services === null ? null : Math.trunc(input.max_services);
    }
    if (input.max_cpu_total !== undefined) {
      data.max_cpu_total = input.max_cpu_total;
    }
    if (input.max_memory_mb_total !== undefined) {
      data.max_memory_mb_total =
        input.max_memory_mb_total === null
          ? null
          : Math.trunc(input.max_memory_mb_total);
    }
    if (input.max_storage_gb_total !== undefined) {
      data.max_storage_gb_total =
        input.max_storage_gb_total === null
          ? null
          : Math.trunc(input.max_storage_gb_total);
    }
    if (input.max_team_members_per_site !== undefined) {
      data.max_team_members_per_site =
        input.max_team_members_per_site === null
          ? null
          : Math.trunc(input.max_team_members_per_site);
    }

    return data;
  }

  private async resolvePackageForTenantUpdate(
    tenantId: bigint,
    rawPackageId: string,
  ) {
    const packageId = this.toBigIntStrict(rawPackageId, 'packageId');
    const pkg = await this.prisma.hostingPackage.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        kind: true,
        is_active: true,
        n8n_variant: true,
        max_sites: true,
        max_services: true,
        max_cpu_total: true,
        max_memory_mb_total: true,
        max_storage_gb_total: true,
        max_team_members_per_site: true,
      },
    });
    if (!pkg) {
      throw new NotFoundException('Package not found.');
    }
    if (!pkg.is_active) {
      throw new BadRequestException('Inactive packages cannot be assigned.');
    }

    const [siteCount, serviceCount] = await Promise.all([
      this.prisma.site.count({ where: { tenant_id: tenantId } }),
      this.prisma.managedService.count({
        where: {
          tenant_id: tenantId,
          status: { not: ManagedServiceStatus.deleted },
        },
      }),
    ]);
    if (pkg.kind === HostingPackageKind.N8N && siteCount > 0) {
      throw new BadRequestException(
        'This tenant owns web sites. Move or delete those sites before assigning an n8n package.',
      );
    }
    if (pkg.kind === HostingPackageKind.WEB && serviceCount > 0) {
      throw new BadRequestException(
        'This tenant owns n8n services. Delete those services before assigning a web package.',
      );
    }
    return pkg;
  }

  private async resolvePackageIdForNewTenant(
    rawPackageId: string,
  ): Promise<bigint> {
    const packageId = this.toBigIntStrict(rawPackageId, 'packageId');
    const pkg = await this.prisma.hostingPackage.findUnique({
      where: { id: packageId },
      select: { id: true, is_active: true },
    });
    if (!pkg) {
      throw new NotFoundException('Package not found.');
    }
    if (!pkg.is_active) {
      throw new BadRequestException('Inactive packages cannot be assigned.');
    }
    return pkg.id;
  }

  private async resolveLegacyWebPackageId(
    plan: SubscriptionPlan,
  ): Promise<bigint | null> {
    const pkg = await this.prisma.hostingPackage.findUnique({
      where: { legacy_plan: plan },
      select: { id: true, is_active: true },
    });
    return pkg?.is_active ? pkg.id : null;
  }

  private async getTenantN8nPackageOrThrow(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        package: {
          select: {
            id: true,
            kind: true,
            is_active: true,
            n8n_variant: true,
            max_services: true,
            max_cpu_total: true,
            max_memory_mb_total: true,
            max_storage_gb_total: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    try {
      assertPackageAllowsN8nServices(tenant.package);
    } catch (error) {
      if (error instanceof PackageAccessError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
    if (!tenant.package) {
      throw new ForbiddenException('This tenant package does not include n8n services.');
    }
    return tenant.package;
  }

  private async getManagedServiceResourceOrThrow(id: string) {
    const serviceId = this.toBigIntStrict(id, 'serviceId');
    const service = await this.prisma.managedService.findFirst({
      where: { id: serviceId, status: { not: ManagedServiceStatus.deleted } },
      select: { id: true, coolify_service_id: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }
    if (!service.coolify_service_id) {
      throw new ForbiddenException('Service not provisioned yet.');
    }
    return service as { id: bigint; coolify_service_id: string };
  }

  private async getManagedServiceForDeletionOrThrow(id: string) {
    const serviceId = this.toBigIntStrict(id, 'serviceId');
    const service = await this.prisma.managedService.findFirst({
      where: { id: serviceId, status: { not: ManagedServiceStatus.deleted } },
      select: {
        id: true,
        coolify_service_id: true,
        cloudflare_dns_record_id: true,
      },
    });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }
    return service;
  }

  private async getSerializedManagedServiceOrThrow(
    serviceId: bigint,
  ): Promise<SerializedManagedService> {
    const service = await this.prisma.managedService.findUnique({
      where: { id: serviceId },
      select: this.managedServiceSelect(),
    });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }
    return this.serializeManagedService(service);
  }

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

  private buildDefaultN8nDomainTarget(serviceId: bigint): string {
    const prefix =
      (process.env.N8N_HOSTNAME_PREFIX ?? 'n8n')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+|-+$/g, '') || 'n8n';
    return `${prefix}-${serviceId.toString()}.${this.getHostBaseDomain()}`;
  }

  private normalizePositiveInt(
    value: number | null | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return Math.trunc(value);
  }

  private normalizePositiveNumber(
    value: number | null | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return value;
  }

  private serializeCoolifySiteCandidate(
    entry: CoolifyApplicationSummary,
  ): CoolifySiteCandidate {
    return {
      uuid: entry.uuid,
      name: entry.name,
      status: entry.status,
      fqdn: entry.fqdn,
      base_directory: entry.base_directory,
    };
  }

  private async attachCoolifyDomainsToSite(
    siteId: bigint,
    tenantId: bigint,
    fqdn?: string,
  ): Promise<void> {
    const domains = this.parseCoolifyDomains(fqdn);
    if (!domains.length) return;

    await this.prisma.domain.createMany({
      data: domains.map((domain) => ({
        tenant_id: tenantId,
        site_id: siteId,
        domain,
        status: DomainStatus.active,
        ssl_enabled: true,
      })),
      skipDuplicates: true,
    });
  }

  private parseCoolifyDomains(fqdn?: string): string[] {
    if (!fqdn) return [];

    const domains = new Set<string>();
    for (const entry of fqdn.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;

      try {
        const url = new URL(
          /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
            ? trimmed
            : `https://${trimmed}`,
        );
        if (url.host) domains.add(url.host);
      } catch {
        // Ignore malformed Coolify FQDN fragments.
      }
    }

    return Array.from(domains);
  }

  private normalizeSiteType(type?: CreateSiteDto['type']): SiteType {
    if (
      type === 'wordpress' ||
      type === 'php' ||
      type === 'static' ||
      type === 'python' ||
      type === 'node'
    ) {
      return type;
    }

    return 'node';
  }

  private toSiteStatus(status?: string): SiteStatus {
    const normalized = (status ?? '').toLowerCase();

    if (normalized.includes('running') || normalized.includes('healthy')) {
      return SiteStatus.running;
    }
    if (normalized.includes('stopped')) {
      return SiteStatus.stopped;
    }
    if (normalized.includes('error') || normalized.includes('failed')) {
      return SiteStatus.error;
    }
    if (normalized.includes('building')) {
      return SiteStatus.building;
    }

    return SiteStatus.provisioning;
  }

  private async resolveTenantForUserCreation(
    body: {
      tenant_id?: string;
      tenant_name?: string;
      plan?: SubscriptionPlan;
      package_id?: string;
    },
    role: Role,
    name: string,
  ): Promise<bigint | null> {
    if (body.tenant_id) {
      const tenantId = this.toBigIntStrict(body.tenant_id, 'tenantId');
      await this.assertTenantExists(tenantId);
      if (body.package_id) {
        const pkg = await this.resolvePackageForTenantUpdate(
          tenantId,
          body.package_id,
        );
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { package_id: pkg.id },
        });
      }
      return tenantId;
    }

    if (body.tenant_name) {
      return this.createTenant(
        body.tenant_name,
        body.plan ?? SubscriptionPlan.FREE,
        body.package_id,
      );
    }

    if (role === Role.admin) {
      return null;
    }

    return this.createTenant(
      `${name} Workspace`,
      body.plan ?? SubscriptionPlan.FREE,
      body.package_id,
    );
  }

  private async createTenant(
    name: string,
    plan: SubscriptionPlan,
    rawPackageId?: string,
  ): Promise<bigint> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Tenant name is required.');
    }

    const packageId = rawPackageId
      ? await this.resolvePackageIdForNewTenant(rawPackageId)
      : await this.resolveLegacyWebPackageId(plan);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: normalizedName,
        slug: await this.generateUniqueTenantSlug(normalizedName),
        plan,
        package_id: packageId ?? undefined,
      },
      select: { id: true },
    });

    return tenant.id;
  }

  private async resolveOptionalTenantId(value: string): Promise<bigint | null> {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const tenantId = this.toBigIntStrict(normalized, 'tenantId');
    await this.assertTenantExists(tenantId);
    return tenantId;
  }

  private async assertTenantExists(tenantId: bigint): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
  }

  private async getTenantPolicyOrThrow(tenantId: bigint) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        package: {
          select: {
            kind: true,
            is_active: true,
            max_sites: true,
            max_cpu_total: true,
            max_memory_mb_total: true,
            max_storage_gb_total: true,
            max_team_members_per_site: true,
          },
        },
        max_sites: true,
        max_cpu_per_site: true,
        max_memory_mb_per_site: true,
        max_team_members_per_site: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    return tenant;
  }

  private async enforceTenantSiteLimit(tenantId: bigint) {
    const tenant = await this.getTenantPolicyOrThrow(tenantId);
    const resources = resolveTenantPlanResources(tenant);
    const siteCount = await this.prisma.site.count({
      where: { tenant_id: tenantId },
    });

    if (siteCount >= resources.maxSites) {
      throw new ForbiddenException(
        `This tenant has reached its site limit (${resources.maxSites}).`,
      );
    }

    return resources;
  }

  private async generateUniqueTenantSlug(
    name: string,
    excludeTenantId?: bigint,
  ): Promise<string> {
    const baseSlug = slugify(name) || `tenant-${Date.now()}`;
    let slug = baseSlug;
    let i = 1;

    while (true) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || existing.id === excludeTenantId) {
        return slug;
      }

      slug = `${baseSlug}-${i++}`;
    }
  }

  private async generateUniquePackageSlug(
    name: string,
    excludePackageId?: bigint,
  ): Promise<string> {
    const baseSlug = slugify(name) || `package-${Date.now()}`;
    let slug = baseSlug;
    let i = 1;

    while (true) {
      const existing = await this.prisma.hostingPackage.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || existing.id === excludePackageId) {
        return slug;
      }

      slug = `${baseSlug}-${i++}`;
    }
  }

  private getPlanCatalog() {
    return Object.entries(TENANT_PLAN_CATALOG).map(([key, value]) => ({
      key,
      label: value.label,
      description: value.description,
      resources: {
        max_sites: value.resources.maxSites,
        max_cpu_total: value.resources.maxCpuTotal,
        max_memory_mb_total: value.resources.maxMemoryMbTotal,
        max_storage_gb_total: value.resources.maxStorageGbTotal,
        max_team_members_per_site: value.resources.maxTeamMembersPerSite,
      },
    }));
  }

  private async assignUserToSiteInternal(
    siteId: bigint,
    userId: bigint,
    role: SiteMemberRole,
  ): Promise<void> {
    const [site, user] = await Promise.all([
      this.prisma.site.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          tenant_id: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          tenant_id: true,
        },
      }),
    ]);

    if (!site) {
      throw new NotFoundException('Site not found.');
    }
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: site.tenant_id },
      select: {
        id: true,
        plan: true,
        package: {
          select: {
            kind: true,
            is_active: true,
            max_sites: true,
            max_cpu_total: true,
            max_memory_mb_total: true,
            max_storage_gb_total: true,
            max_team_members_per_site: true,
          },
        },
        max_sites: true,
        max_cpu_per_site: true,
        max_memory_mb_per_site: true,
        max_team_members_per_site: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    if (user.role !== Role.admin) {
      if (user.tenant_id !== null && user.tenant_id !== site.tenant_id) {
        throw new BadRequestException(
          'That user belongs to a different tenant and cannot be assigned here.',
        );
      }

      if (user.tenant_id === null) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { tenant_id: site.tenant_id },
        });
      }
    }

    const existingMember = await this.prisma.siteMember.findUnique({
      where: {
        site_id_user_id: {
          site_id: site.id,
          user_id: user.id,
        },
      },
      select: { id: true },
    });

    if (!existingMember) {
      const resources = resolveTenantPlanResources(tenant);
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
          user_id: user.id,
        },
      },
      update: {
        role,
        invited_by_user_id: null,
      },
      create: {
        site_id: site.id,
        user_id: user.id,
        role,
      },
    });
  }

  private async getSerializedSiteOrThrow(
    siteId: bigint,
  ): Promise<SerializedSite> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        tenant_id: true,
        repo_url: true,
        repo_branch: true,
        auto_deploy: true,
        cpu_limit: true,
        memory_mb: true,
        created_at: true,
        updated_at: true,
        tenant: {
          select: {
            name: true,
            plan: true,
            package: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        domains: {
          select: { domain: true },
          orderBy: { created_at: 'asc' },
          take: 1,
        },
        members: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found.');
    }

    return this.serializeSite(site);
  }

  private requireAdmin(user: JwtPayload): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin only.');
    }
  }

  private async buildPanelAppResponse(
    target: AdminPanelTarget,
    applications: CoolifyApplicationSummary[],
  ): Promise<PanelAppResponse> {
    const app = this.findPanelApplication(target, applications);
    if (!app) {
      throw new NotFoundException(
        `Could not find the ${target} application in Coolify.`,
      );
    }

    const envs = this.groupPanelEnvs(await this.coolify.getEnvs(app.uuid));

    return {
      target,
      label: target === 'backend' ? 'GetAeon API' : 'GetAeon Panel',
      uuid: app.uuid,
      name: app.name,
      status: app.status,
      fqdn: app.fqdn,
      base_directory: app.base_directory,
      envs,
    };
  }

  private groupPanelEnvs(envs: CoolifyEnvVar[]): GroupedPanelEnv[] {
    const groups = new Map<string, CoolifyEnvVar[]>();

    for (const env of envs) {
      const bucket = groups.get(env.key) ?? [];
      bucket.push(env);
      groups.set(env.key, bucket);
    }

    return Array.from(groups.entries())
      .map(([key, entries]) => {
        const primary =
          entries.find((entry) => entry.is_preview !== true) ?? entries[0];

        return {
          key,
          value: primary?.value ?? '',
          is_buildtime: entries.some((entry) =>
            Boolean(entry.is_buildtime || entry.is_build_time),
          ),
          is_literal: entries.some((entry) => entry.is_literal !== false),
          is_multiline: entries.some((entry) => Boolean(entry.is_multiline)),
          is_shown_once: entries.some((entry) => Boolean(entry.is_shown_once)),
          has_preview: entries.some((entry) => Boolean(entry.is_preview)),
          variant_count: entries.length,
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private async resolvePanelApplication(
    target: AdminPanelTarget,
  ): Promise<CoolifyApplicationSummary> {
    const app = this.findPanelApplication(
      target,
      await this.coolify.getApplications(),
    );
    if (!app) {
      throw new NotFoundException(
        `Could not find the ${target} application in Coolify.`,
      );
    }
    return app;
  }

  private findPanelApplication(
    target: AdminPanelTarget,
    applications: CoolifyApplicationSummary[],
  ): CoolifyApplicationSummary | undefined {
    const config = this.getPanelTargetConfig(target);

    if (config.overrideUuid) {
      const byUuid = applications.find(
        (app) => app.uuid === config.overrideUuid,
      );
      if (byUuid) return byUuid;
    }

    if (config.overrideName) {
      const byName = applications.find(
        (app) => app.name === config.overrideName,
      );
      if (byName) return byName;
    }

    return applications.find(
      (app) =>
        config.defaultNames.includes(app.name) ||
        (app.base_directory
          ? config.defaultBaseDirectories.includes(app.base_directory)
          : false),
    );
  }

  private isPanelApplication(app: CoolifyApplicationSummary): boolean {
    return (['backend', 'frontend'] as const).some((target) => {
      const config = this.getPanelTargetConfig(target);

      return (
        (config.overrideUuid.length > 0 && app.uuid === config.overrideUuid) ||
        (config.overrideName.length > 0 && app.name === config.overrideName) ||
        config.defaultNames.includes(app.name) ||
        (app.base_directory
          ? config.defaultBaseDirectories.includes(app.base_directory)
          : false)
      );
    });
  }

  private normalizePanelTarget(target: string): AdminPanelTarget {
    if (target === 'backend' || target === 'frontend') {
      return target;
    }
    throw new BadRequestException('target must be "backend" or "frontend".');
  }

  private getPanelTargetConfig(target: AdminPanelTarget) {
    if (target === 'backend') {
      return {
        defaultNames: ['getaeon-backend', 'zephyrcloud-backend'],
        defaultBaseDirectories: ['/getaeon-backend', '/zephyrcloud-backend'],
        overrideName: (process.env.ADMIN_PANEL_BACKEND_APP_NAME ?? '').trim(),
        overrideUuid: (process.env.ADMIN_PANEL_BACKEND_APP_UUID ?? '').trim(),
      };
    }

    return {
      defaultNames: [
        'getaeon-panel',
        'getaeon-frontend',
        'zephyrcloud-frontend',
      ],
      defaultBaseDirectories: ['/getaeon-panel', '/zephyrcloud-panel'],
      overrideName: (process.env.ADMIN_PANEL_FRONTEND_APP_NAME ?? '').trim(),
      overrideUuid: (process.env.ADMIN_PANEL_FRONTEND_APP_UUID ?? '').trim(),
    };
  }

  private async reloadPanelApplication(
    applicationUuid: string,
    requiresDeploy: boolean,
  ): Promise<void> {
    if (requiresDeploy) {
      await this.coolify.deployResource('application', applicationUuid, {
        force: true,
        instantDeploy: true,
      });
      return;
    }

    await this.coolify.restartResource('application', applicationUuid);
  }

  private toBigIntStrict(value: string, fieldName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(
        `${fieldName} must be a valid integer string`,
      );
    }
  }
}
