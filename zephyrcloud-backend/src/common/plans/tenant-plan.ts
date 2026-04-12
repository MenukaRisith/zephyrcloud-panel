import { SubscriptionPlan } from '@prisma/client';

export type TenantPlanResources = {
  maxSites: number;
  maxCpuPerSite: number;
  maxMemoryMbPerSite: number;
  maxTeamMembersPerSite: number;
};

export type TenantWithPlanOverrides = {
  plan: SubscriptionPlan;
  max_sites?: number | null;
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
      maxCpuPerSite: 1,
      maxMemoryMbPerSite: 512,
      maxTeamMembersPerSite: 1,
    },
  },
  PRO: {
    label: 'Pro',
    description: 'Single-team production workloads with light collaboration.',
    resources: {
      maxSites: 3,
      maxCpuPerSite: 2,
      maxMemoryMbPerSite: 1024,
      maxTeamMembersPerSite: 3,
    },
  },
  DRIFT_START: {
    label: 'Drift Start',
    description: 'Growth stage tenant with a modest project portfolio.',
    resources: {
      maxSites: 5,
      maxCpuPerSite: 2,
      maxMemoryMbPerSite: 2048,
      maxTeamMembersPerSite: 5,
    },
  },
  DRIFT_CORE: {
    label: 'Drift Core',
    description: 'Mainline production plan for active customer teams.',
    resources: {
      maxSites: 15,
      maxCpuPerSite: 4,
      maxMemoryMbPerSite: 4096,
      maxTeamMembersPerSite: 10,
    },
  },
  DRIFT_PLUS: {
    label: 'Drift Plus',
    description: 'Higher-capacity plan for larger delivery teams.',
    resources: {
      maxSites: 40,
      maxCpuPerSite: 8,
      maxMemoryMbPerSite: 8192,
      maxTeamMembersPerSite: 25,
    },
  },
  DRIFT_GLOBAL: {
    label: 'Drift Global',
    description: 'Enterprise-scale plan with wide operational headroom.',
    resources: {
      maxSites: 100,
      maxCpuPerSite: 16,
      maxMemoryMbPerSite: 16384,
      maxTeamMembersPerSite: 100,
    },
  },
};

export function resolveTenantPlanResources(
  tenant: TenantWithPlanOverrides,
): TenantPlanResources {
  const defaults = TENANT_PLAN_CATALOG[tenant.plan].resources;

  return {
    maxSites: normalizePositiveInt(tenant.max_sites, defaults.maxSites),
    maxCpuPerSite: normalizePositiveNumber(
      tenant.max_cpu_per_site,
      defaults.maxCpuPerSite,
    ),
    maxMemoryMbPerSite: normalizePositiveInt(
      tenant.max_memory_mb_per_site,
      defaults.maxMemoryMbPerSite,
    ),
    maxTeamMembersPerSite: normalizePositiveInt(
      tenant.max_team_members_per_site,
      defaults.maxTeamMembersPerSite,
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
