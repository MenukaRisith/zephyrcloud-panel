import * as React from "react";
import { useFetcher, useOutletContext } from "react-router";
import { Copy, RefreshCw } from "lucide-react";

import {
  InlineAlert,
  SiteSectionCard,
  copyToClipboard,
  type LogsPayload,
  type SiteRouteContext,
} from "./site-detail.shared";

export default function SiteLogsPage() {
  const { site } = useOutletContext<SiteRouteContext>();
  const logsFetcher = useFetcher<LogsPayload>();
  const [logLines, setLogLines] = React.useState<"100" | "200" | "500" | "1000">("200");
  const [autoRefreshLogs, setAutoRefreshLogs] = React.useState(true);

  const logsLoading = logsFetcher.state === "loading" || logsFetcher.state === "submitting";
  const logsText = logsFetcher.data && logsFetcher.data.ok ? logsFetcher.data.logs : "";

  React.useEffect(() => {
    const endpoint = `/sites/${site.id}/log-events?lines=${encodeURIComponent(logLines)}`;

    if (logsFetcher.state === "idle" && !logsFetcher.data) {
      logsFetcher.load(endpoint);
    }

    if (!autoRefreshLogs) return;

    const interval = window.setInterval(() => {
      if (document.hidden || logsFetcher.state !== "idle") return;
      logsFetcher.load(endpoint);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [autoRefreshLogs, logLines, logsFetcher, site.id]);

  return (
    <SiteSectionCard
      title="Activity log"
      subtitle="Recent service output for this site."
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={autoRefreshLogs}
              onChange={(event) => setAutoRefreshLogs(event.target.checked)}
            />
            Auto-refresh
          </label>
          <select
            value={logLines}
            onChange={(event) =>
              setLogLines(event.target.value as "100" | "200" | "500" | "1000")
            }
            className="min-h-9 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
          >
            <option value="100">100 lines</option>
            <option value="200">200 lines</option>
            <option value="500">500 lines</option>
            <option value="1000">1000 lines</option>
          </select>
          <button
            type="button"
            onClick={() =>
              logsFetcher.load(`/sites/${site.id}/log-events?lines=${encodeURIComponent(logLines)}`)
            }
            className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
          >
            <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void copyToClipboard(logsText)}
            className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>
        </div>
      }
    >
      {logsFetcher.data && !logsFetcher.data.ok ? (
        <InlineAlert tone="danger">{logsFetcher.data.error}</InlineAlert>
      ) : null}

      <div className="mt-3 border border-[var(--line)] bg-[var(--surface-shell)] p-3 font-mono text-xs leading-5 text-[var(--text-muted)]">
        <pre className="min-h-[420px] whitespace-pre-wrap break-all">
          {logsText || (logsLoading ? "Loading logs..." : "Waiting for logs...")}
        </pre>
      </div>
    </SiteSectionCard>
  );
}
