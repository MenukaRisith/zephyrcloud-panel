import * as React from "react";
import { useFetcher, useOutletContext } from "react-router";
import { ChevronDown, Copy, RefreshCw } from "lucide-react";

import {
  DeploymentStatusIcon,
  InlineAlert,
  SiteSectionCard,
  copyToClipboard,
  type Deployment,
  type LogsPayload,
  type SiteRouteContext,
} from "./site-detail.shared";

function formatDateTime(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function statusLabel(status: string) {
  return (status || "unknown").replace(/_/g, " ");
}

function DeploymentDetails({
  deployment,
  siteId,
}: {
  deployment: Deployment;
  siteId: string;
}) {
  const logsFetcher = useFetcher<LogsPayload>();
  const [copied, setCopied] = React.useState(false);
  const endpoint = `/sites/${siteId}/log-events?lines=300`;
  const fallbackLogs =
    logsFetcher.data && logsFetcher.data.ok ? logsFetcher.data.logs : "";
  const logsText = deployment.logs || fallbackLogs;
  const isLoading = logsFetcher.state === "loading" || logsFetcher.state === "submitting";

  React.useEffect(() => {
    if (!deployment.logs && logsFetcher.state === "idle" && !logsFetcher.data) {
      logsFetcher.load(endpoint);
    }
  }, [deployment.logs, endpoint, logsFetcher]);

  async function handleCopy() {
    const ok = await copyToClipboard(logsText || deployment.issue || "");
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3 border-t border-[var(--line)] px-3 py-3">
      <div className="grid gap-3 text-xs md:grid-cols-3">
        <div>
          <div className="uppercase tracking-[0.16em] text-[var(--text-soft)]">Raw status</div>
          <div className="mt-1 font-mono text-[var(--foreground)]">
            {deployment.raw_status || deployment.status}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-[0.16em] text-[var(--text-soft)]">Created</div>
          <div className="mt-1 text-[var(--foreground)]">{formatDateTime(deployment.created_at)}</div>
        </div>
        <div>
          <div className="uppercase tracking-[0.16em] text-[var(--text-soft)]">Updated</div>
          <div className="mt-1 text-[var(--foreground)]">{formatDateTime(deployment.updated_at)}</div>
        </div>
      </div>

      {deployment.issue ? (
        <InlineAlert tone="danger">{deployment.issue}</InlineAlert>
      ) : null}

      {logsFetcher.data && !logsFetcher.data.ok ? (
        <InlineAlert tone="danger">{logsFetcher.data.error}</InlineAlert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
          Logs
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => logsFetcher.load(endpoint)}
            className="inline-flex min-h-8 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] text-[var(--foreground)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!logsText && !deployment.issue}
            className="inline-flex min-h-8 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] text-[var(--foreground)] disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="border border-[var(--line)] bg-[var(--surface-shell)] p-3 font-mono text-xs leading-5 text-[var(--text-muted)]">
        <pre className="max-h-[420px] min-h-40 overflow-auto whitespace-pre-wrap break-all">
          {logsText || (isLoading ? "Loading logs..." : "No deployment log output is available yet.")}
        </pre>
      </div>
    </div>
  );
}

export default function SiteDeploymentsPage() {
  const { deployments, site } = useOutletContext<SiteRouteContext>();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <SiteSectionCard
      title="Deployment history"
      subtitle="Recent publishes, rebuilds, and background updates."
    >
      {deployments.length > 0 ? (
        <div className="space-y-3">
          {deployments.map((deployment) => {
            const expanded = expandedId === deployment.id;
            return (
              <article
                key={deployment.id}
                className="border border-[var(--line)] bg-[var(--surface)]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : deployment.id)}
                  className="flex w-full flex-col gap-3 px-3 py-3 text-left md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
                      <DeploymentStatusIcon status={deployment.status} />
                      {deployment.commit_message || "Published from the dashboard"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      <span>{deployment.commit_hash?.substring(0, 7) || "---"}</span>
                      <span>{formatDateTime(deployment.created_at)}</span>
                      <span>{deployment.triggered_by || "User"}</span>
                    </div>
                    {deployment.issue ? (
                      <div className="mt-2 text-xs text-[var(--danger)]">
                        {deployment.issue}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {statusLabel(deployment.status)}
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {expanded ? (
                  <DeploymentDetails deployment={deployment} siteId={site.id} />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-[var(--text-muted)]">No updates yet.</div>
      )}
    </SiteSectionCard>
  );
}
