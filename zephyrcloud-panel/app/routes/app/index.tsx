import * as React from "react";
import { Link, useLoaderData } from "react-router";
import { Activity, Database, Github, Globe, Rocket, Server } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CardDescription,
  CardTitle,
} from "~/components/ui/card";
import {
  parseWorkspaceUsage,
  safeJson,
  type WorkspaceUsage,
  WorkspaceUsageSection,
} from "~/lib/workspace-usage";
import { softInsetClass } from "~/lib/ui";
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
  workspaceUsage: WorkspaceUsage | null;
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

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const { user } = await requireUser(request);

  try {
    const [sitesRes, githubRes, workspaceDbRes, workspaceUsageRes] =
      await Promise.all([
      apiFetchAuthed(request, "/api/sites", { method: "GET" }),
      apiFetchAuthed(request, "/api/github/connection", { method: "GET" }),
      apiFetchAuthed(request, "/api/sites/workspace/database", { method: "GET" }),
      apiFetchAuthed(request, "/api/sites/workspace/usage", { method: "GET" }),
    ]);

    if (!sitesRes.ok) {
      throw new Error("Failed to fetch sites");
    }

    const sitesPayload = await sitesRes.json();
    const githubPayload = await safeJson(githubRes);
    const workspaceDbPayload = workspaceDbRes.ok ? await safeJson(workspaceDbRes) : null;
    const workspaceUsagePayload = workspaceUsageRes.ok
      ? await safeJson(workspaceUsageRes)
      : null;

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
      recent.push({ title: "Database", desc: "Not set up", tone: "neutral" });
    }

    if (sites.length === 0) {
      recent.push({
        title: "No sites yet",
        desc: "Create your first website",
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
          title: "Updates in progress",
          desc: `${building} currently running`,
          tone: "neutral",
        });
      }

      if (failed > 0) {
        recent.push({
          title: "Needs attention",
          desc: `${failed} site${failed === 1 ? "" : "s"} require review`,
          tone: "warn",
        });
      }

      if (running > 0 && failed === 0) {
        recent.push({
          title: "All clear",
          desc: `${running} site${running === 1 ? "" : "s"} live`,
          tone: "ok",
        });
      }
    }

    if (github.configured && !github.connected) {
      recent.unshift({
        title: "Connect GitHub",
        desc: "Private repositories need a connection",
        tone: "warn",
      });
    }

    return {
      stats,
      recent,
      workspaceDatabase,
      workspaceUsage: parseWorkspaceUsage(workspaceUsagePayload),
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
          title: "Information unavailable",
          desc: "Some workspace details could not be loaded.",
          tone: "warn",
        },
      ],
      workspaceDatabase: null,
      workspaceUsage: null,
      github: { configured: false, connected: false, login: undefined },
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
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
    <article className={`${softInsetClass} flex min-h-20 flex-col justify-between gap-3 px-4 py-3.5`}>
      <div className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        <span className="text-[var(--text-soft)]">{icon}</span>
        {label}
      </div>
      <div className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </div>
    </article>
  );
}

function ActivityToneBadge({ tone }: { tone: ActivityItem["tone"] }) {
  const className =
    tone === "ok"
      ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
      : tone === "warn"
        ? "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]"
        : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]";

  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${className}`}
    >
      {tone === "ok" ? "Healthy" : tone === "warn" ? "Check" : "Info"}
    </span>
  );
}

export default function AppIndex() {
  const { stats, recent, github, user, workspaceUsage } =
    useLoaderData() as LoaderData;
  const isAdmin = user.role === "admin";
  const summaryStats = [
    { icon: <Server className="h-4 w-4" />, label: "Sites", value: String(stats.sites) },
    { icon: <Globe className="h-4 w-4" />, label: "Domains", value: String(stats.domains) },
    {
      icon: <Database className="h-4 w-4" />,
      label: "Databases",
      value: String(stats.databases),
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: "Deployments",
      value: String(stats.deployments),
    },
  ];

  return (
    <div className="space-y-4 pb-8 text-sm">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg">At a glance</CardTitle>
            <CardDescription className="text-xs leading-5">
              Operational metrics for your current workspace.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/sites?new=1">
              <Button size="sm">
                <Rocket className="h-3.5 w-3.5" />
                New site
              </Button>
            </Link>
            <Link to={github.connected ? "/sites?new=1" : "/settings"}>
              <Button variant="secondary" size="sm">
                <Github className="h-3.5 w-3.5" />
                {github.connected ? "Use GitHub" : "Connect GitHub"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryStats.map((item) => (
            <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <WorkspaceUsageSection workspaceUsage={workspaceUsage} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription className="text-xs leading-5">
              Current signals that may need attention across your workspace.
            </CardDescription>
          </div>
          {isAdmin ? <Badge>Admin</Badge> : null}
        </div>
        <div className="space-y-2.5">
          {recent.map((item) => (
            <div
              key={`${item.title}:${item.desc}`}
              className={`${softInsetClass} flex items-start justify-between gap-3 px-4 py-4`}
            >
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-[var(--foreground)]">{item.title}</div>
                <div className="text-xs text-[var(--text-muted)]">{item.desc}</div>
              </div>
              <ActivityToneBadge tone={item.tone} />
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
