import * as React from "react";
import { Form } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  History,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";

import { cn } from "~/lib/utils";

export type Site = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "static" | "php" | "python";
  status: string;
  cpu_limit?: number;
  memory_mb?: number;
  primaryDomain?: string | null;
  default_domain_target?: string | null;
  repo_url?: string;
  repo_branch?: string;
  created_at?: string;
  build_command?: string | null;
  install_command?: string | null;
  start_command?: string | null;
};

export type Deployment = {
  id: string;
  created_at?: string;
  status: string;
  commit_message?: string;
  commit_hash?: string;
  triggered_by?: string;
};

export type Domain = {
  id: string;
  domain: string;
  status?: string;
  ssl_enabled?: boolean;
  target_hostname?: string | null;
  routing_mode?: "subdomain_cname" | "apex_flattening" | "apex_alias" | null;
  diagnostic_message?: string | null;
  verification_checked_at?: string | null;
  verification_started_at?: string | null;
  verified_at?: string | null;
  ssl_ready_at?: string | null;
  retry_count?: number;
  created_at?: string;
};

export type DBInfo = {
  engine: "mariadb" | "mysql" | "postgres" | "postgresql";
  host: string;
  port: number;
  username: string;
  db_name: string;
  password?: string;
  public_url: string | null;
  ssl_mode: string | null;
  is_public: boolean;
};

export type EnvVar = {
  key: string;
  value: string;
  is_preview?: boolean;
  is_multiline?: boolean;
  is_shown_once?: boolean;
  is_buildtime?: boolean;
  is_build_time?: boolean;
  is_literal?: boolean;
};

export type TeamRole = "viewer" | "editor";
export type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: TeamRole;
  created_at?: string;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "revoked";
  created_at?: string;
};

export type TeamInfo = {
  can_write: boolean;
  members: TeamMember[];
  invites: TeamInvite[];
};

export type StatusPayload =
  | { ok: true; status: string; source?: string; updatedAt?: string; raw?: unknown }
  | { ok: false; error: string };

export type SiteStorageItem = {
  id: string;
  volume_name: string;
  mount_path: string;
  size_gb: number;
  is_default: boolean;
  created_at?: string;
};

export type SiteStorageSummary = {
  site_id: string;
  tenant_id: string;
  limits: {
    max_storage_gb_total: number;
  };
  usage: {
    assigned_gb: number;
    remaining_gb: number;
    percentage: number;
  };
  items: SiteStorageItem[];
};

export type SiteMetricsPayload =
  | {
      ok: true;
      site_id: string;
      refreshed_at: string;
      availability: { enabled: boolean; reason?: string };
      limits: { cpu_limit: number; memory_mb: number };
      current: {
        cpu_percent: number | null;
        cpu_limit_percentage: number | null;
        memory_used_mb: number | null;
        memory_percentage: number | null;
      };
      history: {
        cpu: Array<{ time: string; percent: number }>;
        memory: Array<{
          time: string;
          used_mb: number;
          total_mb: number | null;
          used_percent: number;
        }>;
      };
    }
  | { ok: false; error: string };

export type NormalizedSiteStatus =
  | "RUNNING"
  | "STOPPED"
  | "BUILDING"
  | "PROVISIONING"
  | "ERROR"
  | "UNKNOWN";

export type LogsPayload =
  | {
      ok: true;
      logs: string;
      lines?: number;
      updatedAt?: string;
      source?: string;
    }
  | { ok: false; error: string };

export type DbTablesPayload =
  | {
      ok: true;
      connected: boolean;
      database: string;
      engine: string;
      tables: Array<{ name: string; approxRows: number | null }>;
    }
  | { ok: false; error: string };

export type DbRowsPayload =
  | {
      ok: true;
      table: string;
      columns: string[];
      rows: Record<string, unknown>[];
      limit: number;
      offset: number;
      hasMore: boolean;
      nextOffset: number | null;
    }
  | { ok: false; error: string };

export type SiteSettingsSection = "configuration" | "access" | "danger";
export type SiteDatabaseView = "credentials" | "browser";

export type SiteRouteContext = {
  site: Site;
  deployments: Deployment[];
  domains: Domain[];
  db: DBInfo | null;
  envs: EnvVar[];
  team: TeamInfo;
  storages: SiteStorageSummary | null;
  dnsTarget: {
    value: string;
    recordType: string;
    isConfigured: boolean;
  };
  displayStatus: string;
  canManageTeam: boolean;
  currentIntent: string;
  isSubmitting: boolean;
  actionPath: string;
};

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function normalizeStatus(status: string): NormalizedSiteStatus {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("run") || normalized.includes("healthy") || normalized === "up") {
    return "RUNNING";
  }
  if (
    normalized.includes("stop") ||
    normalized.includes("down") ||
    normalized.includes("exited") ||
    normalized.includes("removed")
  ) {
    return "STOPPED";
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("crash") ||
    normalized.includes("unhealthy")
  ) {
    return "ERROR";
  }
  if (
    normalized.includes("build") ||
    normalized.includes("deploy") ||
    normalized.includes("queu") ||
    normalized.includes("progress") ||
    normalized.includes("pull")
  ) {
    return "BUILDING";
  }
  if (
    normalized.includes("provision") ||
    normalized.includes("restart") ||
    normalized.includes("prepar") ||
    normalized.includes("starting") ||
    normalized.includes("pending") ||
    normalized.includes("creat")
  ) {
    return "PROVISIONING";
  }
  return "UNKNOWN";
}

export function statusClass(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "RUNNING") {
    return "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]";
  }
  if (normalized === "BUILDING") {
    return "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]";
  }
  if (normalized === "PROVISIONING") {
    return "border-[var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]";
  }
  if (normalized === "ERROR") {
    return "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]";
  }
  if (normalized === "STOPPED") {
    return "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
  }
  return "border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]";
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
        statusClass(status),
      )}
    >
      {normalized === "BUILDING" || normalized === "PROVISIONING" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : null}
      {normalized === "RUNNING" ? <span className="h-2 w-2 bg-current" aria-hidden="true" /> : null}
      {normalized === "STOPPED"
        ? "Stopped"
        : normalized === "BUILDING"
          ? "Building"
          : normalized === "PROVISIONING"
            ? "Provisioning"
          : normalized === "ERROR"
            ? "Error"
            : normalized === "RUNNING"
              ? "Running"
              : status || "Unknown"}
    </span>
  );
}

export function DeploymentStatusIcon({ status }: { status: string }) {
  const value = status.toLowerCase();
  if (value === "success" || value === "finished") {
    return <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />;
  }
  if (value === "failed" || value === "error") {
    return <XCircle className="h-4 w-4 text-[var(--danger)]" />;
  }
  if (value === "queued" || value === "pending") {
    return <History className="h-4 w-4 text-[var(--text-muted)]" />;
  }
  return <Loader2 className="h-4 w-4 animate-spin text-[var(--warning)]" />;
}

export function extractGithubRepoRef(input: string) {
  const value = input.trim();
  if (!value) return null;

  const simple = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (simple) return `${simple[1]}/${simple[2]}`;

  const https = value.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/i,
  );
  if (https) {
    return `${https[1]}/${https[2].replace(/\.git$/i, "")}`;
  }

  const ssh = value.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) {
    return `${ssh[1]}/${ssh[2].replace(/\.git$/i, "")}`;
  }

  return null;
}

export function domainStatusMeta(domain: Domain) {
  const status = String(domain.status || "").toLowerCase();
  if (status.includes("timeout")) {
    return {
      label: "Verification timed out",
      className: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
    };
  }
  if (status.includes("verified")) {
    return {
      label: "DNS verified",
      className: "border-[var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]",
    };
  }
  if (status.includes("attaching")) {
    return {
      label: "Attaching",
      className: "border-[var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]",
    };
  }
  if (status.includes("ssl_issuing")) {
    return {
      label: "Issuing SSL",
      className: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
    };
  }
  if (status.includes("pending")) {
    return {
      label: "Pending DNS",
      className: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
    };
  }
  if (status.includes("error") || status.includes("fail")) {
    return {
      label: "Needs attention",
      className: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
    };
  }
  if (domain.ssl_enabled) {
    return {
      label: "Active + SSL",
      className: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
    };
  }
  return {
    label: status ? status.replace(/_/g, " ") : "Configured",
    className: "border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]",
  };
}

export function domainRecordType(domain: Domain) {
  if (domain.routing_mode === "apex_alias") {
    return "ALIAS / ANAME";
  }
  return "CNAME";
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // noop
  }
}

export function SiteSectionCard({
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function KeyValueField({
  label,
  value,
  mono = false,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
            {label}
          </div>
          <div
            className={cn(
              "mt-1.5 break-all text-xs text-[var(--foreground)]",
              mono && "font-mono",
            )}
          >
            {value}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function ActionRow({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-soft)]">{icon}</span>
        <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
      >
        {content}
      </button>
    );
  }

  return (
    <button
      type="submit"
      className="flex min-h-11 w-full items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
    >
      {content}
    </button>
  );
}

export function InlineAlert({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border px-3 py-2.5 text-xs",
        tone === "danger"
          ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
          : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EnvRow({ env, actionPath }: { env: EnvVar; actionPath: string }) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="flex items-center gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs font-medium text-[var(--foreground)]">{env.key}</div>
        <div className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">
          {show ? env.value : "****************"}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {env.is_literal !== false ? (
            <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              literal
            </span>
          ) : null}
          {env.is_preview ? (
            <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              preview
            </span>
          ) : null}
          {env.is_multiline ? (
            <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              multiline
            </span>
          ) : null}
          {env.is_shown_once ? (
            <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              shown-once
            </span>
          ) : null}
          {env.is_buildtime || env.is_build_time ? (
            <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              build-time
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          className="border border-[var(--line)] bg-[var(--surface)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void copyToClipboard(env.value)}
          className="border border-[var(--line)] bg-[var(--surface)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
          title="Copy value"
        >
          <Copy className="h-4 w-4" />
        </button>
        <Form
          method="post"
          action={actionPath}
          onSubmit={(event) => {
            if (!confirm("Delete this variable?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="deleteEnv" />
          <input type="hidden" name="key" value={env.key} />
          <button
            type="submit"
            className="border border-[var(--danger)] bg-[var(--danger-soft)] p-2 text-[var(--danger)] transition-colors hover:opacity-85"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Form>
      </div>
    </div>
  );
}
