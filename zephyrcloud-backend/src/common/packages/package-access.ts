import {
  HostingPackageKind,
  N8nDeploymentVariant,
} from '@prisma/client';

export type PackageAccessShape = {
  kind: HostingPackageKind;
  is_active: boolean;
} | null | undefined;

export type N8nVariantDetail = {
  key: N8nDeploymentVariant;
  label: string;
  description: string;
};

export const N8N_VARIANT_DETAILS: Record<
  N8nDeploymentVariant,
  N8nVariantDetail
> = {
  SIMPLE: {
    key: N8nDeploymentVariant.SIMPLE,
    label: 'Simple',
    description:
      'One n8n container with a persistent /home/node/.n8n volume. Best for small automations and trials.',
  },
  POSTGRES: {
    key: N8nDeploymentVariant.POSTGRES,
    label: 'With Postgres',
    description:
      'n8n plus PostgreSQL for a stronger production database while keeping the service simple.',
  },
  QUEUE: {
    key: N8nDeploymentVariant.QUEUE,
    label: 'Queue mode',
    description:
      'n8n plus PostgreSQL, Redis, and a worker container for queue-backed execution scaling.',
  },
};

export class PackageAccessError extends Error {
  public constructor(
    public readonly code: 'inactive_package' | 'web_required' | 'n8n_required',
    message: string,
  ) {
    super(message);
    this.name = 'PackageAccessError';
  }
}

export function packageAllowsWebSites(
  pkg: PackageAccessShape,
  options?: { allowLegacyPlanFallback?: boolean },
): boolean {
  if (!pkg) return options?.allowLegacyPlanFallback ?? false;
  return pkg.is_active && pkg.kind === HostingPackageKind.WEB;
}

export function packageAllowsN8nServices(pkg: PackageAccessShape): boolean {
  return Boolean(
    pkg?.is_active && pkg.kind === HostingPackageKind.N8N,
  );
}

export function assertPackageAllowsWebSites(
  pkg: PackageAccessShape,
  options?: { allowLegacyPlanFallback?: boolean },
): void {
  if (packageAllowsWebSites(pkg, options)) return;
  if (pkg && !pkg.is_active) {
    throw new PackageAccessError(
      'inactive_package',
      'This tenant package is inactive.',
    );
  }
  throw new PackageAccessError(
    'web_required',
    'This tenant package does not include web sites.',
  );
}

export function assertPackageAllowsN8nServices(
  pkg: PackageAccessShape,
): void {
  if (packageAllowsN8nServices(pkg)) return;
  if (pkg && !pkg.is_active) {
    throw new PackageAccessError(
      'inactive_package',
      'This tenant package is inactive.',
    );
  }
  throw new PackageAccessError(
    'n8n_required',
    'This tenant package does not include n8n services.',
  );
}
