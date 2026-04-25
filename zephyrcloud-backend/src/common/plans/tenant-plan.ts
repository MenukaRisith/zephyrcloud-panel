import { HostingPackageKind, SubscriptionPlan } from '@prisma/client';

export type TenantPlanResources = {
  maxSites: number;
  maxCpuTotal: number;
  maxMemoryMbTotal: number;
  maxStorageGbTotal: number;
  maxTeamMembersPerSite: number;
};

export type TenantWithPlanOverrides = {
  plan: SubscriptionPlan;
  package?: {
    kind: HostingPackageKind;
    is_active: boolean;
    max_sites?: number | null;
    max_cpu_total?: number | null;
    max_memory_mb_total?: number | null;
    max_storage_gb_total?: number | null;
    max_team_members_per_site?: number | null;
  } | null;
  max_sites?: number | null;
  max_cpu_total?: number | null;
  max_memory_mb_total?: number | null;
  max_storage_gb_total?: number | null;
  max_cpu_per_site?: number | null;
  max_memory_mb_per_site?: number | null;
  max_team_members_per_site?: number | null;
};

export const TENANT_PLAN_CATALOG: Record<
  SubscriptionPlan,
  {
    label: string;
    description: string;
    resources: TenantPlanResources;
  }
> = {
  FREE: {
    label: 'Free',
    description: 'Starter workspace for basic trials and internal demos.',
    resources: {
      maxSites: 1,
      maxCpuTotal: 1,
      maxMemoryMbTotal: 512,
      maxStorageGbTotal: 5,
      maxTeamMembersPerSite: 1,
    },
  },
  PRO: {
    label: 'Pro',
    description: 'Single-team production workloads with light collaboration.',
    resources: {
      maxSites: 3,
      maxCpuTotal: 2,
      maxMemoryMbTotal: 1024,
      maxStorageGbTotal: 20,
      maxTeamMembersPerSite: 3,
    },
  },
  DRIFT_START: {
    label: 'Drift Start',
    description: 'Growth stage tenant with a modest project portfolio.',
    resources: {
      maxSites: 5,
      maxCpuTotal: 2,
      maxMemoryMbTotal: 2048,
      maxStorageGbTotal: 50,
      maxTeamMembersPerSite: 5,
    },
  },
  DRIFT_CORE: {
    label: 'Drift Core',
    description: 'Mainline production plan for active customer teams.',
    resources: {
      maxSites: 15,
      maxCpuTotal: 4,
      maxMemoryMbTotal: 4096,
      maxStorageGbTotal: 150,
      maxTeamMembersPerSite: 10,
    },
  },
  DRIFT_PLUS: {
    label: 'Drift Plus',
    description: 'Higher-capacity plan for larger delivery teams.',
    resources: {
      maxSites: 40,
      maxCpuTotal: 8,
      maxMemoryMbTotal: 8192,
      maxStorageGbTotal: 500,
      maxTeamMembersPerSite: 25,
    },
  },
  DRIFT_GLOBAL: {
    label: 'Drift Global',
    description: 'Enterprise-scale plan with wide operational headroom.',
    resources: {
      maxSites: 100,
      maxCpuTotal: 16,
      maxMemoryMbTotal: 16384,
      maxStorageGbTotal: 1500,
      maxTeamMembersPerSite: 100,
    },
  },
};

export function resolveTenantPlanResources(
  tenant: TenantWithPlanOverrides,
): TenantPlanResources {
  const defaults = resolvePackageResourceDefaults(tenant);

  return {
    maxSites: normalizePositiveInt(tenant.max_sites, defaults.maxSites),
    maxCpuTotal: normalizePositiveNumber(
      tenant.max_cpu_total ?? tenant.max_cpu_per_site,
      defaults.maxCpuTotal,
    ),
    maxMemoryMbTotal: normalizePositiveInt(
      tenant.max_memory_mb_total ?? tenant.max_memory_mb_per_site,
      defaults.maxMemoryMbTotal,
    ),
    maxStorageGbTotal: normalizePositiveInt(
      tenant.max_storage_gb_total,
      defaults.maxStorageGbTotal,
    ),
    maxTeamMembersPerSite: normalizePositiveInt(
      tenant.max_team_members_per_site,
      defaults.maxTeamMembersPerSite,
    ),
  };
}

function resolvePackageResourceDefaults(
  tenant: TenantWithPlanOverrides,
): TenantPlanResources {
  const legacyDefaults = TENANT_PLAN_CATALOG[tenant.plan].resources;
  const pkg = tenant.package;
  if (!pkg?.is_active) {
    return legacyDefaults;
  }

  if (pkg.kind !== HostingPackageKind.WEB) {
    return {
      maxSites: 0,
      maxCpuTotal: normalizePositiveNumber(
        pkg.max_cpu_total,
        legacyDefaults.maxCpuTotal,
      ),
      maxMemoryMbTotal: normalizePositiveInt(
        pkg.max_memory_mb_total,
        legacyDefaults.maxMemoryMbTotal,
      ),
      maxStorageGbTotal: normalizePositiveInt(
        pkg.max_storage_gb_total,
        legacyDefaults.maxStorageGbTotal,
      ),
      maxTeamMembersPerSite: normalizePositiveInt(
        pkg.max_team_members_per_site,
        1,
      ),
    };
  }

  return {
    maxSites: normalizePositiveInt(pkg.max_sites, legacyDefaults.maxSites),
    maxCpuTotal: normalizePositiveNumber(
      pkg.max_cpu_total,
      legacyDefaults.maxCpuTotal,
    ),
    maxMemoryMbTotal: normalizePositiveInt(
      pkg.max_memory_mb_total,
      legacyDefaults.maxMemoryMbTotal,
    ),
    maxStorageGbTotal: normalizePositiveInt(
      pkg.max_storage_gb_total,
      legacyDefaults.maxStorageGbTotal,
    ),
    maxTeamMembersPerSite: normalizePositiveInt(
      pkg.max_team_members_per_site,
      legacyDefaults.maxTeamMembersPerSite,
    ),
  };
}

function normalizePositiveInt(
  value: number | null | undefined,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.trunc(value);
}

function normalizePositiveNumber(
  value: number | null | undefined,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}
