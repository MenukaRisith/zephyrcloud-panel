import type { TenantPlanResources } from './tenant-plan';

export const MIN_SITE_CPU_LIMIT = 0.1;
export const MIN_SITE_MEMORY_MB = 128;

const CPU_SCALE = 100;
const MIN_SITE_CPU_UNITS = Math.round(MIN_SITE_CPU_LIMIT * CPU_SCALE);

export type TenantAllocatableSite<TId extends string | bigint = string> = {
  id: TId;
  createdAt: Date;
};

export type TenantSiteAllocation<TId extends string | bigint = string> = {
  id: TId;
  cpuLimit: number;
  memoryMb: number;
};

export class TenantResourceAllocationError extends Error {
  public constructor(
    public readonly code:
      | 'site_limit'
      | 'insufficient_cpu_pool'
      | 'insufficient_memory_pool',
    message: string,
  ) {
    super(message);
    this.name = 'TenantResourceAllocationError';
  }
}

export function assertTenantSiteCountWithinLimit(
  resources: Pick<TenantPlanResources, 'maxSites'>,
  siteCount: number,
): void {
  if (siteCount > resources.maxSites) {
    throw new TenantResourceAllocationError(
      'site_limit',
      `This tenant has reached its site limit (${resources.maxSites}).`,
    );
  }
}

export function sortSitesForAllocation<
  TId extends string | bigint,
  T extends TenantAllocatableSite<TId>,
>(
  sites: T[],
): T[] {
  return [...sites].sort((left, right) => {
    const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdAtDiff !== 0) return createdAtDiff;
    return String(left.id).localeCompare(String(right.id), 'en', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

export function buildTenantSiteAllocations<
  TId extends string | bigint = string,
>(
  resources: Pick<
    TenantPlanResources,
    'maxSites' | 'maxCpuTotal' | 'maxMemoryMbTotal'
  >,
  sites: TenantAllocatableSite<TId>[],
): TenantSiteAllocation<TId>[] {
  if (sites.length === 0) {
    return [];
  }

  const sortedSites = sortSitesForAllocation(sites);
  const cpuUnits = splitUnits(
    Math.round(resources.maxCpuTotal * CPU_SCALE),
    sortedSites.length,
  );
  const memoryUnits = splitUnits(
    Math.trunc(resources.maxMemoryMbTotal),
    sortedSites.length,
  );

  if (cpuUnits.some((value) => value < MIN_SITE_CPU_UNITS)) {
    throw new TenantResourceAllocationError(
      'insufficient_cpu_pool',
      `This tenant needs at least ${MIN_SITE_CPU_LIMIT.toFixed(1)} CPU per site across ${sortedSites.length} sites.`,
    );
  }

  if (memoryUnits.some((value) => value < MIN_SITE_MEMORY_MB)) {
    throw new TenantResourceAllocationError(
      'insufficient_memory_pool',
      `This tenant needs at least ${MIN_SITE_MEMORY_MB}MB of memory per site across ${sortedSites.length} sites.`,
    );
  }

  return sortedSites.map((site, index) => ({
    id: site.id,
    cpuLimit: cpuUnits[index] / CPU_SCALE,
    memoryMb: memoryUnits[index],
  }));
}

function splitUnits(totalUnits: number, count: number): number[] {
  if (count <= 0) return [];

  const safeUnits = Math.max(0, Math.trunc(totalUnits));
  const base = Math.floor(safeUnits / count);
  let remainder = safeUnits % count;

  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
    return value;
  });
}
