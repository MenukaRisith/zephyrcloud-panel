// app/routes/app/index.tsx
import * as React from "react";
import { Link, useLoaderData } from "react-router";
import { motion } from "framer-motion";
import {
  Boxes,
  Globe,
  Database,
  Rocket,
  Activity,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Server,
  Cpu
} from "lucide-react";

import { apiFetchAuthed } from "../../services/api.authed.server";

// --- Types ---

type Site = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "static" | "php";
  status: string; // e.g. "RUNNING", "STOPPED", "ERROR", "PROVISIONING"
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

type LoaderData = {
  stats: DashboardStats;
  recent: ActivityItem[];
  userName?: string;
};

// --- Loader ---

export async function loader({ request }: { request: Request }): Promise<LoaderData> {
  try {
    // 1. Fetch Sites
    const sitesRes = await apiFetchAuthed(request, "/api/sites", { method: "GET" });
    if (!sitesRes.ok) throw new Error("Failed to fetch sites");
    
    const sitesData = await sitesRes.json();
    
    // Normalize response
    let sites: Site[] = [];
    if (Array.isArray(sitesData)) {
      sites = sitesData;
    } else if (sitesData?.sites && Array.isArray(sitesData.sites)) {
      sites = sitesData.sites;
    } else if (sitesData?.data && Array.isArray(sitesData.data)) {
      sites = sitesData.data;
    }

    // 2. Initialize Stats
    const stats: DashboardStats = {
      sites: sites.length,
      domains: 0,
      databases: 0,
      deployments: 0,
    };

    // 3. Parallel Fetch Details for Accuracy
    // (Note: In a large production app, you'd want a dedicated /api/stats endpoint to avoid N+1 fetches)
    const detailPromises = sites.map(async (site) => {
      let dCount = 0;
      let dbCount = 0;
      let deployCount = 0;

      // Fetch Domains
      try {
        const res = await apiFetchAuthed(request, `/api/sites/${site.id}/domains`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.domains || []);
          dCount = list.length;
        }
      } catch (e) { /* ignore */ }

      // Fetch Database
      try {
        const res = await apiFetchAuthed(request, `/api/sites/${site.id}/database`);
        if (res.ok) {
            // Some backends return 204 or empty text if no DB
            const text = await res.text();
            if (text) {
                const data = JSON.parse(text);
                if (data && (data.id || data.engine)) dbCount = 1;
            }
        }
      } catch (e) { /* ignore */ }

      // Fetch Deployments
      try {
        const res = await apiFetchAuthed(request, `/api/sites/${site.id}/deployments`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.deployments || []);
          deployCount = list.length;
        }
      } catch (e) { /* ignore */ }

      return { dCount, dbCount, deployCount };
    });

    const results = await Promise.all(detailPromises);

    // 4. Aggregate Results
    results.forEach((r) => {
      stats.domains += r.dCount;
      stats.databases += r.dbCount;
      stats.deployments += r.deployCount;
    });

    // 5. Build Activity Feed
    const recent: ActivityItem[] = [];

    if (sites.length === 0) {
      recent.push({
        title: "Welcome to Zephyr",
        desc: "Your infrastructure is empty. Create your first site to get started.",
        tone: "neutral",
      });
    } else {
      const running = sites.filter(s => s.status.toUpperCase() === 'RUNNING').length;
      const provisioning = sites.filter(s => ['BUILDING', 'PROVISIONING', 'QUEUED'].includes(s.status.toUpperCase())).length;
      const errors = sites.filter(s => ['ERROR', 'FAILED'].includes(s.status.toUpperCase())).length;

      if (provisioning > 0) {
        recent.push({
          title: "Deployments in progress",
          desc: `${provisioning} site(s) are currently building or provisioning.`,
          tone: "neutral",
        });
      }

      if (errors > 0) {
        recent.push({
          title: "Attention required",
          desc: `${errors} site(s) have encountered an error. Check logs immediately.`,
          tone: "warn",
        });
      }

      if (running > 0 && errors === 0) {
         recent.push({
          title: "Systems operational",
          desc: `${running} site(s) are running healthy and serving traffic.`,
          tone: "ok",
        });
      }
    }

    return { stats, recent };

  } catch (error) {
    console.error("Dashboard loader error:", error);
    return {
      stats: { sites: 0, domains: 0, databases: 0, deployments: 0 },
      recent: [{ title: "Connection Error", desc: "Could not load dashboard stats.", tone: "warn" }],
    };
  }
}

// --- Components ---

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AppIndex() {
  const { stats, recent } = useLoaderData() as LoaderData;

  const cards = [
    { label: "Active Sites", value: stats.sites, icon: <Server className="h-5 w-5 text-indigo-400" />, border: "border-indigo-500/20", bg: "bg-indigo-500/5" },
    { label: "Domains", value: stats.domains, icon: <Globe className="h-5 w-5 text-emerald-400" />, border: "border-emerald-500/20", bg: "bg-emerald-500/5" },
    { label: "Databases", value: stats.databases, icon: <Database className="h-5 w-5 text-amber-400" />, border: "border-amber-500/20", bg: "bg-amber-500/5" },
    { label: "Total Deploys", value: stats.deployments, icon: <Rocket className="h-5 w-5 text-blue-400" />, border: "border-blue-500/20", bg: "bg-blue-500/5" },
  ];

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-white/50">
            Overview of your infrastructure and recent activity.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/app/sites"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Boxes className="h-4 w-4" />
            View Sites
          </Link>

          <Link
            to="/app/sites?new=1"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/90 shadow-lg shadow-white/5 transition-all active:scale-95"
          >
            <Rocket className="h-4 w-4" />
            Deploy New
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={cx("relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-xl", card.border, card.bg)}
          >
            <div className="flex items-start justify-between">
               <div>
                  <div className="text-3xl font-bold text-white tracking-tight">{card.value}</div>
                  <div className="text-xs font-medium text-white/50 mt-1 uppercase tracking-wider">{card.label}</div>
               </div>
               <div className="p-2.5 rounded-xl bg-white/5 ring-1 ring-white/5">
                   {card.icon}
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="lg:col-span-2 rounded-[28px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/5 text-white/70">
                  <Activity className="h-4 w-4" />
              </div>
              <div>
                  <h2 className="text-sm font-bold text-white">System Status</h2>
                  <p className="text-[11px] text-white/40">Real-time health check</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {recent.map((r, i) => (
              <ActivityRow
                key={i}
                title={r.title}
                desc={r.desc}
                tone={r.tone}
              />
            ))}
          </div>
        </motion.div>

        {/* Quick Start / Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-[28px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2.5 mb-6">
             <div className="p-2 rounded-lg bg-white/5 text-white/70">
                  <Cpu className="h-4 w-4" />
             </div>
             <div>
                 <h2 className="text-sm font-bold text-white">Quick Actions</h2>
                 <p className="text-[11px] text-white/40">Common tasks</p>
             </div>
          </div>

          <div className="space-y-2">
            <Step num="01" title="Create Application" desc="Deploy a WordPress site with managed resources." to="/app/sites?new=1" />
            <Step num="02" title="Connect Domain" desc="Attach custom domains to sites." to="/app/sites" />
            <Step num="03" title="Check Database" desc="View credentials and connection strings." to="/app/sites" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// --- Subcomponents ---

function ActivityRow({
  title,
  desc,
  tone,
}: {
  title: string;
  desc: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const styles = {
    ok: "border-emerald-500/10 bg-emerald-500/5 text-emerald-200",
    warn: "border-red-500/10 bg-red-500/5 text-red-200",
    neutral: "border-white/5 bg-white/5 text-white/80",
  }[tone];

  const icon = {
    ok: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    warn: <AlertTriangle className="h-4 w-4 text-red-400" />,
    neutral: <Loader2 className="h-4 w-4 text-white/50 animate-spin" />,
  }[tone];

  return (
    <div className={cx("flex items-start gap-4 rounded-2xl border p-4 transition-all hover:bg-white/[0.02]", styles)}>
      <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-black/20 ring-1 ring-white/5">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs opacity-70 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
  to,
}: {
  num: string;
  title: string;
  desc: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.01] p-3 hover:bg-white/[0.04] hover:border-white/10 transition-all"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-xs font-bold text-white/40 font-mono group-hover:text-white group-hover:bg-white/10 transition-colors">
        {num}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white/90">{title}</div>
        </div>
        <div className="text-[11px] text-white/50">{desc}</div>
      </div>
      <ArrowUpRight className="ml-auto h-4 w-4 text-white/20 transition group-hover:text-white/60" />
    </Link>
  );
}
