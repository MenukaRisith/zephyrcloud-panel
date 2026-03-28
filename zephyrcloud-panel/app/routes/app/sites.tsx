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
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Code2,
  Github,
  Globe,
  Loader2,
  Plus,
  Rocket,
  Server,
} from "lucide-react";

type SiteStatus = "RUNNING" | "STOPPED" | "BUILDING" | "ERROR" | "PROVISIONING";
type SiteType = "wordpress" | "node" | "static" | "php";
type SupportedCreateType = "wordpress" | "node";
type LoadState = "idle" | "loading" | "ready" | "error";

type Site = {
  id: string;
  name: string;
  type: SiteType;
  status: SiteStatus;
  primaryDomain?: string | null;
  createdAt?: string;
};

type LoaderData = { sites: Site[] };

type ActionData = { ok: true; siteId: string } | { ok: false; error: string };

type GithubAppOption = {
  uuid: string;
  name: string;
};

type GithubRepoOption = {
  full_name: string;
  default_branch: string;
  html_url: string;
};

type GithubBranchOption = {
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseApiError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const message = payload.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") {
    return message[0];
  }
  return fallback;
}

function isSupportedCreateType(value: string): value is SupportedCreateType {
  return value === "wordpress" || value === "node";
}

function parseGithubApps(payload: unknown): GithubAppOption[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      if (!isRecord(item)) return null;
      const uuid = getStringValue(item.uuid);
      const name = getStringValue(item.name);
      const id =
        typeof item.id === "number"
          ? item.id
          : typeof item.id === "string"
            ? Number.parseInt(item.id, 10)
            : Number.NaN;

      if (!uuid || !name || !Number.isFinite(id) || id <= 0) return null;
      return { uuid, name };
    })
    .filter((item): item is GithubAppOption => item !== null);
}

function parseGithubRepos(payload: unknown): GithubRepoOption[] {
  const rawItems = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.repositories)
      ? payload.repositories
      : [];

  return rawItems
    .map((item) => {
      if (!isRecord(item)) return null;
      const fullName = getStringValue(item.full_name);
      const htmlUrl = getStringValue(item.html_url) ?? "";
      const defaultBranch = getStringValue(item.default_branch) ?? "main";
      if (!fullName) return null;
      return {
        full_name: fullName,
        default_branch: defaultBranch,
        html_url: htmlUrl,
      };
    })
    .filter((item): item is GithubRepoOption => item !== null);
}

function parseGithubBranches(payload: unknown): GithubBranchOption[] {
  const rawItems = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.branches)
      ? payload.branches
      : [];

  return rawItems
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = getStringValue(item.name);
      if (!name) return null;
      return { name };
    })
    .filter((item): item is GithubBranchOption => item !== null);
}

function extractGithubRepoParts(
  value: string,
): { owner: string; repo: string } | null {
  const input = value.trim();
  if (!input) return null;

  const simple = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (simple) {
    return { owner: simple[1], repo: simple[2] };
  }

  const https = input.match(/github\.com\/([^/]+)\/([^/.?#]+)(?:\.git)?/i);
  if (https) {
    return { owner: https[1], repo: https[2] };
  }

  const ssh = input.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/i);
  if (ssh) {
    return { owner: ssh[1], repo: ssh[2] };
  }

  return null;
}

async function fetchJsonList<T>(
  url: string,
  normalize: (payload: unknown) => T[],
): Promise<T[]> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      parseApiError(payload, `Request failed with status ${response.status}.`),
    );
  }

  return normalize(payload);
}

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
  const rawType = String(fd.get("type") || "").trim();

  if (!name) {
    return { ok: false, error: "Site name is required." };
  }

  if (!isSupportedCreateType(rawType)) {
    return { ok: false, error: "Choose a supported site type." };
  }

  const payload: Record<string, unknown> = {
    name,
    type: rawType,
  };

  if (rawType === "node") {
    const repoUrl = String(fd.get("repo_url") || "").trim();
    const repoBranch = String(fd.get("repo_branch") || "").trim() || "main";
    const githubAppId = String(fd.get("github_app_id") || "").trim();

    if (!repoUrl) {
      return {
        ok: false,
        error: "Node.js hosting requires a GitHub repository.",
      };
    }

    payload.repo_url = repoUrl;
    payload.repo_branch = repoBranch;
    payload.auto_deploy = true;

    if (githubAppId) {
      payload.github_app_id = githubAppId;
    }
  }

  try {
    const res = await apiFetchAuthed(request, "/api/sites", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const created = await res.json();
    const siteId = String(
      created.id ?? created.site_id ?? created.siteId ?? "",
    );

    if (!res.ok || !siteId) {
      return {
        ok: false,
        error: parseApiError(created, "Failed to create site."),
      };
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `/app/sites/${siteId}` },
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Server connection failed.",
    };
  }
}

// ------------------------------
// Utils
// ------------------------------
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function typeMeta(type: SiteType) {
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

  const filtered = sites.filter((site) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return true;
    return (
      site.name.toLowerCase().includes(normalizedQuery) ||
      (site.primaryDomain || "").toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
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
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-black shadow-xl transition-all hover:bg-white/90"
        >
          <Plus className="h-4 w-4" />
          New Site
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sites by name or domain..."
            className="w-full bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-white/30">
            No sites found. Create your first one.
          </div>
        )}

        {filtered.map((site, index) => {
          const meta = typeMeta(site.type);
          return (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group rounded-[32px] border border-white/5 bg-white/[0.03] p-6 backdrop-blur-xl transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-2xl bg-white/5 text-white/70 ring-1 ring-white/10">
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
                  className="grid size-10 place-items-center rounded-xl bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
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

      <CreateSiteModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        actionData={actionData}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

function CreateSiteModal({
  open,
  onClose,
  actionData,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  actionData?: ActionData;
  isSubmitting: boolean;
}) {
  const [createType, setCreateType] =
    React.useState<SupportedCreateType>("wordpress");
  const [githubApps, setGithubApps] = React.useState<GithubAppOption[]>([]);
  const [githubAppsState, setGithubAppsState] =
    React.useState<LoadState>("idle");
  const [githubAppsError, setGithubAppsError] = React.useState<string | null>(
    null,
  );
  const [selectedGithubApp, setSelectedGithubApp] = React.useState("");
  const [repoInput, setRepoInput] = React.useState("");
  const [repoBranch, setRepoBranch] = React.useState("main");
  const [repoOptions, setRepoOptions] = React.useState<GithubRepoOption[]>([]);
  const [repoOptionsState, setRepoOptionsState] =
    React.useState<LoadState>("idle");
  const [repoOptionsError, setRepoOptionsError] = React.useState<string | null>(
    null,
  );
  const [branchOptions, setBranchOptions] = React.useState<GithubBranchOption[]>(
    [],
  );
  const [branchOptionsState, setBranchOptionsState] =
    React.useState<LoadState>("idle");
  const [branchOptionsError, setBranchOptionsError] =
    React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || createType !== "node") return;
    if (
      githubAppsState === "ready" ||
      githubAppsState === "loading" ||
      githubApps.length > 0
    ) {
      return;
    }

    let cancelled = false;
    setGithubAppsState("loading");
    setGithubAppsError(null);

    fetchJsonList("/api/github/apps", parseGithubApps)
      .then((apps) => {
        if (cancelled) return;
        setGithubApps(apps);
        setGithubAppsState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGithubApps([]);
        setGithubAppsState("error");
        setGithubAppsError(
          error instanceof Error
            ? error.message
            : "Could not load GitHub connections.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [createType, githubApps.length, githubAppsState, open]);

  React.useEffect(() => {
    setRepoOptions([]);
    setRepoOptionsState("idle");
    setRepoOptionsError(null);
    setBranchOptions([]);
    setBranchOptionsState("idle");
    setBranchOptionsError(null);

    if (!open || createType !== "node" || !selectedGithubApp) return;

    let cancelled = false;
    setRepoOptionsState("loading");

    fetchJsonList(
      `/api/github/repos/${encodeURIComponent(selectedGithubApp)}`,
      parseGithubRepos,
    )
      .then((repos) => {
        if (cancelled) return;
        setRepoOptions(repos);
        setRepoOptionsState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRepoOptions([]);
        setRepoOptionsState("error");
        setRepoOptionsError(
          error instanceof Error
            ? error.message
            : "Could not load repositories for this GitHub connection.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [createType, open, selectedGithubApp]);

  React.useEffect(() => {
    setBranchOptions([]);
    setBranchOptionsState("idle");
    setBranchOptionsError(null);

    if (!open || createType !== "node" || !selectedGithubApp) return;

    const repoParts = extractGithubRepoParts(repoInput);
    if (!repoParts) return;

    let cancelled = false;
    setBranchOptionsState("loading");

    fetchJsonList(
      `/api/github/branches/${encodeURIComponent(selectedGithubApp)}/${encodeURIComponent(repoParts.owner)}/${encodeURIComponent(repoParts.repo)}`,
      parseGithubBranches,
    )
      .then((branches) => {
        if (cancelled) return;
        setBranchOptions(branches);
        setBranchOptionsState("ready");
        if (
          branches.length > 0 &&
          !branches.some((branch) => branch.name === repoBranch)
        ) {
          setRepoBranch(branches[0].name);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBranchOptions([]);
        setBranchOptionsState("error");
        setBranchOptionsError(
          error instanceof Error
            ? error.message
            : "Could not load branches for this repository.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [createType, open, repoBranch, repoInput, selectedGithubApp]);

  const createOptions: Array<{
    type: SupportedCreateType;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      type: "wordpress",
      title: "WordPress",
      description: "Provision WordPress with a managed MariaDB database.",
      icon: <Code2 className="h-5 w-5" />,
    },
    {
      type: "node",
      title: "Node.js",
      description: "Deploy a GitHub repository to Coolify with Nixpacks.",
      icon: <Server className="h-5 w-5" />,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative my-10 w-full max-w-2xl rounded-[40px] border border-white/10 bg-[#080B12] p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Create Site
              </h2>
              <button
                onClick={onClose}
                className="text-sm font-medium text-white/30 transition-colors hover:text-white"
              >
                Close
              </button>
            </div>

            {actionData?.ok === false && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{actionData.error}</span>
              </div>
            )}

            <Form method="post" className="mt-8 space-y-6">
              <input type="hidden" name="type" value={createType} />

              <div className="space-y-3">
                <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                  Site Type
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {createOptions.map((option) => {
                    const active = createType === option.type;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => setCreateType(option.type)}
                        className={cx(
                          "rounded-3xl border p-5 text-left transition-all",
                          active
                            ? "border-white/30 bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cx(
                              "grid size-10 place-items-center rounded-2xl",
                              active
                                ? "bg-white text-black"
                                : "bg-white/10 text-white/70",
                            )}
                          >
                            {option.icon}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {option.title}
                            </div>
                            <p className="text-xs text-white/45">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                  Site Name
                </label>
                <input
                  name="name"
                  required
                  placeholder={
                    createType === "node" ? "my-node-app" : "my-wordpress-site"
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all placeholder:text-white/20 focus:ring-2 ring-white/10"
                />
              </div>

              {createType === "wordpress" ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl bg-white text-black">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        WordPress Deployment
                      </div>
                      <p className="text-xs text-white/45">
                        This provisions WordPress together with its database in
                        Coolify.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl bg-white text-black">
                      <Github className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Node.js Deployment
                      </div>
                      <p className="text-xs text-white/45">
                        Public repos work without a GitHub app. Select a
                        connected GitHub app for private repositories and branch
                        discovery.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                      GitHub Connection
                    </label>
                    <select
                      name="github_app_id"
                      value={selectedGithubApp}
                      onChange={(event) => setSelectedGithubApp(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all focus:ring-2 ring-white/10"
                    >
                      <option value="" className="bg-[#080B12] text-white">
                        No GitHub app (public repo/manual)
                      </option>
                      {githubApps.map((app) => (
                        <option
                          key={app.uuid}
                          value={app.uuid}
                          className="bg-[#080B12] text-white"
                        >
                          {app.name}
                        </option>
                      ))}
                    </select>
                    {githubAppsState === "loading" && (
                      <p className="text-xs text-white/45">
                        Loading GitHub connections...
                      </p>
                    )}
                    {githubAppsError && (
                      <p className="text-xs text-amber-300">
                        {githubAppsError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                      Repository
                    </label>
                    <input
                      name="repo_url"
                      required
                      list="node-repository-options"
                      value={repoInput}
                      onChange={(event) => {
                        const nextRepo = event.target.value;
                        setRepoInput(nextRepo);
                        const matchedRepo = repoOptions.find(
                          (repo) => repo.full_name === nextRepo,
                        );
                        if (matchedRepo?.default_branch) {
                          setRepoBranch(matchedRepo.default_branch);
                        }
                      }}
                      placeholder="owner/repo or https://github.com/owner/repo"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all placeholder:text-white/20 focus:ring-2 ring-white/10"
                    />
                    <datalist id="node-repository-options">
                      {repoOptions.map((repo) => (
                        <option key={repo.full_name} value={repo.full_name}>
                          {repo.full_name}
                        </option>
                      ))}
                    </datalist>
                    {repoOptionsState === "loading" && (
                      <p className="text-xs text-white/45">
                        Loading repositories from the selected GitHub app...
                      </p>
                    )}
                    {repoOptionsError && (
                      <p className="text-xs text-amber-300">
                        {repoOptionsError}
                      </p>
                    )}
                    {!repoOptionsError && repoOptions.length > 0 && (
                      <p className="text-xs text-white/45">
                        Start typing to pick one of the connected repositories.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                      Branch
                    </label>
                    <input
                      name="repo_branch"
                      list="node-branch-options"
                      value={repoBranch}
                      onChange={(event) => setRepoBranch(event.target.value)}
                      placeholder="main"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all placeholder:text-white/20 focus:ring-2 ring-white/10"
                    />
                    <datalist id="node-branch-options">
                      {branchOptions.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </datalist>
                    {branchOptionsState === "loading" && (
                      <p className="text-xs text-white/45">
                        Loading branches for this repository...
                      </p>
                    )}
                    {branchOptionsError && (
                      <p className="text-xs text-amber-300">
                        {branchOptionsError}
                      </p>
                    )}
                    <p className="text-xs text-white/45">
                      Coolify will create a Git-based Node.js application and
                      expose it on port 3000.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-[24px] bg-white py-5 text-base font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:grayscale disabled:opacity-30"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Rocket className="h-5 w-5" />
                )}
                {createType === "node"
                  ? "Create Node.js Application"
                  : "Create WordPress Site"}
              </button>
            </Form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
        cfg,
      )}
    >
      {status === "BUILDING" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status}
    </span>
  );
}
