import * as React from "react";
import { Form, useFetcher, useOutletContext } from "react-router";
import {
  Activity,
  ExternalLink,
  Globe,
  HardDrive,
  RefreshCw,
  Rocket,
  Terminal,
} from "lucide-react";

import {
  ActionRow,
  DeploymentStatusIcon,
  SiteSectionCard,
  type SiteMetricsPayload,
  type SiteRouteContext,
} from "./site-detail.shared";

function formatCpuLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, "");
}

function formatMemory(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value)} MB`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

function chartPoints(values: number[], width = 320, height = 96) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, value) / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function HistoryChart({
  values,
  tone = "var(--accent)",
}: {
  values: number[];
  tone?: string;
}) {
  if (!values.length) {
    return (
      <div className="flex h-24 items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[11px] text-[var(--text-muted)]">
        Waiting for live data
      </div>
    );
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-2">
      <svg viewBox="0 0 320 96" className="h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          fill="none"
          stroke={tone}
          strokeWidth="3"
          points={chartPoints(values)}
        />
      </svg>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subcopy,
  chart,
}: {
  label: string;
  value: string;
  subcopy: string;
  chart: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
          {label}
        </div>
        <div className="text-lg font-semibold text-[var(--foreground)]">{value}</div>
        <div className="text-xs text-[var(--text-muted)]">{subcopy}</div>
      </div>
      {chart}
    </div>
  );
}

export default function SiteOverviewPage() {
  const { site, deployments, domains, storages, canManageTeam, actionPath } =
    useOutletContext<SiteRouteContext>();
  const metricsFetcher = useFetcher<SiteMetricsPayload>();

  React.useEffect(() => {
    if (metricsFetcher.state === "idle" && !metricsFetcher.data) {
      metricsFetcher.load(`/sites/${site.id}/metrics`);
    }

    const interval = window.setInterval(() => {
      if (document.hidden || metricsFetcher.state !== "idle") return;
      metricsFetcher.load(`/sites/${site.id}/metrics`);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [metricsFetcher, site.id]);

  const latestDeployment = deployments[0];
  const primaryDomain = (site.primaryDomain || domains[0]?.domain || "").trim();
  const liveSiteUrl = primaryDomain
    ? primaryDomain.startsWith("http://") || primaryDomain.startsWith("https://")
      ? primaryDomain
      : `https://${primaryDomain}`
    : "";
  const metrics = metricsFetcher.data?.ok ? metricsFetcher.data : null;
  const cpuHistory = metrics?.history.cpu.map((point) => point.percent) ?? [];
  const memoryHistory = metrics?.history.memory.map((point) => point.used_mb) ?? [];

  return (
    <div className="space-y-6">
      <SiteSectionCard title="Quick actions" subtitle="Common publishing and operational tasks.">
        {canManageTeam ? (
          <div className="space-y-3">
            <Form method="post" action={actionPath}>
              <input type="hidden" name="intent" value="deploy" />
              <ActionRow label="Publish changes" icon={<Rocket className="h-4 w-4" />} />
            </Form>
            <Form method="post" action={actionPath}>
              <input type="hidden" name="intent" value="deploy_force" />
              <ActionRow label="Rebuild and publish" icon={<RefreshCw className="h-4 w-4" />} />
            </Form>
            <Form method="post" action={actionPath}>
              <input type="hidden" name="intent" value="restart" />
              <ActionRow label="Restart service" icon={<RefreshCw className="h-4 w-4" />} />
            </Form>
          </div>
        ) : (
          <div className="text-xs leading-5 text-[var(--text-muted)]">
            Editing actions are available to editors and workspace owners.
          </div>
        )}
      </SiteSectionCard>

      <SiteSectionCard
        title="Live usage"
        subtitle={
          metrics?.availability.enabled
            ? `Updated ${new Date(metrics.refreshed_at).toLocaleTimeString()}`
            : "CPU and memory charts update automatically when live metrics are available."
        }
      >
        {metrics?.availability.enabled ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricCard
              label="CPU"
              value={formatPercent(metrics.current.cpu_limit_percentage)}
              subcopy={`${formatPercent(metrics.current.cpu_percent)} current container usage against a ${formatCpuLimit(metrics.limits.cpu_limit)} CPU cap`}
              chart={<HistoryChart values={cpuHistory} />}
            />
            <MetricCard
              label="Memory"
              value={formatPercent(metrics.current.memory_percentage)}
              subcopy={`${formatMemory(metrics.current.memory_used_mb)} used of ${formatMemory(metrics.limits.memory_mb)}`}
              chart={<HistoryChart values={memoryHistory} tone="var(--success)" />}
            />
          </div>
        ) : (
          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-xs leading-5 text-[var(--text-muted)]">
            {metrics?.availability.reason || "Live metrics are still being prepared for this site."}
          </div>
        )}
      </SiteSectionCard>

      <SiteSectionCard title="Resource caps" subtitle="Assigned limits and persistent volume allocations.">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <Activity className="h-3.5 w-3.5" />
              CPU cap
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {formatCpuLimit(site.cpu_limit)} CPU
            </div>
          </div>
          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <Activity className="h-3.5 w-3.5" />
              Memory cap
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {formatMemory(site.memory_mb ?? null)}
            </div>
          </div>
          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <HardDrive className="h-3.5 w-3.5" />
              Persistent storage
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {storages ? `${storages.usage.assigned_gb} GB assigned` : "--"}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {storages ? `${storages.usage.remaining_gb} GB left in this workspace` : "Storage details unavailable"}
            </div>
          </div>
        </div>
      </SiteSectionCard>

      <SiteSectionCard
        title="Latest deployment"
        subtitle={
          latestDeployment?.created_at
            ? new Date(latestDeployment.created_at).toLocaleString()
            : "No history yet"
        }
      >
        {latestDeployment ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
              <DeploymentStatusIcon status={latestDeployment.status} />
              {latestDeployment.status.replace(/_/g, " ")}
            </div>
            <div className="text-xs leading-5 text-[var(--text-muted)]">
              {latestDeployment.commit_message || "Published from the dashboard"}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              <span>{latestDeployment.commit_hash?.substring(0, 7) || "---"}</span>
              <span>{latestDeployment.triggered_by || "User"}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">No updates yet.</div>
        )}
      </SiteSectionCard>

      <SiteSectionCard title="Details" subtitle="Core connection and service context.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <Globe className="h-3.5 w-3.5" />
              Primary domain
            </div>
            <div className="mt-2 text-xs text-[var(--foreground)]">
              {primaryDomain ? (
                <a
                  href={liveSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[var(--accent)]"
                >
                  {primaryDomain}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                "Not connected"
              )}
            </div>
          </div>

          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <Terminal className="h-3.5 w-3.5" />
              Persistent mounts
            </div>
            <div className="mt-2 text-xs text-[var(--foreground)]">
              {storages?.items.length ? (
                <div className="space-y-1">
                  {storages.items.map((storage) => (
                    <div key={storage.id} className="font-mono text-[11px]">
                      {storage.mount_path}
                    </div>
                  ))}
                </div>
              ) : (
                "No persistent folders configured"
              )}
            </div>
          </div>
        </div>
      </SiteSectionCard>
    </div>
  );
}
