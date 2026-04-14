import { CardDescription, CardTitle } from "~/components/ui/card";
import { softInsetClass } from "~/lib/ui";

export type WorkspaceUsage = {
  tenant_id: string;
  plan: string;
  limits: {
    max_sites: number;
    max_cpu_total: number;
    max_memory_mb_total: number;
    max_storage_gb_total: number;
    max_team_members_per_site: number;
  };
  usage: {
    sites_used: number;
    sites_remaining: number;
    cpu_used: number;
    cpu_remaining: number;
    memory_mb_used: number;
    memory_mb_remaining: number;
    storage_gb_used: number;
    storage_gb_remaining: number;
    site_percentage: number;
    cpu_percentage: number;
    memory_percentage: number;
    storage_percentage: number;
  };
};

export async function safeJson(response: Response) {
  return response.json().catch(() => null);
}

function getNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseWorkspaceUsage(payload: unknown): WorkspaceUsage | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("tenant_id" in payload) ||
    !("limits" in payload) ||
    !("usage" in payload)
  ) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const limits =
    record.limits && typeof record.limits === "object"
      ? (record.limits as Record<string, unknown>)
      : null;
  const usage =
    record.usage && typeof record.usage === "object"
      ? (record.usage as Record<string, unknown>)
      : null;

  if (!limits || !usage || typeof record.tenant_id !== "string") {
    return null;
  }

  return {
    tenant_id: record.tenant_id,
    plan: typeof record.plan === "string" ? record.plan : "FREE",
    limits: {
      max_sites: getNumberValue(limits.max_sites) ?? 0,
      max_cpu_total: getNumberValue(limits.max_cpu_total) ?? 0,
      max_memory_mb_total: getNumberValue(limits.max_memory_mb_total) ?? 0,
      max_storage_gb_total: getNumberValue(limits.max_storage_gb_total) ?? 0,
      max_team_members_per_site:
        getNumberValue(limits.max_team_members_per_site) ?? 0,
    },
    usage: {
      sites_used: getNumberValue(usage.sites_used) ?? 0,
      sites_remaining: getNumberValue(usage.sites_remaining) ?? 0,
      cpu_used: getNumberValue(usage.cpu_used) ?? 0,
      cpu_remaining: getNumberValue(usage.cpu_remaining) ?? 0,
      memory_mb_used: getNumberValue(usage.memory_mb_used) ?? 0,
      memory_mb_remaining: getNumberValue(usage.memory_mb_remaining) ?? 0,
      storage_gb_used: getNumberValue(usage.storage_gb_used) ?? 0,
      storage_gb_remaining: getNumberValue(usage.storage_gb_remaining) ?? 0,
      site_percentage: getNumberValue(usage.site_percentage) ?? 0,
      cpu_percentage: getNumberValue(usage.cpu_percentage) ?? 0,
      memory_percentage: getNumberValue(usage.memory_percentage) ?? 0,
      storage_percentage: getNumberValue(usage.storage_percentage) ?? 0,
    },
  };
}

export function formatCpu(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatMemoryMb(value: number) {
  return `${Math.round(value)} MB`;
}

export function formatStorageGb(value: number) {
  return `${Math.round(value)} GB`;
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

export function WorkspaceUsageCard({
  label,
  used,
  remaining,
  total,
  percentage,
}: {
  label: string;
  used: string;
  remaining: string;
  total: string;
  percentage: number;
}) {
  return (
    <article className={`${softInsetClass} space-y-3 px-4 py-3.5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {label}
        </div>
        <div className="text-[11px] font-medium text-[var(--text-muted)]">
          {formatPercent(percentage)}
        </div>
      </div>
      <div className="h-2 overflow-hidden bg-[var(--surface)]">
        <div className="h-full bg-[var(--accent)]" style={{ width: formatPercent(percentage) }} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            {used}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">used</div>
        </div>
        <div className="text-right text-[11px] text-[var(--text-muted)]">
          <div>{remaining}</div>
          <div>{total}</div>
        </div>
      </div>
    </article>
  );
}

export function WorkspaceUsageSection({
  workspaceUsage,
  title = "Workspace usage",
  description = "CPU and memory are shared across all sites in this workspace.",
  titleAction,
}: {
  workspaceUsage: WorkspaceUsage | null;
  title?: string;
  description?: string;
  titleAction?: React.ReactNode;
}) {
  if (!workspaceUsage) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-xs leading-5">{description}</CardDescription>
        </div>
        {titleAction}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorkspaceUsageCard
          label="Sites"
          used={`${workspaceUsage.usage.sites_used}`}
          remaining={`${workspaceUsage.usage.sites_remaining} left`}
          total={`${workspaceUsage.limits.max_sites} total`}
          percentage={workspaceUsage.usage.site_percentage}
        />
        <WorkspaceUsageCard
          label="CPU pool"
          used={formatCpu(workspaceUsage.usage.cpu_used)}
          remaining={`${formatCpu(workspaceUsage.usage.cpu_remaining)} left`}
          total={`${formatCpu(workspaceUsage.limits.max_cpu_total)} total`}
          percentage={workspaceUsage.usage.cpu_percentage}
        />
        <WorkspaceUsageCard
          label="Memory pool"
          used={formatMemoryMb(workspaceUsage.usage.memory_mb_used)}
          remaining={`${formatMemoryMb(workspaceUsage.usage.memory_mb_remaining)} left`}
          total={`${formatMemoryMb(workspaceUsage.limits.max_memory_mb_total)} total`}
          percentage={workspaceUsage.usage.memory_percentage}
        />
        <WorkspaceUsageCard
          label="Storage pool"
          used={formatStorageGb(workspaceUsage.usage.storage_gb_used)}
          remaining={`${formatStorageGb(workspaceUsage.usage.storage_gb_remaining)} left`}
          total={`${formatStorageGb(workspaceUsage.limits.max_storage_gb_total)} total`}
          percentage={workspaceUsage.usage.storage_percentage}
        />
      </div>
    </div>
  );
}
