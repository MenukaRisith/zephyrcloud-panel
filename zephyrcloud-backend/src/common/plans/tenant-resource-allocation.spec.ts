import {
  assertTenantSiteCountWithinLimit,
  buildTenantSiteAllocations,
  TenantResourceAllocationError,
} from './tenant-resource-allocation';

describe('tenant resource allocation', () => {
  const createdAt = new Date('2026-04-14T10:00:00.000Z');

  it('gives a single site the full workspace pool', () => {
    const allocations = buildTenantSiteAllocations(
      {
        maxSites: 3,
        maxCpuTotal: 2,
        maxMemoryMbTotal: 1024,
      },
      [{ id: 'site-1', createdAt }],
    );

    expect(allocations).toEqual([
      { id: 'site-1', cpuLimit: 2, memoryMb: 1024 },
    ]);
  });

  it('rebalances existing sites equally when a second site is added', () => {
    const allocations = buildTenantSiteAllocations(
      {
        maxSites: 3,
        maxCpuTotal: 2,
        maxMemoryMbTotal: 1024,
      },
      [
        { id: 'site-1', createdAt },
        { id: 'site-2', createdAt: new Date('2026-04-14T11:00:00.000Z') },
      ],
    );

    expect(allocations).toEqual([
      { id: 'site-1', cpuLimit: 1, memoryMb: 512 },
      { id: 'site-2', cpuLimit: 1, memoryMb: 512 },
    ]);
  });

  it('preserves total cpu and memory with stable remainder distribution', () => {
    const allocations = buildTenantSiteAllocations(
      {
        maxSites: 4,
        maxCpuTotal: 1,
        maxMemoryMbTotal: 1000,
      },
      [
        { id: '3', createdAt },
        { id: '1', createdAt },
        { id: '2', createdAt },
      ],
    );

    expect(allocations).toEqual([
      { id: '1', cpuLimit: 0.34, memoryMb: 334 },
      { id: '2', cpuLimit: 0.33, memoryMb: 333 },
      { id: '3', cpuLimit: 0.33, memoryMb: 333 },
    ]);
    expect(allocations.reduce((total, site) => total + site.cpuLimit, 0)).toBe(
      1,
    );
    expect(
      allocations.reduce((total, site) => total + site.memoryMb, 0),
    ).toBe(1000);
  });

  it('rejects allocations that cannot keep the minimum cpu per site', () => {
    expect(() =>
      buildTenantSiteAllocations(
        {
          maxSites: 3,
          maxCpuTotal: 0.2,
          maxMemoryMbTotal: 1024,
        },
        [
          { id: 'site-1', createdAt },
          { id: 'site-2', createdAt },
          { id: 'site-3', createdAt },
        ],
      ),
    ).toThrow(
      new TenantResourceAllocationError(
        'insufficient_cpu_pool',
        'This tenant needs at least 0.1 CPU per site across 3 sites.',
      ),
    );
  });

  it('rejects allocations that cannot keep the minimum memory per site', () => {
    expect(() =>
      buildTenantSiteAllocations(
        {
          maxSites: 3,
          maxCpuTotal: 3,
          maxMemoryMbTotal: 256,
        },
        [
          { id: 'site-1', createdAt },
          { id: 'site-2', createdAt },
          { id: 'site-3', createdAt },
        ],
      ),
    ).toThrow(
      new TenantResourceAllocationError(
        'insufficient_memory_pool',
        'This tenant needs at least 128MB of memory per site across 3 sites.',
      ),
    );
  });

  it('recomputes larger shares when a site is removed or the pool grows', () => {
    const twoSites = buildTenantSiteAllocations(
      {
        maxSites: 4,
        maxCpuTotal: 4,
        maxMemoryMbTotal: 2048,
      },
      [
        { id: 'site-1', createdAt },
        { id: 'site-2', createdAt: new Date('2026-04-14T11:00:00.000Z') },
      ],
    );
    const oneSite = buildTenantSiteAllocations(
      {
        maxSites: 4,
        maxCpuTotal: 4,
        maxMemoryMbTotal: 2048,
      },
      [{ id: 'site-1', createdAt }],
    );
    const upgradedPool = buildTenantSiteAllocations(
      {
        maxSites: 4,
        maxCpuTotal: 6,
        maxMemoryMbTotal: 3072,
      },
      [
        { id: 'site-1', createdAt },
        { id: 'site-2', createdAt: new Date('2026-04-14T11:00:00.000Z') },
      ],
    );

    expect(twoSites).toEqual([
      { id: 'site-1', cpuLimit: 2, memoryMb: 1024 },
      { id: 'site-2', cpuLimit: 2, memoryMb: 1024 },
    ]);
    expect(oneSite).toEqual([{ id: 'site-1', cpuLimit: 4, memoryMb: 2048 }]);
    expect(upgradedPool).toEqual([
      { id: 'site-1', cpuLimit: 3, memoryMb: 1536 },
      { id: 'site-2', cpuLimit: 3, memoryMb: 1536 },
    ]);
  });

  it('blocks counts above the workspace site limit', () => {
    expect(() =>
      assertTenantSiteCountWithinLimit({ maxSites: 2 }, 3),
    ).toThrow(
      new TenantResourceAllocationError(
        'site_limit',
        'This tenant has reached its site limit (2).',
      ),
    );
  });
});
