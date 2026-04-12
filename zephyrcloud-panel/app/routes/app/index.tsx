import * as React from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
} from "react-router";
import {
  Activity,
  Copy,
  Database,
  Github,
  Globe,
  Rocket,
  Server,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { apiFetchAuthed } from "~/services/api.authed.server";
import { requireUser } from "~/services/session.server";

type Site = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "static" | "php" | "python";
  status: string;
  primaryDomain?: string | null;
};

type DashboardStats = {
  sites: number;
  domains: number;
  databases: number;
  deployments: number;
};

type ActivityItem = {
  title: string;
  desc: string;
  tone: "ok" | "warn" | "neutral";
};

type WorkspaceDatabase = {
  id: string;
  engine: "mariadb" | "mysql" | "postgresql";
  host: string;
  port: number;
  db_name: string;
  username: string;
  password: string;
  public_url: string;
  ssl_mode?: string | null;
  created_at: string;
  updated_at: string;
};

type LoaderData = {
  stats: DashboardStats;
  recent: ActivityItem[];
  workspaceDatabase: WorkspaceDatabase | null;
  user: {
    email: string;
    name?: string;
    role?: string;
  };
  github: {
    configured: boolean;
    connected: boolean;
    login?: string;
  };
};

type ActionData =
  | { ok: true; message: string }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (Array.isArray(payload.message) && typeof payload.message[0] === "string") {
    return payload.message[0];
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return fallback;
}

async function safeJson(response: Response) {
  return response.json().catch(() => null);
}

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const { user } = await requireUser(request);

  try {
    const [sitesRes, githubRes, workspaceDbRes] = await Promise.all([
      apiFetchAuthed(request, "/api/sites", { method: "GET" }),
      apiFetchAuthed(request, "/api/github/connection", { method: "GET" }),
      apiFetchAuthed(request, "/api/sites/workspace/database", { method: "GET" }),
    ]);

    if (!sitesRes.ok) {
      throw new Error("Failed to fetch sites");
    }

    const sitesPayload = await sitesRes.json();
    const githubPayload = await safeJson(githubRes);
    const workspaceDbPayload = workspaceDbRes.ok ? await safeJson(workspaceDbRes) : null;

    const sites: Site[] = Array.isArray(sitesPayload)
      ? sitesPayload
      : Array.isArray(sitesPayload?.sites)
        ? sitesPayload.sites
        : Array.isArray(sitesPayload?.data)
          ? sitesPayload.data
          : [];

    const github =
      githubPayload && typeof githubPayload === "object"
        ? {
            configured: githubPayload.configured === true,
            connected: githubPayload.connected === true,
            login:
              typeof (githubPayload as Record<string, unknown>).login === "string"
                ? ((githubPayload as Record<string, unknown>).login as string)
                : undefined,
          }
        : { configured: false, connected: false, login: undefined };

    const workspaceDatabase =
      workspaceDbPayload && typeof workspaceDbPayload === "object"
        ? (workspaceDbPayload as WorkspaceDatabase)
        : null;

    const stats: DashboardStats = {
      sites: sites.length,
      domains: 0,
      databases: workspaceDatabase ? 1 : 0,
      deployments: 0,
    };

    const detailPromises = sites.map(async (site) => {
      let domainCount = 0;
      let databaseCount = 0;
      let deploymentCount = 0;

      try {
        const res = await apiFetchAuthed(request, `/api/sites/${site.id}/domains`);
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          const list = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.domains)
              ? payload.domains
              : [];
          domainCount = list.length;
        }
      } catch {
        // ignore
      }

      try {
        const res = await apiFetchAuthed(request, `/api/sites/${site.id}/database`);
        if (res.ok) {
          const payload = await safeJson(res);
          if (payload && (payload as Record<string, unknown>).id) {
            databaseCount = 1;
          }
        }
      } catch {
        // ignore
      }

      try {
        const res = await apiFetchAuthed(request, `/api/sites/${site.id}/deployments`);
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          const list = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.deployments)
              ? payload.deployments
              : [];
          deploymentCount = list.length;
        }
      } catch {
        // ignore
      }

      return { domainCount, databaseCount, deploymentCount };
    });

    const details = await Promise.all(detailPromises);
    details.forEach((detail) => {
      stats.domains += detail.domainCount;
      stats.databases += detail.databaseCount;
      stats.deployments += detail.deploymentCount;
    });

    const recent: ActivityItem[] = [];
    if (!workspaceDatabase) {
      recent.push({
        title: "Database available",
        desc: "Not provisioned",
        tone: "neutral",
      });
    }

    if (sites.length === 0) {
      recent.push({
        title: "No sites yet",
        desc: "Create the first site",
        tone: "neutral",
      });
    } else {
      const running = sites.filter((site) => site.status.toUpperCase() === "RUNNING").length;
      const building = sites.filter((site) =>
        ["BUILDING", "PROVISIONING", "QUEUED"].includes(site.status.toUpperCase()),
      ).length;
      const failed = sites.filter((site) =>
        ["ERROR", "FAILED"].includes(site.status.toUpperCase()),
      ).length;

      if (building > 0) {
        recent.push({
          title: "Deployments active",
          desc: `${building} in progress`,
          tone: "neutral",
        });
      }

      if (failed > 0) {
        recent.push({
          title: "Attention",
          desc: `${failed} need review`,
          tone: "warn",
        });
      }

      if (running > 0 && failed === 0) {
        recent.push({
          title: "Runtime healthy",
          desc: `${running} running`,
          tone: "ok",
        });
      }
    }

    if (github.configured && !github.connected) {
      recent.unshift({
        title: "Connect GitHub",
        desc: "Private repos unavailable",
        tone: "warn",
      });
    }

    return {
      stats,
      recent,
      workspaceDatabase,
      github,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return {
      stats: { sites: 0, domains: 0, databases: 0, deployments: 0 },
      recent: [
        {
          title: "Connection error",
          desc: "Dashboard metrics could not be loaded from the API.",
          tone: "warn",
        },
      ],
      workspaceDatabase: null,
      github: { configured: false, connected: false, login: undefined },
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<ActionData | null> {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "create-workspace-database") {
    return null;
  }

  const engine = String(formData.get("engine") || "").trim();
  if (!["mariadb", "mysql", "postgresql"].includes(engine)) {
    return { ok: false, error: "Choose a valid database engine." };
  }

  const response = await apiFetchAuthed(request, "/api/sites/workspace/database", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine }),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    return {
      ok: false,
      error: parseMessage(payload, "Managed database provisioning failed."),
    };
  }

  const label =
    engine === "postgresql" ? "PostgreSQL" : engine === "mysql" ? "MySQL" : "MariaDB";

  return {
    ok: true,
    message: `${label} database provisioning started. The dashboard will show the public URL and credentials once Coolify returns them.`,
  };
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex items-center justify-between gap-4 px-5 py-5">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/42">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-md border border-white/10 bg-[var(--accent-soft)] text-white">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityToneBadge({ tone }: { tone: ActivityItem["tone"] }) {
  const className =
    tone === "ok"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : tone === "warn"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
        : "border-white/10 bg-white/[0.05] text-white/76";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${className}`}
    >
      {tone === "ok" ? "Healthy" : tone === "warn" ? "Check" : "Info"}
    </span>
  );
}

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {label}
          </div>
          <div className="mt-2 break-all font-mono text-sm text-white">
            {value}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/82 transition hover:border-white/20 hover:bg-white/[0.09]"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function formatEngineLabel(engine: WorkspaceDatabase["engine"]) {
  if (engine === "postgresql") return "PostgreSQL";
  if (engine === "mysql") return "MySQL";
  return "MariaDB";
}

export default function AppIndex() {
  const { stats, recent, github, workspaceDatabase, user } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | null;
  const isAdmin = user.role === "admin";
  const summaryStats = [
    {
      icon: <Server className="h-5 w-5" />,
      label: "Sites",
      value: String(stats.sites),
    },
    {
      icon: <Globe className="h-5 w-5" />,
      label: "Domains",
      value: String(stats.domains),
    },
    {
      icon: <Database className="h-5 w-5" />,
      label: "Databases",
      value: String(stats.databases),
    },
    {
      icon: <Activity className="h-5 w-5" />,
      label: "Deployments",
      value: String(stats.deployments),
    },
  ];
  const statusCards = [
    {
      label: "GitHub",
      value: github.connected ? "Connected" : github.configured ? "Pending" : "Disabled",
    },
    {
      label: "Database",
      value: workspaceDatabase ? formatEngineLabel(workspaceDatabase.engine) : "Not provisioned",
    },
    {
      label: "Access",
      value: isAdmin ? "Admin" : "Member",
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <Card className="panel-grid overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Workspace
                </div>
                <CardTitle className="mt-2 text-3xl">
                  {user.name || user.email}
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/sites?new=1">
                  <Button>
                    <Rocket className="h-4 w-4" />
                    Create site
                  </Button>
                </Link>
                <Link to={github.connected ? "/sites?new=1" : "/settings"}>
                  <Button variant="secondary">
                    <Github className="h-4 w-4" />
                    {github.connected ? "Deploy from GitHub" : "Connect GitHub"}
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {summaryStats.map((item) => (
                <StatCard
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {statusCards.map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/38">
                    {item.label}
                  </div>
                  <div className="mt-2 truncate text-base font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Runtime notes
                </div>
                <CardTitle className="mt-2">Activity</CardTitle>
              </div>
              {isAdmin ? <Badge>Admin</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((item) => (
              <div
                key={`${item.title}:${item.desc}`}
                className="rounded-md border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-white/54">{item.desc}</div>
                  </div>
                  <ActivityToneBadge tone={item.tone} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {actionData ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            actionData.ok
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              : "border-red-400/20 bg-red-400/10 text-red-100"
          }`}
        >
          {actionData.ok ? actionData.message : actionData.error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Managed database
              </div>
              <CardTitle className="mt-2">
                {workspaceDatabase ? "Connection details" : "Create one public database"}
              </CardTitle>
            </div>
            {workspaceDatabase ? (
              <Badge>{formatEngineLabel(workspaceDatabase.engine)}</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {workspaceDatabase ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <CopyField label="Public URL" value={workspaceDatabase.public_url} />
                <CopyField
                  label="Host"
                  value={`${workspaceDatabase.host}:${workspaceDatabase.port}`}
                />
                <CopyField label="Database name" value={workspaceDatabase.db_name} />
                <CopyField label="Username" value={workspaceDatabase.username} />
                <CopyField label="Password" value={workspaceDatabase.password} />
                <CopyField
                  label="SSL mode"
                  value={workspaceDatabase.ssl_mode || "default"}
                />
              </div>
            </div>
          ) : (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="create-workspace-database" />

              <div className="rounded-md border border-white/10 bg-white/[0.04] p-5">
                <div className="text-sm font-medium text-white">
                  Engine selection
                </div>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 rounded-md border border-white/10 bg-[var(--surface-elevated)] px-4 py-3 text-white">
                    <input type="radio" name="engine" value="mariadb" defaultChecked />
                    <div>
                      <div className="font-medium text-white">MariaDB</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-white/10 bg-[var(--surface-elevated)] px-4 py-3 text-white">
                    <input type="radio" name="engine" value="mysql" />
                    <div>
                      <div className="font-medium text-white">MySQL</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-white/10 bg-[var(--surface-elevated)] px-4 py-3 text-white">
                    <input type="radio" name="engine" value="postgresql" />
                    <div>
                      <div className="font-medium text-white">PostgreSQL</div>
                    </div>
                  </label>
                </div>

                <div className="mt-5">
                  <Button type="submit">
                    <Database className="h-4 w-4" />
                    Provision database
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
