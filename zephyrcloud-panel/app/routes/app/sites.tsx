// app/routes/sites.tsx
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
  Copy,
  ExternalLink,
  Github,
  Globe,
  KeyRound,
  Loader2,
  Plus,
  Rocket,
  Server,
} from "lucide-react";

type SiteStatus = "RUNNING" | "STOPPED" | "BUILDING" | "ERROR" | "PROVISIONING";
type SiteType = "wordpress" | "node" | "static" | "php" | "python";
type SupportedCreateType = SiteType;
type LoadState = "idle" | "loading" | "ready" | "error";
type RepoAccessMode =
  | "public"
  | "connected_account"
  | "github_app"
  | "deploy_key";

type Site = {
  id: string;
  name: string;
  type: SiteType;
  status: SiteStatus;
  primaryDomain?: string | null;
  createdAt?: string;
};

type LoaderData = {
  sites: Site[];
  user: {
    role?: string;
  };
  githubConnection: GithubConnectionStatus;
};

type ActionData = { ok: true; siteId: string } | { ok: false; error: string };

type GithubAppOption = {
  uuid: string;
  name: string;
};

type GithubRepoOption = {
  full_name: string;
  default_branch: string;
  html_url: string;
  private?: boolean;
  can_manage_keys?: boolean;
};

type GithubBranchOption = {
  name: string;
};

type DeployKeyPayload = {
  uuid: string;
  public_key: string;
  fingerprint?: string;
  repo_full_name?: string | null;
};

type GithubConnectionStatus = {
  configured: boolean;
  connected: boolean;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
  scopes: string[];
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
  return (
    value === "wordpress" ||
    value === "node" ||
    value === "static" ||
    value === "php" ||
    value === "python"
  );
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
      const repoOption: GithubRepoOption = {
        full_name: fullName,
        default_branch: defaultBranch,
        html_url: htmlUrl,
        private: item.private === true,
        can_manage_keys:
          isRecord(item) && typeof item.can_manage_keys === "boolean"
            ? item.can_manage_keys
            : undefined,
      };
      return repoOption;
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

function parseGithubConnection(payload: unknown): GithubConnectionStatus {
  if (!isRecord(payload)) {
    return {
      configured: false,
      connected: false,
      scopes: [],
    };
  }

  return {
    configured: payload.configured === true,
    connected: payload.connected === true,
    login: getStringValue(payload.login) ?? undefined,
    name: getStringValue(payload.name),
    avatar_url: getStringValue(payload.avatar_url),
    scopes: Array.isArray(payload.scopes)
      ? payload.scopes.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [],
  };
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

  const https = input.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/i,
  );
  if (https) {
    const repo = https[2].replace(/\.git$/i, "");
    if (repo) {
      return { owner: https[1], repo };
    }
  }

  const ssh = input.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) {
    const repo = ssh[2].replace(/\.git$/i, "");
    if (repo) {
      return { owner: ssh[1], repo };
    }
  }

  return null;
}

async function fetchJsonList<T>(
  url: string,
  normalize: (payload: unknown) => T[],
): Promise<T[]> {
  const payload = await fetchJson(url, {
    method: "GET",
    credentials: "same-origin",
  });
  return normalize(payload);
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      parseApiError(payload, `Request failed with status ${response.status}.`),
    );
  }
  return payload;
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
  const { requireUser } = await import("~/services/session.server");

  const { user } = await requireUser(request);

  try {
    const [sitesRes, githubRes] = await Promise.all([
      apiFetchAuthed(request, "/api/sites", { method: "GET" }),
      apiFetchAuthed(request, "/api/github/connection", { method: "GET" }),
    ]);

    const data = await sitesRes.json();
    const sites = Array.isArray(data) ? data : data.sites || data.data || [];
    const githubPayload = await githubRes.json().catch(() => null);

    return {
      sites,
      user: { role: user.role },
      githubConnection: parseGithubConnection(githubPayload),
    };
  } catch (error) {
    console.error("Loader failed", error);
    return {
      sites: [],
      user: { role: user.role },
      githubConnection: {
        configured: false,
        connected: false,
        scopes: [],
      },
    };
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

  if (rawType !== "wordpress") {
    const repoUrl = String(fd.get("repo_url") || "").trim();
    const repoBranch = String(fd.get("repo_branch") || "").trim() || "main";
    const repoAccess = String(fd.get("repo_access") || "public").trim();
    const githubAppId = String(fd.get("github_app_id") || "").trim();
    const privateKeyUuid = String(fd.get("private_key_uuid") || "").trim();

    if (!repoUrl) {
      return {
        ok: false,
        error:
          rawType === "static"
            ? "Static app hosting requires a GitHub repository."
            : rawType === "php"
              ? "PHP app hosting requires a GitHub repository."
              : rawType === "python"
                ? "Python app hosting requires a GitHub repository."
                : "Node.js hosting requires a GitHub repository.",
      };
    }

    payload.repo_url = repoUrl;
    payload.repo_branch = repoBranch;
    payload.auto_deploy =
      repoAccess === "public" || repoAccess === "github_app";

    if (repoAccess === "connected_account") {
      payload.use_github_connection = true;
    }

    if (repoAccess === "github_app") {
      if (!githubAppId) {
        return {
          ok: false,
          error:
            "Select a GitHub App connection for private GitHub App deployments.",
        };
      }
      payload.github_app_id = githubAppId;
    }

    if (repoAccess === "deploy_key") {
      if (!privateKeyUuid) {
        return {
          ok: false,
          error:
            "Generate a deploy key before creating a private repository site.",
        };
      }
      payload.private_key_uuid = privateKeyUuid;
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
      headers: { Location: `/sites/${siteId}` },
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
    case "python":
      return { label: "Python", icon: <Code2 className="h-4 w-4" /> };
    case "static":
      return { label: "Static", icon: <Globe className="h-4 w-4" /> };
    default:
      return { label: type, icon: <Boxes className="h-4 w-4" /> };
  }
}

function createTypeMeta(type: SupportedCreateType) {
  switch (type) {
    case "wordpress":
      return {
        title: "WordPress",
        placeholder: "my-wordpress-site",
        repoHelp: "We will set up WordPress together with its database for you.",
        submitLabel: "Create WordPress site",
      };
    case "static":
      return {
        title: "Static",
        placeholder: "marketing-site",
        repoHelp: "We will publish this repository as a static website.",
        submitLabel: "Create static site",
      };
    case "php":
      return {
        title: "PHP",
        placeholder: "customer-portal",
        repoHelp: "We will publish this repository as a PHP application.",
        submitLabel: "Create PHP site",
      };
    case "python":
      return {
        title: "Python",
        placeholder: "fastapi-service",
        repoHelp: "We will publish this repository as a Python application.",
        submitLabel: "Create Python site",
      };
    default:
      return {
        title: "Node.js",
        placeholder: "my-node-app",
        repoHelp: "We will publish this repository as a Node.js application.",
        submitLabel: "Create Node.js site",
      };
  }
}

// ------------------------------
// Main Component
// ------------------------------
export default function SitesPage() {
  const { sites, user, githubConnection } = useLoaderData() as LoaderData;
  const nav = useNavigation();
  const [searchParams] = useSearchParams();
  const actionData = useActionData() as ActionData | undefined;

  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const githubStatus = searchParams.get("github");
  const githubMessage = searchParams.get("github_message");

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
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Websites
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Sites
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Manage your websites, domains, and publishing status from one place.
          </p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          New Site
        </button>
      </div>

      {githubStatus === "connected" ? (
        <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
          <div className="font-semibold">GitHub connected</div>
          <p className="mt-1 opacity-85">
            Eligible private repositories are now available during site setup.
          </p>
        </div>
      ) : githubStatus === "error" || githubStatus === "invalid-state" ? (
        <div className="rounded-md border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-100">
          <div className="font-semibold">GitHub connection failed</div>
          <p className="mt-1 opacity-85">
            {githubMessage || "GitHub could not be connected right now."}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="w-full rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by site or domain"
            className="w-full bg-transparent text-sm text-white/82 outline-none placeholder:text-white/32"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-white/30">
            No websites yet. Create your first site to get started.
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
              className="group panel-surface rounded-md border border-white/10 p-6 transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] text-white">
                    {meta.icon}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">
                      {site.name}
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      {meta.label}
                    </div>
                  </div>
                </div>
                <Link
                  to={`/sites/${site.id}`}
                  className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.05] text-white/60 transition-all hover:bg-white/[0.1] hover:text-white"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <StatusPill status={site.status} />
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/62">
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
        canUsePrivateGithubApps={user.role === "admin"}
        githubConnection={githubConnection}
      />
    </div>
  );
}

function CreateSiteModal({
  open,
  onClose,
  actionData,
  isSubmitting,
  canUsePrivateGithubApps,
  githubConnection,
}: {
  open: boolean;
  onClose: () => void;
  actionData?: ActionData;
  isSubmitting: boolean;
  canUsePrivateGithubApps: boolean;
  githubConnection: GithubConnectionStatus;
}) {
  const [createType, setCreateType] =
    React.useState<SupportedCreateType>("wordpress");
  const [siteName, setSiteName] = React.useState("");
  const [repoAccessMode, setRepoAccessMode] =
    React.useState<RepoAccessMode>("public");
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
  const [branchOptions, setBranchOptions] = React.useState<
    GithubBranchOption[]
  >([]);
  const [branchOptionsState, setBranchOptionsState] =
    React.useState<LoadState>("idle");
  const [branchOptionsError, setBranchOptionsError] = React.useState<
    string | null
  >(null);
  const [deployKey, setDeployKey] = React.useState<DeployKeyPayload | null>(
    null,
  );
  const [deployKeyState, setDeployKeyState] = React.useState<LoadState>("idle");
  const [deployKeyError, setDeployKeyError] = React.useState<string | null>(
    null,
  );
  const [deployKeyCopied, setDeployKeyCopied] = React.useState(false);
  const canUseConnectedGithub = githubConnection.configured;
  const isConnectedGithubReady =
    githubConnection.configured && githubConnection.connected;
  const selectedTypeMeta = createTypeMeta(createType);

  React.useEffect(() => {
    if (!canUsePrivateGithubApps) {
      setGithubApps([]);
      setGithubAppsState("idle");
      setGithubAppsError(null);
      setSelectedGithubApp("");
      return;
    }

    if (
      !open ||
      createType === "wordpress" ||
      repoAccessMode !== "github_app"
    ) {
      return;
    }
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
  }, [
    canUsePrivateGithubApps,
    createType,
    githubApps.length,
    githubAppsState,
    open,
    repoAccessMode,
  ]);

  React.useEffect(() => {
    setRepoOptions([]);
    setRepoOptionsState("idle");
    setRepoOptionsError(null);
    setBranchOptions([]);
    setBranchOptionsState("idle");
    setBranchOptionsError(null);

    if (
      !open ||
      createType === "wordpress" ||
      !(
        (repoAccessMode === "github_app" && selectedGithubApp) ||
        (repoAccessMode === "connected_account" && isConnectedGithubReady)
      )
    ) {
      return;
    }

    let cancelled = false;
    setRepoOptionsState("loading");
    const repoUrl =
      repoAccessMode === "connected_account"
        ? "/api/github/connected/repos"
        : `/api/github/repos/${encodeURIComponent(selectedGithubApp)}`;

    fetchJsonList(repoUrl, parseGithubRepos)
      .then((repos) => {
        if (cancelled) return;
        setRepoOptions(
          repoAccessMode === "connected_account"
            ? repos.filter((repo) => repo.can_manage_keys !== false)
            : repos,
        );
        setRepoOptionsState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRepoOptions([]);
        setRepoOptionsState("error");
        setRepoOptionsError(
          error instanceof Error
            ? error.message
            : repoAccessMode === "connected_account"
              ? "Could not load repositories from your connected GitHub account."
              : "Could not load repositories for this GitHub connection.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    createType,
    isConnectedGithubReady,
    open,
    repoAccessMode,
    selectedGithubApp,
  ]);

  React.useEffect(() => {
    setBranchOptions([]);
    setBranchOptionsState("idle");
    setBranchOptionsError(null);

    if (
      !open ||
      createType === "wordpress" ||
      !(
        (repoAccessMode === "github_app" && selectedGithubApp) ||
        (repoAccessMode === "connected_account" && isConnectedGithubReady)
      )
    ) {
      return;
    }

    const repoParts = extractGithubRepoParts(repoInput);
    if (!repoParts) return;

    let cancelled = false;
    setBranchOptionsState("loading");
    const branchesUrl =
      repoAccessMode === "connected_account"
        ? `/api/github/connected/branches/${encodeURIComponent(repoParts.owner)}/${encodeURIComponent(repoParts.repo)}`
        : `/api/github/branches/${encodeURIComponent(selectedGithubApp)}/${encodeURIComponent(repoParts.owner)}/${encodeURIComponent(repoParts.repo)}`;

    fetchJsonList(branchesUrl, parseGithubBranches)
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
            : repoAccessMode === "connected_account"
              ? "Could not load branches from your connected GitHub account."
              : "Could not load branches for this repository.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    createType,
    isConnectedGithubReady,
    open,
    repoAccessMode,
    repoBranch,
    repoInput,
    selectedGithubApp,
  ]);

  React.useEffect(() => {
    if (repoAccessMode !== "github_app") {
      setSelectedGithubApp("");
    }
  }, [repoAccessMode]);

  const repoParts = extractGithubRepoParts(repoInput);
  const repoSettingsUrl = repoParts
    ? `https://github.com/${repoParts.owner}/${repoParts.repo}/settings/keys`
    : null;

  async function generateDeployKey() {
    if (!siteName.trim()) {
      setDeployKey(null);
      setDeployKeyState("error");
      setDeployKeyError("Enter a site name before generating a deploy key.");
      return;
    }

    if (!repoInput.trim()) {
      setDeployKey(null);
      setDeployKeyState("error");
      setDeployKeyError(
        "Enter the GitHub repository before generating a deploy key.",
      );
      return;
    }

    setDeployKeyCopied(false);
    setDeployKey(null);
    setDeployKeyError(null);
    setDeployKeyState("loading");

    try {
      const payload = await fetchJson("/api/deploy-keys", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: siteName,
          repo_url: repoInput,
        }),
      });

      if (!isRecord(payload)) {
        throw new Error("Deploy key response was invalid.");
      }

      const uuid = getStringValue(payload.uuid);
      const publicKey = getStringValue(payload.public_key);
      if (!uuid || !publicKey) {
        throw new Error("Deploy key response was incomplete.");
      }

      setDeployKey({
        uuid,
        public_key: publicKey,
        fingerprint: getStringValue(payload.fingerprint) ?? undefined,
        repo_full_name: getStringValue(payload.repo_full_name),
      });
      setDeployKeyState("ready");
    } catch (error: unknown) {
      setDeployKey(null);
      setDeployKeyState("error");
      setDeployKeyError(
        error instanceof Error
          ? error.message
          : "Could not generate a deploy key.",
      );
    }
  }

  async function copyDeployKey() {
    if (!deployKey?.public_key) return;

    try {
      await navigator.clipboard.writeText(deployKey.public_key);
      setDeployKeyCopied(true);
    } catch {
      setDeployKeyCopied(false);
    }
  }

  const createOptions: Array<{
    type: SupportedCreateType;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      type: "wordpress",
      title: "WordPress",
      description: "Launch a managed WordPress website with its own database.",
      icon: <Code2 className="h-5 w-5" />,
    },
    {
      type: "node",
      title: "Node.js",
      description: "Publish a Node.js application from a GitHub repository.",
      icon: <Server className="h-5 w-5" />,
    },
    {
      type: "static",
      title: "Static",
      description: "Publish a static website or SPA from a GitHub repository.",
      icon: <Globe className="h-5 w-5" />,
    },
    {
      type: "php",
      title: "PHP",
      description: "Publish a PHP application from a GitHub repository.",
      icon: <Code2 className="h-5 w-5" />,
    },
    {
      type: "python",
      title: "Python",
      description: "Publish a Python application from a GitHub repository.",
      icon: <Code2 className="h-5 w-5" />,
    },
  ];

  const accessOptions: Array<{
    value: RepoAccessMode;
    title: string;
    description: string;
    disabled?: boolean;
  }> = [
    {
      value: "public",
      title: "Public repository",
      description: "Use a public GitHub repository with no extra connection.",
    },
    {
      value: "connected_account",
      title: "Connected GitHub",
      description: canUseConnectedGithub
        ? "Choose from eligible private repositories with your connected account."
        : "GitHub sign-in must be enabled before private repositories can be used here.",
      disabled: !canUseConnectedGithub,
    },
    ...(canUsePrivateGithubApps
      ? [
          {
            value: "github_app" as const,
            title: "GitHub App",
            description: "Use a shared GitHub connection managed by an administrator.",
          },
        ]
      : []),
    {
      value: "deploy_key",
      title: "Manual key",
      description: "Use a repository deploy key if you prefer not to connect GitHub.",
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
            className="panel-surface relative my-10 w-full max-w-2xl rounded-md border border-white/10 bg-[var(--surface-dark)] p-8 shadow-2xl"
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
              <div className="mt-4 flex items-center gap-3 rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{actionData.error}</span>
              </div>
            )}

            <Form method="post" className="mt-8 space-y-6">
              <input type="hidden" name="type" value={createType} />
              {createType !== "wordpress" && (
                <input
                  type="hidden"
                  name="repo_access"
                  value={repoAccessMode}
                />
              )}

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
                          "rounded-md border p-5 text-left transition-all",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_rgba(47,107,255,0.2)]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cx(
                              "grid size-10 place-items-center rounded-md border",
                              active
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-white/10 bg-white/[0.05] text-white/70",
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
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder={selectedTypeMeta.placeholder}
                  className="w-full rounded-md border border-white/10 bg-[var(--surface-elevated)] px-5 py-4 text-white outline-none transition-all placeholder:text-white/24 focus:ring-2 ring-white/10"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-white/50">
                Workspace limits apply before launch, including site count,
                CPU, memory, and people access.
              </div>

              {createType === "wordpress" ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl bg-white text-black">
                      <Code2 className="h-5 w-5" />
                    </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      WordPress site
                    </div>
                    <p className="text-xs text-white/45">
                      Your website and database will be prepared automatically.
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
                        Repository source
                      </div>
                      <p className="text-xs text-white/45">
                        Use a public repository, connect GitHub for private access,
                        or add a manual repository key.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                      Repository access
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {accessOptions.map((option) => {
                        const active = repoAccessMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={option.disabled}
                            onClick={() => {
                              if (option.disabled) return;
                              setRepoAccessMode(option.value);
                              setDeployKey(null);
                              setDeployKeyCopied(false);
                              setDeployKeyError(null);
                              setDeployKeyState("idle");
                            }}
                            className={cx(
                              "rounded-2xl border p-4 text-left transition-all",
                              active
                                ? "border-white/25 bg-white/[0.07]"
                                : option.disabled
                                  ? "cursor-not-allowed border-white/5 bg-white/[0.015] text-white/35 opacity-60"
                                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
                            )}
                          >
                            <div className="text-sm font-bold text-white">
                              {option.title}
                            </div>
                            <p className="mt-1 text-xs text-white/45">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-sm font-bold uppercase tracking-wider text-white/60">
                      Connection method
                    </label>
                    {repoAccessMode === "github_app" &&
                    canUsePrivateGithubApps ? (
                      <>
                        <select
                          name="github_app_id"
                          value={selectedGithubApp}
                          onChange={(event) =>
                            setSelectedGithubApp(event.target.value)
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all focus:ring-2 ring-white/10"
                        >
                          <option value="" className="bg-[#080B12] text-white">
                            No shared GitHub connection selected
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
                            Loading available GitHub connections...
                          </p>
                        )}
                        {githubAppsError && (
                          <p className="text-xs text-amber-300">
                            {githubAppsError}
                          </p>
                        )}
                      </>
                    ) : repoAccessMode === "github_app" ? (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                        Shared GitHub connections are available to administrators only.
                      </div>
                    ) : repoAccessMode === "connected_account" ? (
                      !githubConnection.configured ? (
                        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                          GitHub sign-in is not available for this workspace yet.
                        </div>
                      ) : !githubConnection.connected ? (
                        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-100 md:flex-row md:items-center md:justify-between">
                          <div>
                            Connect GitHub once to choose from eligible private repositories.
                          </div>
                          <a
                            href="/api/github/oauth/start?returnTo=/sites?new=1"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                          >
                            <Github className="h-4 w-4" />
                            Connect GitHub
                          </a>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                          Connected as{" "}
                          <span className="font-semibold text-white">
                            @
                            {githubConnection.login ||
                              githubConnection.name ||
                              "github-user"}
                          </span>
                          . Private repositories are ready to use.
                        </div>
                      )
                    ) : repoAccessMode === "deploy_key" ? (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                        Use a repository deploy key if you prefer not to connect GitHub.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                        Public repositories do not need any additional connection.
                      </div>
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
                        if (repoAccessMode === "deploy_key") {
                          setDeployKey(null);
                          setDeployKeyCopied(false);
                          setDeployKeyError(null);
                          setDeployKeyState("idle");
                        }
                        const matchedRepo = repoOptions.find(
                          (repo) => repo.full_name === nextRepo,
                        );
                        if (matchedRepo?.default_branch) {
                          setRepoBranch(matchedRepo.default_branch);
                        }
                      }}
                      placeholder={
                        repoAccessMode === "deploy_key"
                          ? "owner/repo, https://github.com/owner/repo, or git@github.com:owner/repo.git"
                          : "owner/repo or https://github.com/owner/repo"
                      }
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
                        {repoAccessMode === "connected_account"
                          ? "Loading repositories from GitHub..."
                          : "Loading repositories from the selected connection..."}
                      </p>
                    )}
                    {repoOptionsError && (
                      <p className="text-xs text-amber-300">
                        {repoOptionsError}
                      </p>
                    )}
                    {!repoOptionsError && repoOptions.length > 0 && (
                      <p className="text-xs text-white/45">
                        {repoAccessMode === "connected_account"
                          ? "Start typing to choose a repository from your connected account."
                          : "Start typing to choose one of the available repositories."}
                      </p>
                    )}
                    {repoAccessMode === "connected_account" &&
                      isConnectedGithubReady &&
                      repoOptions.length === 0 &&
                      repoOptionsState === "ready" && (
                        <p className="text-xs text-amber-200">
                          No eligible repositories were found for this GitHub account.
                        </p>
                      )}
                    {repoAccessMode === "deploy_key" && (
                      <p className="text-xs text-white/45">
                        GitHub URLs are normalized automatically when the key is generated.
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
                        {repoAccessMode === "connected_account"
                          ? "Loading branches from your connected GitHub account..."
                          : "Loading branches for this repository..."}
                      </p>
                    )}
                    {branchOptionsError && (
                      <p className="text-xs text-amber-300">
                        {branchOptionsError}
                      </p>
                    )}
                    <p className="text-xs text-white/45">
                      {selectedTypeMeta.repoHelp}
                    </p>
                  </div>

                  {repoAccessMode === "deploy_key" && (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <input
                        type="hidden"
                        name="private_key_uuid"
                        value={deployKey?.uuid ?? ""}
                      />

                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">
                            Repository deploy key
                          </div>
                          <p className="text-xs text-white/45">
                            Generate a read-only key, add it to GitHub, then create the site.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void generateDeployKey()}
                          disabled={deployKeyState === "loading"}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deployKeyState === "loading" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                          {deployKey ? "Generate new key" : "Generate key"}
                        </button>
                      </div>

                      {deployKeyError && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                          {deployKeyError}
                        </div>
                      )}

                      {deployKey && (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100">
                            1. Add this public key to the repository as a read-only deploy key.
                            <br />
                            2. Confirm the correct branch is selected.
                            <br />
                            3. Create the site.
                          </div>

                          <div className="space-y-2">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-white/40">
                              Public key
                            </label>
                            <textarea
                              readOnly
                              value={deployKey.public_key}
                              rows={4}
                              className="w-full rounded-2xl border border-white/10 bg-[#05070d] px-4 py-3 font-mono text-xs text-white/85 outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void copyDeployKey()}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              <Copy className="h-4 w-4" />
                              {deployKeyCopied ? "Copied" : "Copy key"}
                            </button>
                            {repoSettingsUrl && (
                              <a
                                href={repoSettingsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open GitHub settings
                              </a>
                            )}
                          </div>

                          {deployKey.fingerprint && (
                            <p className="text-xs text-white/45">
                              Fingerprint:{" "}
                              <span className="font-mono text-white/70">
                                {deployKey.fingerprint}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                {selectedTypeMeta.submitLabel}
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
