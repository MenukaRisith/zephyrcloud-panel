import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/auth.types';
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

  public async restartPanelApp(
    user: JwtPayload,
    target: AdminPanelTarget | string,
  ) {
    this.requireAdmin(user);
    const normalizedTarget = this.normalizePanelTarget(target);
    const app = await this.resolvePanelApplication(normalizedTarget);
    await this.coolify.restartResource('application', app.uuid);
    return { ok: true, target: normalizedTarget, action: 'restart' };
  }

  public async redeployPanelApp(
    user: JwtPayload,
    target: AdminPanelTarget | string,
  ) {
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
    target: AdminPanelTarget | string,
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

  public async deletePanelEnv(
    user: JwtPayload,
    target: AdminPanelTarget | string,
    key: string,
  ) {
    this.requireAdmin(user);
    const normalizedTarget = this.normalizePanelTarget(target);
    const app = await this.resolvePanelApplication(normalizedTarget);
    const existingEnvs = await this.coolify.getEnvs(app.uuid);
    const matching = existingEnvs.filter((env) => env.key === key);

    if (!matching.length) {
      throw new NotFoundException(`Environment variable "${key}" was not found.`);
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
          },
        },
        _count: {
          select: {
            site_members: true,
          },
        },
      },
    });

    const normalized = users
      .map((entry) => ({
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
        site_memberships: entry._count.site_members,
      }))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return b.created_at.getTime() - a.created_at.getTime();
      });

    return {
      stats: {
        total_users: normalized.length,
        active_users: normalized.filter((entry) => entry.is_active).length,
        admin_users: normalized.filter((entry) => entry.role === 'admin').length,
      },
      admin_emails: normalized
        .filter((entry) => entry.role === 'admin')
        .map((entry) => entry.email),
      users: normalized,
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
    },
  ) {
    this.requireAdmin(currentUser);
    const userId = this.toBigIntStrict(id, 'userId');
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, is_active: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    const data: {
      name?: string;
      email?: string;
      role?: Role;
      is_active?: boolean;
    } = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    if (body.role !== undefined) data.role = body.role;
    if (body.is_active !== undefined) data.is_active = body.is_active;

    if (!Object.keys(data).length) {
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
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
      user: {
        id: updated.id.toString(),
        email: updated.email,
        name: updated.name,
        role: updated.role,
        is_active: updated.is_active,
        created_at: updated.created_at,
        last_login_at: updated.last_login_at,
        tenant_id: updated.tenant?.id?.toString() ?? null,
        tenant_name: updated.tenant?.name ?? null,
        tenant_slug: updated.tenant?.slug ?? null,
        site_memberships: updated._count.site_members,
      },
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
      const byUuid = applications.find((app) => app.uuid === config.overrideUuid);
      if (byUuid) return byUuid;
    }

    if (config.overrideName) {
      const byName = applications.find((app) => app.name === config.overrideName);
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
