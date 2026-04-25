import { HostingPackageKind } from '@prisma/client';
import {
  PackageAccessError,
  assertPackageAllowsN8nServices,
  assertPackageAllowsWebSites,
  packageAllowsN8nServices,
  packageAllowsWebSites,
} from './package-access';

describe('package access checks', () => {
  it('allows active web packages to create sites only', () => {
    const pkg = { kind: HostingPackageKind.WEB, is_active: true };

    expect(packageAllowsWebSites(pkg)).toBe(true);
    expect(packageAllowsN8nServices(pkg)).toBe(false);
    expect(() => assertPackageAllowsWebSites(pkg)).not.toThrow();
    expect(() => assertPackageAllowsN8nServices(pkg)).toThrow(
      PackageAccessError,
    );
  });

  it('allows active n8n packages to create n8n services only', () => {
    const pkg = { kind: HostingPackageKind.N8N, is_active: true };

    expect(packageAllowsN8nServices(pkg)).toBe(true);
    expect(packageAllowsWebSites(pkg)).toBe(false);
    expect(() => assertPackageAllowsN8nServices(pkg)).not.toThrow();
    expect(() => assertPackageAllowsWebSites(pkg)).toThrow(PackageAccessError);
  });

  it('blocks inactive packages', () => {
    const pkg = { kind: HostingPackageKind.WEB, is_active: false };

    expect(packageAllowsWebSites(pkg)).toBe(false);
    expect(() => assertPackageAllowsWebSites(pkg)).toThrow(
      /package is inactive/i,
    );
  });

  it('keeps legacy plan fallback available when requested', () => {
    expect(packageAllowsWebSites(null)).toBe(false);
    expect(packageAllowsWebSites(null, { allowLegacyPlanFallback: true })).toBe(
      true,
    );
  });
});
