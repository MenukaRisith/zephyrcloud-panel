// app/routes/app/sites.tsx
import * as React from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  Plus,
  Rocket,
  Globe,
  Code2,
  ArrowRight,
  Loader2,
  Github,
  AlertCircle,
} from "lucide-react";

type SiteStatus = "RUNNING" | "STOPPED" | "BUILDING" | "ERROR" | "PROVISIONING";

type Site = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "static" | "php";
  status: SiteStatus;
  primaryDomain?: string | null;
  createdAt?: string;
};

type LoaderData = { sites: Site[] };

type ActionData = { ok: true; siteId: string } | { ok: false; error: string };

// ------------------------------
// Server: loader/action
// ------------------------------
export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  try {
    const res = await apiFetchAuthed(request, "/api/sites", { method: "GET" });
    const data = await res.json();
    const sites = Array.isArray(data) ? data : data.sites || data.data || [];
    return { sites };
  } catch (error) {
    console.error("Loader failed", error);
    return { sites: [] };
  }
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<ActionData | Response> {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const fd = await request.formData();
  const name = String(fd.get("name") || "").trim();
  const type = String(fd.get("type") || "").trim() as Site["type"];

  if (!name) return { ok: false, error: "Site name is required." };
  if (type !== "wordpress")
    return {
      ok: false,
      error: "Only WordPress creation is enabled right now.",
    };

  try {
    const res = await apiFetchAuthed(request, "/api/sites", {
      method: "POST",
      body: JSON.stringify({
        name,
        type,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const created = await res.json();
    const siteId = String(
      created.id ?? created.site_id ?? created.siteId ?? "",
    );

    if (!res.ok || !siteId) {
      return { ok: false, error: created.message || "Failed to create site." };
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `/app/sites/${siteId}` },
    });
  } catch (error: any) {
    return { ok: false, error: error.message || "Server connection failed." };
  }
}

// ------------------------------
// Utils
// ------------------------------
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function typeMeta(type: Site["type"]) {
  switch (type) {
    case "wordpress":
      return { label: "WordPress", icon: <Code2 className="h-4 w-4" /> };
    case "node":
      return { label: "Node.js", icon: <Github className="h-4 w-4" /> };
    case "php":
      return { label: "PHP", icon: <Code2 className="h-4 w-4" /> };
    case "static":
      return { label: "Static", icon: <Globe className="h-4 w-4" /> };
    default:
      return { label: type, icon: <Boxes className="h-4 w-4" /> };
  }
}

// ------------------------------
// Main Component
// ------------------------------
export default function SitesPage() {
  const { sites } = useLoaderData() as LoaderData;
  const nav = useNavigation();
  const [searchParams] = useSearchParams();
  const actionData = useActionData() as ActionData | undefined;

  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const wantsNew = searchParams.get("new");
    if (wantsNew === "1" || wantsNew === "true") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const isSubmitting = nav.state === "submitting";

  const filtered = sites.filter((s) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.primaryDomain || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Sites
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Deploy and manage your web applications.
          </p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/90 shadow-xl transition-all"
        >
          <Plus className="h-4 w-4" />
          New Site
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites by name or domain…"
            className="w-full bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-white/30 text-sm">
            No sites found. Create your first one!
          </div>
        )}
        {filtered.map((site, idx) => {
          const meta = typeMeta(site.type);
          return (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-[32px] border border-white/5 bg-white/[0.03] p-6 backdrop-blur-xl group hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 grid place-items-center rounded-2xl bg-white/5 text-white/70 ring-1 ring-white/10">
                    {meta.icon}
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {site.name}
                    </div>
                    <div className="text-xs text-white/40">{meta.label}</div>
                  </div>
                </div>
                <Link
                  to={`/app/sites/${site.id}`}
                  className="size-10 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <StatusPill status={site.status} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/50">
                  <Globe className="h-3 w-3" />
                  {site.primaryDomain || "No custom domain"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-full max-w-lg bg-[#080B12] border border-white/10 rounded-[40px] p-8 shadow-2xl my-10 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Create Site
                </h2>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="text-white/30 hover:text-white transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>

              {actionData?.ok === false && (
                <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{actionData.error}</span>
                </div>
              )}

              <Form method="post" className="mt-8 space-y-6">
                <input type="hidden" name="type" value="wordpress" />

                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60 ml-1 uppercase tracking-wider">
                    Site Name
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="my-awesome-app"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 ring-white/10 placeholder:text-white/20 transition-all"
                  />
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <div className="size-10 grid place-items-center rounded-2xl bg-white text-black">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        WordPress Deployment
                      </div>
                      <p className="text-xs text-white/45">
                        Node.js, Static, and PHP creation are temporarily
                        disabled.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-white text-black py-5 rounded-[24px] font-black text-base flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Rocket className="h-5 w-5" />
                  )}
                  Create Application
                </button>
              </Form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusPill({ status }: { status: SiteStatus }) {
  const cfg =
    (
      {
        RUNNING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        STOPPED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
        ERROR: "bg-red-500/10 text-red-100 border-red-500/20",
        BUILDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        PROVISIONING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      } as const
    )[status] || "bg-white/5 text-white/50 border-white/10";

  return (
    <span
      className={cx(
        "px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest flex items-center gap-1.5",
        cfg,
      )}
    >
      {status === "BUILDING" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status}
    </span>
  );
}
