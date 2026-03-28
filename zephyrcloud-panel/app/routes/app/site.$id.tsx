// app/routes/app/site.$id.tsx
import * as React from "react";
import { Form, useFetcher, useLoaderData, useNavigation } from "react-router";
import { motion } from "framer-motion";
import {
  Boxes,
  Rocket,
  RefreshCw,
  Terminal,
  History,
  Globe,
  Database,
  Settings,
  Loader2,
  Copy,
  Plus,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Eye,
  EyeOff,
  Play,
  Square,
  AlertTriangle, // Added this icon
  Info, // Added this icon
} from "lucide-react";

import { apiFetchAuthed } from "~/services/api.authed.server";

// --- CONFIGURATION ---
// TODO: Replace this with your actual Server Public IP
const SERVER_IP = "15.235.162.182";

// --- Types ---15.235.162.182

type Site = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "static" | "php";
  status: string;
  primaryDomain?: string | null;
  repo_url?: string;
  repo_branch?: string;
  created_at?: string;
};

type Deployment = {
  id: string;
  created_at?: string;
  status: string;
  commit_message?: string;
  commit_hash?: string;
  triggered_by?: string;
};

type Domain = {
  id: string;
  domain: string;
  status?: string;
  created_at?: string;
};

type DBInfo = {
  engine: "mariadb" | "mysql" | "postgres";
  host: string;
  port: number;
  username: string;
  db_name: string;
  password?: string;
};

type EnvVar = {
  key: string;
  value: string;
  is_preview?: boolean;
  is_multiline?: boolean;
  is_shown_once?: boolean;
  is_buildtime?: boolean;
  is_build_time?: boolean;
  is_literal?: boolean;
};
type TeamRole = "viewer" | "editor";
type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: TeamRole;
  created_at?: string;
};
type TeamInvite = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "revoked";
  created_at?: string;
};
type TeamInfo = {
  can_write: boolean;
  members: TeamMember[];
  invites: TeamInvite[];
};

type StatusPayload =
  | { ok: true; status: string; source?: string; updatedAt?: string; raw?: any }
  | { ok: false; error: string };

type LoaderData = {
  site: Site;
  deployments: Deployment[];
  domains: Domain[];
  db: DBInfo | null;
  envs: EnvVar[];
  team: TeamInfo;
};

type LogsPayload =
  | {
      ok: true;
      logs: string;
      lines?: number;
      updatedAt?: string;
      source?: string;
    }
  | { ok: false; error: string };

type DbTablesPayload =
  | {
      ok: true;
      connected: boolean;
      database: string;
      engine: string;
      tables: Array<{ name: string; approxRows: number | null }>;
    }
  | { ok: false; error: string };

type DbRowsPayload =
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

// --- Server Loader ---

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: any;
}): Promise<LoaderData> {
  const id = String(params.id);

  try {
    const [siteRes, depRes, domRes, dbRes, envRes, teamRes] = await Promise.all(
      [
        apiFetchAuthed(request, `/api/sites/${id}`),
        apiFetchAuthed(request, `/api/sites/${id}/deployments`),
        apiFetchAuthed(request, `/api/sites/${id}/domains`),
        apiFetchAuthed(request, `/api/sites/${id}/database`),
        apiFetchAuthed(request, `/api/sites/${id}/envs`),
        apiFetchAuthed(request, `/api/sites/${id}/team`),
      ],
    );

    if (!siteRes.ok) throw new Error("Site not found");

    let db: DBInfo | null = null;
    if (dbRes.ok) {
      try {
        db = await dbRes.json();
      } catch (e) {}
    }

    let envs: EnvVar[] = [];
    if (envRes.ok) {
      try {
        envs = await envRes.json();
      } catch (e) {}
    }

    let team: TeamInfo = { can_write: false, members: [], invites: [] };
    if (teamRes.ok) {
      try {
        const payload = (await teamRes.json()) as TeamInfo;
        team = {
          can_write: Boolean(payload.can_write),
          members: Array.isArray(payload.members) ? payload.members : [],
          invites: Array.isArray(payload.invites) ? payload.invites : [],
        };
      } catch (e) {}
    }

    const site = await siteRes.json();
    const deployments = await depRes.json();
    const domains = await domRes.json();

    return {
      site: site.data || site,
      deployments: Array.isArray(deployments) ? deployments : [],
      domains: Array.isArray(domains) ? domains : [],
      db,
      envs: Array.isArray(envs) ? envs : [],
      team,
    };
  } catch (error) {
    console.error("Loader Error:", error);
    throw new Response("Failed to load site data", { status: 500 });
  }
}

// --- Server Action ---

export async function action({
  request,
  params,
}: {
  request: Request;
  params: any;
}) {
  const id = String(params.id);
  const fd = await request.formData();
  const intent = String(fd.get("intent") || "");

  try {
    if (intent === "deploy") {
      await apiFetchAuthed(request, `/api/sites/${id}/deploy`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "deploy_force") {
      await apiFetchAuthed(request, `/api/sites/${id}/deploy?force=true`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "restart") {
      await apiFetchAuthed(request, `/api/sites/${id}/restart`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "start") {
      await apiFetchAuthed(request, `/api/sites/${id}/start`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "stop") {
      await apiFetchAuthed(request, `/api/sites/${id}/stop`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "addDomain") {
      const domain = String(fd.get("fqdn") || "")
        .trim()
        .toLowerCase();
      if (!domain) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      return null;
    }

    if (intent === "createEnv") {
      const key = String(fd.get("key") || "").trim();
      const value = String(fd.get("value") || "");
      const is_preview = fd.get("is_preview") === "on";
      const is_multiline = fd.get("is_multiline") === "on";
      const is_shown_once = fd.get("is_shown_once") === "on";
      const is_buildtime = fd.get("is_buildtime") === "on";
      const is_literal = fd.get("is_literal") === "on";
      if (!key) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/envs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          value,
          is_preview,
          is_multiline,
          is_shown_once,
          is_buildtime,
          is_literal,
        }),
      });
      return null;
    }

    if (intent === "deleteEnv") {
      const key = String(fd.get("key") || "").trim();
      if (!key) return null;

      await apiFetchAuthed(
        request,
        `/api/sites/${id}/envs/${encodeURIComponent(key)}`,
        {
          method: "DELETE",
        },
      );
      return null;
    }

    if (intent === "addTeamMember") {
      const email = String(fd.get("email") || "")
        .trim()
        .toLowerCase();
      const role = String(fd.get("role") || "viewer");
      if (!email) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/team/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: role === "editor" ? "editor" : "viewer",
        }),
      });
      return null;
    }

    if (intent === "removeTeamMember") {
      const memberId = String(fd.get("member_id") || "").trim();
      if (!memberId) return null;

      await apiFetchAuthed(
        request,
        `/api/sites/${id}/team/members/${encodeURIComponent(memberId)}`,
        {
          method: "DELETE",
        },
      );
      return null;
    }

    if (intent === "revokeTeamInvite") {
      const inviteId = String(fd.get("invite_id") || "").trim();
      if (!inviteId) return null;

      await apiFetchAuthed(
        request,
        `/api/sites/${id}/team/invites/${encodeURIComponent(inviteId)}`,
        {
          method: "DELETE",
        },
      );
      return null;
    }
  } catch (error) {
    console.error("Action Error:", error);
    return null;
  }

  return null;
}

// --- Utils ---

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeStatus(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("run") || s.includes("healthy") || s === "up")
    return "RUNNING";
  if (
    s.includes("stop") ||
    s.includes("down") ||
    s.includes("exited") ||
    s.includes("removed")
  )
    return "STOPPED";
  if (
    s.includes("fail") ||
    s.includes("error") ||
    s.includes("crash") ||
    s.includes("unhealthy")
  )
    return "ERROR";
  if (
    s.includes("build") ||
    s.includes("deploy") ||
    s.includes("provision") ||
    s.includes("queu") ||
    s.includes("restarting")
  )
    return "BUILDING";
  return "UNKNOWN";
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const config = {
    RUNNING: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      label: "Running",
    },
    STOPPED: {
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      border: "border-zinc-500/20",
      label: "Stopped",
    },
    ERROR: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/20",
      label: "Error",
    },
    BUILDING: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      label: "Processing",
    },
    UNKNOWN: {
      bg: "bg-white/5",
      text: "text-white/50",
      border: "border-white/10",
      label: status || "Unknown",
    },
  };

  const theme = config[normalized as keyof typeof config] || config.UNKNOWN;

  return (
    <span
      className={cx(
        "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5",
        theme.bg,
        theme.text,
        theme.border,
      )}
    >
      {normalized === "BUILDING" && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {normalized === "RUNNING" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
      {theme.label}
    </span>
  );
}

function DeploymentStatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "success" || s === "finished")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (s === "failed" || s === "error")
    return <XCircle className="h-4 w-4 text-red-400" />;
  if (s === "queued" || s === "pending")
    return <History className="h-4 w-4 text-white/40" />;
  return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
}

// --- Main Component ---

export default function SiteOverview() {
  const { site, deployments, domains, db, envs, team } =
    useLoaderData() as LoaderData;
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";
  const currentIntent = String(nav.formData?.get("intent") || "");

  // Optimistic UI for restart/deploy
  const isRestarting =
    isSubmitting &&
    (currentIntent === "restart" ||
      currentIntent === "deploy" ||
      currentIntent === "deploy_force" ||
      currentIntent === "start");

  const [tab, setTab] = React.useState<
    "overview" | "deployments" | "logs" | "domains" | "database" | "settings"
  >("overview");

  // Logs Fetcher
  const logsFetcher = useFetcher<LogsPayload>();
  const [logLines, setLogLines] = React.useState<
    "100" | "200" | "500" | "1000"
  >("200");
  const [autoRefreshLogs, setAutoRefreshLogs] = React.useState(true);

  // Status Fetcher
  const statusFetcher = useFetcher<StatusPayload>();
  const [liveStatus, setLiveStatus] = React.useState<string>(site.status);

  // Database Explorer Fetchers
  const dbTablesFetcher = useFetcher<DbTablesPayload>();
  const dbRowsFetcher = useFetcher<DbRowsPayload>();
  const [tableQuery, setTableQuery] = React.useState("");
  const [selectedTable, setSelectedTable] = React.useState<string>("");
  const [rowLimit, setRowLimit] = React.useState<"25" | "50" | "100">("25");
  const [rowOffset, setRowOffset] = React.useState(0);

  // Derived State
  const logsLoading =
    logsFetcher.state === "loading" || logsFetcher.state === "submitting";
  const logsText =
    logsFetcher.data && logsFetcher.data.ok ? logsFetcher.data.logs : "";
  const tablesLoading =
    dbTablesFetcher.state === "loading" ||
    dbTablesFetcher.state === "submitting";
  const rowsLoading =
    dbRowsFetcher.state === "loading" || dbRowsFetcher.state === "submitting";
  const tableList =
    dbTablesFetcher.data && dbTablesFetcher.data.ok
      ? dbTablesFetcher.data.tables
      : [];
  const filteredTables = tableList.filter((t) =>
    t.name.toLowerCase().includes(tableQuery.trim().toLowerCase()),
  );
  const rowPayload =
    dbRowsFetcher.data && dbRowsFetcher.data.ok ? dbRowsFetcher.data : null;
  const canManageTeam = Boolean(team.can_write);
  const teamMembers = Array.isArray(team.members) ? team.members : [];
  const teamInvites = Array.isArray(team.invites) ? team.invites : [];

  // Update live status when data comes in
  React.useEffect(() => {
    if (statusFetcher.data?.ok) {
      setLiveStatus(statusFetcher.data.status);
    }
  }, [statusFetcher.data]);

  // --- Optimized Polling Effects ---

  // 1. Logs Polling
  React.useEffect(() => {
    // Only run if on logs tab and auto-refresh is on
    if (tab !== "logs" || !autoRefreshLogs) return;

    const interval = setInterval(() => {
      // Prevent polling if hidden or if previous request is still pending
      if (document.hidden || logsFetcher.state !== "idle") return;

      logsFetcher.load(
        `/app/sites/${site.id}/logs?lines=${encodeURIComponent(logLines)}`,
      );
    }, 5000); // 5 seconds

    // Initial load when entering tab
    if (logsFetcher.state === "idle" && !logsFetcher.data) {
      logsFetcher.load(
        `/app/sites/${site.id}/logs?lines=${encodeURIComponent(logLines)}`,
      );
    }

    return () => clearInterval(interval);
  }, [tab, autoRefreshLogs, site.id, logLines, logsFetcher.state]);

  // 2. Status Polling (Global)
  React.useEffect(() => {
    // Initial Load
    if (statusFetcher.state === "idle" && !statusFetcher.data) {
      statusFetcher.load(`/app/sites/${site.id}/status`);
    }

    // Faster polling if we think we are building/restarting
    const pollInterval =
      liveStatus === "PROVISIONING" || liveStatus === "BUILDING" || isRestarting
        ? 3000
        : 10000;

    const interval = setInterval(() => {
      // Prevent polling if hidden or request pending
      if (document.hidden || statusFetcher.state !== "idle") return;

      statusFetcher.load(`/app/sites/${site.id}/status`);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [site.id, liveStatus, isRestarting]);

  React.useEffect(() => {
    if (tab !== "database" || !db) return;
    if (dbTablesFetcher.state !== "idle") return;
    if (!dbTablesFetcher.data) {
      dbTablesFetcher.load(`/app/sites/${site.id}/database/tables`);
    }
  }, [tab, db, site.id, dbTablesFetcher.state, dbTablesFetcher.data]);

  React.useEffect(() => {
    if (!dbTablesFetcher.data || !dbTablesFetcher.data.ok) return;
    if (selectedTable) return;
    const first = dbTablesFetcher.data.tables[0]?.name;
    if (first) {
      setSelectedTable(first);
      setRowOffset(0);
    }
  }, [dbTablesFetcher.data, selectedTable]);

  React.useEffect(() => {
    if (tab !== "database") return;
    if (!selectedTable) return;
    dbRowsFetcher.load(
      `/app/sites/${site.id}/database/tables/${encodeURIComponent(selectedTable)}?limit=${rowLimit}&offset=${rowOffset}`,
    );
  }, [tab, site.id, selectedTable, rowLimit, rowOffset]);

  // Helpers
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* fallback ignored */
    }
  }

  const connString = db
    ? `${db.engine}://${db.username}:${db.password || ""}@${db.host}/${db.db_name}`
    : "";
  const primaryDomain = (site.primaryDomain || domains[0]?.domain || "").trim();
  const liveSiteUrl = primaryDomain
    ? primaryDomain.startsWith("http://") ||
      primaryDomain.startsWith("https://")
      ? primaryDomain
      : `https://${primaryDomain}`
    : "";
  const wpAdminUrl = liveSiteUrl
    ? `${liveSiteUrl.replace(/\/$/, "")}/wp-admin`
    : "";

  function refreshDatabaseExplorer() {
    if (!db) return;
    dbTablesFetcher.load(`/app/sites/${site.id}/database/tables`);
    if (selectedTable) {
      dbRowsFetcher.load(
        `/app/sites/${site.id}/database/tables/${encodeURIComponent(selectedTable)}?limit=${rowLimit}&offset=${rowOffset}`,
      );
    }
  }

  // Decide what status to show: optimistic (restarting) -> fetched (live) -> initial (site.status)
  const displayStatus = isRestarting ? "PROVISIONING" : liveStatus;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* --- HEADER --- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight text-white">
              {site.name}
            </h1>
            <StatusPill status={displayStatus} />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
            <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1">
              <Boxes className="h-3.5 w-3.5" />
              <span className="uppercase text-xs font-semibold tracking-wider">
                {site.type}
              </span>
            </div>

            {site.repo_url && (
              <a
                href={`https://github.com/${site.repo_url}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>{site.repo_url}</span>
                <span className="opacity-50">
                  ({site.repo_branch || "main"})
                </span>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {liveSiteUrl && (
            <a
              href={liveSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              Open Site
            </a>
          )}
          {wpAdminUrl && (
            <a
              href={wpAdminUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 active:scale-95 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              WP Admin
            </a>
          )}
          {normalizeStatus(displayStatus) === "STOPPED" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="start" />
              <button
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Play
                  className={cx(
                    "h-4 w-4",
                    isSubmitting &&
                      currentIntent === "start" &&
                      "animate-pulse",
                  )}
                />
                Start
              </button>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="stop" />
              <button
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Square
                  className={cx(
                    "h-4 w-4",
                    isSubmitting && currentIntent === "stop" && "animate-pulse",
                  )}
                />
                Stop
              </button>
            </Form>
          )}

          <Form method="post">
            <input type="hidden" name="intent" value="deploy" />
            <button
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/90 shadow-lg shadow-white/5 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Deploy
            </button>
          </Form>

          <Form method="post">
            <input type="hidden" name="intent" value="deploy_force" />
            <button
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting && currentIntent === "deploy_force" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Force Deploy
            </button>
          </Form>

          <Form method="post">
            <input type="hidden" name="intent" value="restart" />
            <button
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={cx("h-4 w-4", isSubmitting && "animate-spin")}
              />
            </button>
          </Form>
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/5 bg-black/20 p-1.5 backdrop-blur-xl">
        <Tab
          icon={<Boxes className="h-4 w-4" />}
          active={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </Tab>
        <Tab
          icon={<History className="h-4 w-4" />}
          active={tab === "deployments"}
          onClick={() => setTab("deployments")}
        >
          Deployments
        </Tab>
        <Tab
          icon={<Terminal className="h-4 w-4" />}
          active={tab === "logs"}
          onClick={() => setTab("logs")}
        >
          Logs
        </Tab>
        <Tab
          icon={<Globe className="h-4 w-4" />}
          active={tab === "domains"}
          onClick={() => setTab("domains")}
        >
          Domains
        </Tab>
        <Tab
          icon={<Database className="h-4 w-4" />}
          active={tab === "database"}
          onClick={() => setTab("database")}
        >
          Database
        </Tab>
        <Tab
          icon={<Settings className="h-4 w-4" />}
          active={tab === "settings"}
          onClick={() => setTab("settings")}
        >
          Settings
        </Tab>
      </div>

      {/* --- CONTENT: OVERVIEW --- */}
      {tab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <Card title="Quick Actions">
            <div className="space-y-1">
              <Form method="post">
                <input type="hidden" name="intent" value="deploy" />
                <ActionRow
                  label="Trigger Deployment"
                  icon={<Rocket className="h-4 w-4 text-emerald-400" />}
                />
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="deploy_force" />
                <ActionRow
                  label="Force Rebuild Deployment"
                  icon={<Rocket className="h-4 w-4 text-amber-300" />}
                />
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="restart" />
                <ActionRow
                  label="Restart Application"
                  icon={<RefreshCw className="h-4 w-4 text-amber-400" />}
                />
              </Form>
              <ActionRow
                label="View Live Logs"
                icon={<Terminal className="h-4 w-4 text-blue-400" />}
                onClick={() => setTab("logs")}
              />
            </div>
          </Card>

          <Card
            title="Latest Deployment"
            subtitle={
              deployments[0]
                ? new Date(deployments[0].created_at!).toLocaleString()
                : "No history"
            }
          >
            {deployments[0] ? (
              <div className="rounded-xl bg-white/5 p-4 border border-white/5">
                <div className="flex items-center gap-3 mb-2">
                  <DeploymentStatusIcon status={deployments[0].status} />
                  <span className="font-semibold text-white capitalize">
                    {deployments[0].status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-sm text-white/60 line-clamp-2 font-mono">
                  {deployments[0].commit_message || "Manual Deployment"}
                </div>
                <div className="mt-3 text-xs text-white/40 flex justify-between">
                  <span>
                    {deployments[0].commit_hash?.substring(0, 7) || "---"}
                  </span>
                  <span>{deployments[0].triggered_by || "User"}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/40 italic py-4 text-center">
                No deployments found
              </div>
            )}
            <button
              onClick={() => setTab("deployments")}
              className="mt-4 w-full text-center text-xs font-semibold text-white/60 hover:text-white uppercase tracking-wider"
            >
              View History
            </button>
          </Card>

          <Card title="Connection Info">
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/40 uppercase font-bold tracking-wider">
                    Primary Domain
                  </div>
                  <div className="text-sm text-white font-medium mt-0.5">
                    {domains.length > 0 ? (
                      <a
                        href={`https://${domains[0].domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1"
                      >
                        {domains[0].domain}{" "}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    ) : (
                      "Not Configured"
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/40 uppercase font-bold tracking-wider">
                    Internal Host
                  </div>
                  <div className="text-sm text-white font-medium mt-0.5 font-mono text-xs">
                    {site.id.split("-")[0]}-app
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* --- CONTENT: DEPLOYMENTS --- */}
      {tab === "deployments" && (
        <Card title="Deployment History">
          <div className="space-y-2">
            {deployments.length ? (
              deployments.map((d) => (
                <div
                  key={d.id}
                  className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] p-4 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                      <DeploymentStatusIcon status={d.status} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                        {d.commit_message || "Manual Deployment"}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5 flex gap-2">
                        <span>{d.commit_hash?.substring(0, 7) || "---"}</span>
                        <span>â€¢</span>
                        <span>
                          {new Date(d.created_at || "").toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/30">
                      {d.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-white/30">
                No deployment history found.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* --- CONTENT: LOGS --- */}
      {tab === "logs" && (
        <Card title="Live Logs" subtitle="Real-time output from container">
          <div className="flex items-center justify-between gap-4 mb-4 bg-black/20 p-2 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 px-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={cx(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    logsLoading ? "bg-emerald-400" : "bg-transparent",
                  )}
                ></span>
                <span
                  className={cx(
                    "relative inline-flex rounded-full h-2 w-2",
                    logsLoading ? "bg-emerald-500" : "bg-white/20",
                  )}
                ></span>
              </span>
              <span className="text-xs font-mono text-white/60">
                {logsLoading ? "Fetching..." : "Idle"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logLines}
                onChange={(e) =>
                  setLogLines(e.target.value as "100" | "200" | "500" | "1000")
                }
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70 outline-none hover:text-white"
              >
                <option value="100">100 lines</option>
                <option value="200">200 lines</option>
                <option value="500">500 lines</option>
                <option value="1000">1000 lines</option>
              </select>
              <button
                onClick={() =>
                  logsFetcher.load(
                    `/app/sites/${site.id}/logs?lines=${encodeURIComponent(logLines)}`,
                  )
                }
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
              >
                <RefreshCw
                  className={cx("h-4 w-4", logsLoading && "animate-spin")}
                />
              </button>
              <button
                onClick={() => copyToClipboard(logsText)}
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="h-[500px] w-full rounded-xl border border-white/10 bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-white/80 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {logsFetcher.data && !logsFetcher.data.ok ? (
              <div className="text-red-400 p-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {logsFetcher.data.error}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-all">
                {logsText || "Waiting for logs..."}
              </pre>
            )}
          </div>
        </Card>
      )}

      {/* --- CONTENT: DOMAINS --- */}
      {tab === "domains" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card title="Connected Domains">
              {domains.length > 0 ? (
                <div className="space-y-3">
                  {domains.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-white/40" />
                        <div className="text-sm font-medium text-white">
                          {d.domain}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/30 border-dashed border border-white/10 rounded-2xl">
                  No domains connected yet.
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card title="Add Domain">
              {/* Beta Disclaimer */}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-400">
                      Beta Feature
                    </h4>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Automated domain configuration is currently in beta. If
                      your domain does not resolve after 24 hours, please
                      contact our support team for manual assistance.
                    </p>
                  </div>
                </div>
              </div>

              {/* A Record Instructions */}
              <div className="rounded-xl bg-white/5 border border-white/5 p-4 mb-6">
                <div className="text-xs uppercase font-bold text-white/40 tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="h-3 w-3" />
                  Required DNS Record
                </div>
                <div className="flex items-center justify-between bg-black/40 rounded-lg p-3 border border-white/10 shadow-inner">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      A
                    </span>
                    <code className="font-mono text-sm text-white tracking-wide">
                      {SERVER_IP}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(SERVER_IP)}
                    className="p-1.5 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
                    title="Copy IP"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="addDomain" />
                <div>
                  <label className="text-xs uppercase font-bold text-white/40 tracking-wider ml-1">
                    Domain Name
                  </label>
                  <input
                    name="fqdn"
                    placeholder="app.example.com"
                    className="w-full mt-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-colors"
                  />
                </div>
                <button
                  disabled={isSubmitting}
                  className="w-full py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Connect Domain
                </button>
              </Form>
            </Card>
          </div>
        </div>
      )}

      {/* --- CONTENT: DATABASE --- */}
      {tab === "database" && (
        <div className="space-y-6">
          <Card
            title="Database Access"
            subtitle="Credentials for your application"
          >
            {db ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <KV k="Database Engine" v={db.engine.toUpperCase()} />
                  <KV k="Host" v={`${db.host}:${db.port}`} />
                  <KV k="Database Name" v={db.db_name} />
                </div>
                <div className="space-y-4">
                  <KV k="Username" v={db.username} />
                  <div className="relative group">
                    <KV
                      k="Password"
                      v={db.password ? "************" : "No Password"}
                    />
                    <button
                      onClick={() => copyToClipboard(db.password || "")}
                      className="absolute top-2 right-2 p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition opacity-0 group-hover:opacity-100"
                    >
                      <Copy className="h-3 w-3 text-white" />
                    </button>
                  </div>
                  <div className="pt-2">
                    <div className="text-xs uppercase font-bold text-white/40 tracking-wider mb-1 ml-1">
                      Connection String
                    </div>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-[10px] font-mono text-white/70 overflow-x-auto whitespace-nowrap">
                        {connString}
                      </code>
                      <button
                        onClick={() => copyToClipboard(connString)}
                        className="bg-white/5 border border-white/10 px-3 rounded-lg hover:bg-white/10 text-white/70"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Database className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <h3 className="text-white font-medium">
                  No Database Provisioned
                </h3>
                <p className="text-white/40 text-sm max-w-xs mx-auto mt-1">
                  {site.type === "wordpress"
                    ? "Wait a moment, the database is being created."
                    : "This site type does not have a database by default."}
                </p>
              </div>
            )}
          </Card>

          {db && (
            <Card
              title="Database Explorer"
              subtitle="Connect and browse tables and rows"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Ready to connect
                </div>
                <button
                  type="button"
                  onClick={refreshDatabaseExplorer}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <RefreshCw
                    className={cx(
                      "h-3.5 w-3.5",
                      (tablesLoading || rowsLoading) && "animate-spin",
                    )}
                  />
                  Connect / Refresh
                </button>
              </div>

              {dbTablesFetcher.data && !dbTablesFetcher.data.ok && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                  {dbTablesFetcher.data.error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="lg:col-span-1 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-3">
                    <input
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                      placeholder="Filter tables..."
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30"
                    />
                  </div>

                  <div className="max-h-[420px] space-y-1 overflow-auto pr-1">
                    {tablesLoading && tableList.length === 0 && (
                      <div className="py-6 text-center text-xs text-white/40">
                        Loading tables...
                      </div>
                    )}
                    {!tablesLoading && filteredTables.length === 0 && (
                      <div className="py-6 text-center text-xs text-white/40">
                        No tables found.
                      </div>
                    )}
                    {filteredTables.map((table) => (
                      <button
                        key={table.name}
                        type="button"
                        onClick={() => {
                          setSelectedTable(table.name);
                          setRowOffset(0);
                        }}
                        className={cx(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          selectedTable === table.name
                            ? "border-white/30 bg-white/10 text-white"
                            : "border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <div className="truncate text-xs font-semibold">
                          {table.name}
                        </div>
                        <div className="text-[10px] text-white/35">
                          Rows:{" "}
                          {table.approxRows == null ? "n/a" : table.approxRows}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  {!selectedTable && (
                    <div className="py-16 text-center text-sm text-white/40">
                      Select a table to view rows.
                    </div>
                  )}

                  {selectedTable && (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">
                          Table:{" "}
                          <span className="font-mono">{selectedTable}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={rowLimit}
                            onChange={(e) => {
                              setRowLimit(
                                e.target.value as "25" | "50" | "100",
                              );
                              setRowOffset(0);
                            }}
                            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none"
                          >
                            <option value="25">25 rows</option>
                            <option value="50">50 rows</option>
                            <option value="100">100 rows</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setRowOffset(
                                Math.max(0, rowOffset - Number(rowLimit)),
                              )
                            }
                            disabled={rowOffset === 0 || rowsLoading}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRowOffset(
                                rowPayload && rowPayload.nextOffset != null
                                  ? rowPayload.nextOffset
                                  : rowOffset,
                              )
                            }
                            disabled={!rowPayload?.hasMore || rowsLoading}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      {dbRowsFetcher.data && !dbRowsFetcher.data.ok && (
                        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                          {dbRowsFetcher.data.error}
                        </div>
                      )}

                      <div className="overflow-auto rounded-lg border border-white/10">
                        {rowsLoading && !rowPayload ? (
                          <div className="py-12 text-center text-sm text-white/40">
                            Loading rows...
                          </div>
                        ) : rowPayload ? (
                          rowPayload.rows.length > 0 ? (
                            <table className="min-w-full text-xs">
                              <thead className="bg-white/5">
                                <tr>
                                  {rowPayload.columns.map((col) => (
                                    <th
                                      key={col}
                                      className="border-b border-white/10 px-3 py-2 text-left font-semibold text-white/70"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rowPayload.rows.map((row, idx) => (
                                  <tr
                                    key={`${rowPayload.table}-${idx}`}
                                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]"
                                  >
                                    {rowPayload.columns.map((col) => (
                                      <td
                                        key={`${idx}-${col}`}
                                        className="px-3 py-2 align-top text-white/80"
                                      >
                                        <span className="block max-w-[280px] break-words font-mono">
                                          {row[col] == null
                                            ? "NULL"
                                            : String(row[col])}
                                        </span>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="py-12 text-center text-sm text-white/40">
                              No rows in this table.
                            </div>
                          )
                        ) : (
                          <div className="py-12 text-center text-sm text-white/40">
                            Connect to load table rows.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* --- CONTENT: SETTINGS --- */}
      {tab === "settings" && (
        <div className="space-y-6">
          {/* Create Environment Variable */}
          <Card
            title="Environment Variables"
            subtitle="Manage secrets and config for your application"
          >
            <Form
              method="post"
              className="mb-6 rounded-xl border border-white/5 bg-white/5 p-4"
            >
              <input type="hidden" name="intent" value="createEnv" />
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 w-full">
                  <label className="text-xs uppercase font-bold text-white/40 tracking-wider ml-1 mb-1 block">
                    Key
                  </label>
                  <input
                    name="key"
                    placeholder="API_KEY"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 font-mono"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-xs uppercase font-bold text-white/40 tracking-wider ml-1 mb-1 block">
                    Value
                  </label>
                  <input
                    name="value"
                    placeholder="secret_value_123"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 font-mono"
                  />
                </div>
                <button
                  disabled={isSubmitting}
                  className="w-full md:w-auto px-4 py-2.5 bg-white text-black font-bold text-sm rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/70">
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <input
                    type="checkbox"
                    name="is_literal"
                    defaultChecked
                    className="accent-white"
                  />
                  Literal
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <input
                    type="checkbox"
                    name="is_preview"
                    className="accent-white"
                  />
                  Preview
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <input
                    type="checkbox"
                    name="is_multiline"
                    className="accent-white"
                  />
                  Multiline
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <input
                    type="checkbox"
                    name="is_shown_once"
                    className="accent-white"
                  />
                  Shown once
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <input
                    type="checkbox"
                    name="is_buildtime"
                    className="accent-white"
                  />
                  Build-time
                </label>
              </div>
            </Form>

            {envs.length > 0 ? (
              <div className="space-y-2">
                {envs.map((env, i) => (
                  <EnvRow key={i} env={env} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/30 italic">
                No environment variables set.
              </div>
            )}
          </Card>

          <Card
            title="Team Access"
            subtitle="Invite users by email to view or edit this site"
          >
            {canManageTeam ? (
              <Form
                method="post"
                className="mb-6 rounded-xl border border-white/5 bg-white/5 p-4"
              >
                <input type="hidden" name="intent" value="addTeamMember" />
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1 w-full">
                    <label className="text-xs uppercase font-bold text-white/40 tracking-wider ml-1 mb-1 block">
                      Member Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="user@example.com"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                      required
                    />
                  </div>
                  <div className="w-full md:w-40">
                    <label className="text-xs uppercase font-bold text-white/40 tracking-wider ml-1 mb-1 block">
                      Role
                    </label>
                    <select
                      name="role"
                      defaultValue="viewer"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                  </div>
                  <button
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-4 py-2.5 bg-white text-black font-bold text-sm rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting && currentIntent === "addTeamMember" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add Member
                  </button>
                </div>
              </Form>
            ) : (
              <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                You currently have read-only access for team management.
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs uppercase font-bold tracking-wider text-white/40">
                  Members
                </div>
                {teamMembers.length > 0 ? (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white/90">
                            {member.name || member.email}
                          </div>
                          <div className="truncate text-xs text-white/50">
                            {member.email}
                          </div>
                        </div>
                        <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
                          {member.role}
                        </span>
                        {canManageTeam ? (
                          <Form
                            method="post"
                            onSubmit={(e) => {
                              if (
                                !confirm("Remove this member from the site?")
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="removeTeamMember"
                            />
                            <input
                              type="hidden"
                              name="member_id"
                              value={member.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg p-2 text-white/40 transition hover:bg-red-500/20 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                    No members added yet.
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-xs uppercase font-bold tracking-wider text-white/40">
                  Pending Invites
                </div>
                {teamInvites.length > 0 ? (
                  <div className="space-y-2">
                    {teamInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white/90">
                            {invite.email}
                          </div>
                          <div className="text-xs text-white/50">
                            Role: {invite.role}
                          </div>
                        </div>
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          {invite.status}
                        </span>
                        {canManageTeam ? (
                          <Form
                            method="post"
                            onSubmit={(e) => {
                              if (!confirm("Revoke this invite?")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="revokeTeamInvite"
                            />
                            <input
                              type="hidden"
                              name="invite_id"
                              value={invite.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg p-2 text-white/40 transition hover:bg-red-500/20 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                    No pending invites.
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Danger Zone">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Delete Project</h4>
                <p className="text-sm text-white/40">
                  Permanently remove this site and all its data.
                </p>
              </div>
              <button
                disabled
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-bold opacity-50 cursor-not-allowed"
              >
                Delete Site
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Subcomponents ---

function Tab({ active, icon, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
        active
          ? "bg-white text-black shadow-lg shadow-white/5"
          : "text-white/60 hover:text-white hover:bg-white/5",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Card({ title, subtitle, children }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl"
    >
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function KV({ k, v }: any) {
  return (
    <div>
      <div className="text-xs uppercase font-bold text-white/30 tracking-wider mb-1 ml-1">
        {k}
      </div>
      <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white font-medium font-mono truncate">
        {v}
      </div>
    </div>
  );
}

function ActionRow({ label, icon, onClick }: any) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 group transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 text-white/70 group-hover:text-white transition-colors">
            {icon}
          </div>
          <span className="text-sm font-medium text-white/80 group-hover:text-white">
            {label}
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors" />
      </button>
    );
  }
  return (
    <button
      type="submit"
      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 group transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5 text-white/70 group-hover:text-white transition-colors">
          {icon}
        </div>
        <span className="text-sm font-medium text-white/80 group-hover:text-white">
          {label}
        </span>
      </div>
      <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors" />
    </button>
  );
}

function EnvRow({ env }: { env: EnvVar }) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3 group">
      <div className="flex-1 font-mono text-sm font-medium text-emerald-400">
        {env.key}
      </div>
      <div className="flex-[2] min-w-0">
        <div className="relative truncate font-mono text-sm text-white/70">
          {show ? env.value : "****************"}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {env.is_literal !== false && (
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
              literal
            </span>
          )}
          {env.is_preview && (
            <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-300">
              preview
            </span>
          )}
          {env.is_multiline && (
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
              multiline
            </span>
          )}
          {env.is_shown_once && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
              shown-once
            </span>
          )}
          {(env.is_buildtime || env.is_build_time) && (
            <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-purple-300">
              build-time
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(env.value)}
          className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
          title="Copy value"
        >
          <Copy className="h-4 w-4" />
        </button>
        <Form
          method="post"
          onSubmit={(e) => {
            if (!confirm("Delete this variable?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="deleteEnv" />
          <input type="hidden" name="key" value={env.key} />
          <button
            type="submit"
            className="rounded-lg p-2 text-white/40 transition hover:bg-red-500/20 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Form>
      </div>
    </div>
  );
}
