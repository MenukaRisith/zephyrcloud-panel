// app/routes/sites.tsx
import * as React from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Copy,
  ExternalLink,
  GitBranch,
  Github,
  Globe,
  KeyRound,
  Loader2,
  Plus,
  Rocket,
  ShieldCheck,
  Type,
  X,
} from "lucide-react";

type MotionLikeProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
};

function MotionDiv({
  animate,
  exit,
  initial,
  transition,
  whileHover,
  whileTap,
  ...props
}: MotionLikeProps<HTMLDivElement>) {
  return <div {...props} />;
}

function AnimatePresenceShim({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

type SiteStatus = "RUNNING" | "STOPPED" | "BUILDING" | "ERROR" | "PROVISIONING";
type SiteType = "wordpress" | "node" | "static" | "php" | "python";
type SupportedCreateType = SiteType;
type LoadState = "idle" | "loading" | "ready" | "error";
type RepoAccessMode =
  | "public"
  | "connected_account"
  | "github_app"
  | "deploy_key";
type CreateSiteStep =
  | "type"
  | "details"
  | "access"
  | "repository"
  | "deploy-key"
  | "review";

type Site = {
  id: string;
  name: string;
  type: SiteType;
  status: string;
  primaryDomain?: string | null;
  createdAt?: string;
  cpu_limit?: number;
  memory_mb?: number;
};

type WorkspaceUsageSite = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  cpu_limit: number;
  memory_mb: number;
  cpu_percentage: number;
  memory_percentage: number;
};

type WorkspaceUsage = {
  tenant_id: string;
  plan: string;
  limits: {
    max_sites: number;
    max_cpu_total: number;
    max_memory_mb_total: number;
    max_team_members_per_site: number;
  };
  usage: {
    sites_used: number;
    sites_remaining: number;
    cpu_used: number;
    cpu_remaining: number;
    memory_mb_used: number;
    memory_mb_remaining: number;
    site_percentage: number;
    cpu_percentage: number;
    memory_percentage: number;
  };
  sites: WorkspaceUsageSite[];
};

type WorkspaceAllocationPreview = {
  blockedReason: string | null;
  sites: Array<{
    id: string;
    name: string;
    cpu_limit: number;
    memory_mb: number;
    isNew: boolean;
  }>;
};

type LoaderData = {
  sites: Site[];
  user: {
    role?: string;
  };
  githubConnection: GithubConnectionStatus;
  workspaceUsage: WorkspaceUsage | null;
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

type PlatformLogoProps = {
  type: SupportedCreateType | SiteType;
  className?: string;
};

function PlatformLogo({ type, className }: PlatformLogoProps) {
  switch (type) {
    case "wordpress":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#3858E9" />
          <path
            fill="#FFFFFF"
            d="M7.5 7.2h2.1l1.3 7.2 1.8-4.9h1.1l1.8 4.9 1.3-7.2h2.1l-2.2 9.6h-1.8L13.4 12l-1.8 4.8H9.8L7.5 7.2Z"
          />
        </svg>
      );
    case "node":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="#5FA04E"
            d="M12 2.9 19.6 7.2v9.6L12 21.1 4.4 16.8V7.2L12 2.9Z"
          />
          <path
            fill="#FFFFFF"
            d="M8.8 8h1.8l3.2 4.7V8h1.4v8h-1.7l-3.3-4.8V16H8.8V8Z"
          />
        </svg>
      );
    case "php":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <ellipse cx="12" cy="12" rx="9.5" ry="6.5" fill="#777BB4" />
          <text
            x="12"
            y="13.7"
            fill="#FFFFFF"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="5"
            fontWeight="700"
            textAnchor="middle"
          >
            PHP
          </text>
        </svg>
      );
    case "python":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="#3776AB"
            d="M12.2 3c-4.1 0-3.9 1.8-3.9 1.8v2.6h5.1v.9H6.1C4 8.3 3 10 3 12.1c0 2.1 1.8 3.8 3.8 3.8h2.3V13c0-1.7 1.4-3.1 3.1-3.1h5.1c1.6 0 2.9-1.3 2.9-2.9V4.8S19.9 3 15.8 3h-3.6Zm-1.2 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
          />
          <path
            fill="#FFD43B"
            d="M11.8 21c4.1 0 3.9-1.8 3.9-1.8v-2.6h-5.1v-.9h7.3c2.1 0 3.1-1.7 3.1-3.8 0-2.1-1.8-3.8-3.8-3.8h-2.3V11c0 1.7-1.4 3.1-3.1 3.1H6.7c-1.6 0-2.9 1.3-2.9 2.9v2.2S4.1 21 8.2 21h3.6Zm1.2-1.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
          />
        </svg>
      );
    case "static":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="#E34F26"
            d="M5 3h14l-1.2 15.2L12 21l-5.8-2.8L5 3Z"
          />
          <path fill="#EF652A" d="M12 4.2v15.4l4.6-2.2 1-13.2H12Z" />
          <path
            fill="#FFFFFF"
            d="M8.1 6.8H12v1.8h-2l.1 1.9H12v1.8H8.5L8.1 6.8Zm3.9 0h3.8l-.2 1.8h-2l.1 1.9h1.8l-.4 4.3-3.1.9v-1.9l1.4-.4.1-1.1H12v-1.8h3.3l.1-1.9H12V6.8Z"
          />
        </svg>
      );
    default:
      return <Boxes className={className} />;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function safeJson(response: Response) {
  return response.json().catch(() => null);
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

function parseSitesPayload(payload: unknown): Site[] {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.sites)
      ? payload.sites
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : [];

  return items
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = getStringValue(item.id);
      const name = getStringValue(item.name);
      const type =
        item.type === "wordpress" ||
        item.type === "node" ||
        item.type === "static" ||
        item.type === "php" ||
        item.type === "python"
          ? item.type
          : null;

      if (!id || !name || !type) return null;

      const site: Site = {
        id,
        name,
        type,
        status: getStringValue(item.status) ?? "UNKNOWN",
        primaryDomain:
          getStringValue(item.primaryDomain ?? item.primary_domain) ?? undefined,
        createdAt: getStringValue(item.createdAt ?? item.created_at) ?? undefined,
        cpu_limit: getNumberValue(item.cpu_limit) ?? undefined,
        memory_mb: getNumberValue(item.memory_mb) ?? undefined,
      };

      return site;
    })
    .filter((item): item is Site => item !== null);
}

function parseWorkspaceUsage(payload: unknown): WorkspaceUsage | null {
  if (!isRecord(payload)) return null;
  if (!isRecord(payload.limits) || !isRecord(payload.usage)) return null;

  const tenantId = getStringValue(payload.tenant_id);
  const plan = getStringValue(payload.plan);
  if (!tenantId || !plan) return null;

  const sites = Array.isArray(payload.sites)
    ? payload.sites
        .map((site) => {
          if (!isRecord(site)) return null;
          const id = getStringValue(site.id);
          const name = getStringValue(site.name);
          if (!id || !name) return null;
          return {
            id,
            name,
            status: getStringValue(site.status) ?? "UNKNOWN",
            created_at:
              getStringValue(site.created_at) ?? new Date(0).toISOString(),
            cpu_limit: getNumberValue(site.cpu_limit) ?? 0,
            memory_mb: getNumberValue(site.memory_mb) ?? 0,
            cpu_percentage: getNumberValue(site.cpu_percentage) ?? 0,
            memory_percentage: getNumberValue(site.memory_percentage) ?? 0,
          } satisfies WorkspaceUsageSite;
        })
        .filter((site): site is WorkspaceUsageSite => site !== null)
    : [];

  return {
    tenant_id: tenantId,
    plan,
    limits: {
      max_sites: getNumberValue(payload.limits.max_sites) ?? 0,
      max_cpu_total: getNumberValue(payload.limits.max_cpu_total) ?? 0,
      max_memory_mb_total: getNumberValue(payload.limits.max_memory_mb_total) ?? 0,
      max_team_members_per_site:
        getNumberValue(payload.limits.max_team_members_per_site) ?? 0,
    },
    usage: {
      sites_used: getNumberValue(payload.usage.sites_used) ?? 0,
      sites_remaining: getNumberValue(payload.usage.sites_remaining) ?? 0,
      cpu_used: getNumberValue(payload.usage.cpu_used) ?? 0,
      cpu_remaining: getNumberValue(payload.usage.cpu_remaining) ?? 0,
      memory_mb_used: getNumberValue(payload.usage.memory_mb_used) ?? 0,
      memory_mb_remaining: getNumberValue(payload.usage.memory_mb_remaining) ?? 0,
      site_percentage: getNumberValue(payload.usage.site_percentage) ?? 0,
      cpu_percentage: getNumberValue(payload.usage.cpu_percentage) ?? 0,
      memory_percentage: getNumberValue(payload.usage.memory_percentage) ?? 0,
    },
    sites,
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
    const [sitesRes, githubRes, workspaceUsageRes] = await Promise.all([
      apiFetchAuthed(request, "/api/sites", { method: "GET" }),
      apiFetchAuthed(request, "/api/github/connection", { method: "GET" }),
      apiFetchAuthed(request, "/api/sites/workspace/usage", { method: "GET" }),
    ]);

    const sitesPayload = await safeJson(sitesRes);
    const githubPayload = await safeJson(githubRes);
    const workspaceUsagePayload = workspaceUsageRes.ok
      ? await safeJson(workspaceUsageRes)
      : null;

    return {
      sites: parseSitesPayload(sitesPayload),
      user: { role: user.role },
      githubConnection: parseGithubConnection(githubPayload),
      workspaceUsage: parseWorkspaceUsage(workspaceUsagePayload),
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
      workspaceUsage: null,
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

function normalizeSiteStatus(status: string): SiteStatus | "UNKNOWN" {
  const normalized = status.toLowerCase();
  if (normalized.includes("run") || normalized.includes("healthy") || normalized === "up") {
    return "RUNNING";
  }
  if (
    normalized.includes("build") ||
    normalized.includes("deploy") ||
    normalized.includes("queue") ||
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
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("crash")) {
    return "ERROR";
  }
  if (normalized.includes("stop") || normalized.includes("down") || normalized.includes("exit")) {
    return "STOPPED";
  }
  return "UNKNOWN";
}

function typeMeta(type: SiteType) {
  switch (type) {
    case "wordpress":
      return { label: "WordPress", icon: <PlatformLogo type="wordpress" className="h-5 w-5" /> };
    case "node":
      return { label: "Node.js", icon: <PlatformLogo type="node" className="h-5 w-5" /> };
    case "php":
      return { label: "PHP", icon: <PlatformLogo type="php" className="h-5 w-5" /> };
    case "python":
      return { label: "Python", icon: <PlatformLogo type="python" className="h-5 w-5" /> };
    case "static":
      return { label: "Static", icon: <PlatformLogo type="static" className="h-5 w-5" /> };
    default:
      return { label: type, icon: <Boxes className="h-5 w-5" /> };
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

function formatCpu(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, "");
}

function formatMemoryMb(value: number) {
  return `${Math.round(value)} MB`;
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

function splitUsageUnits(totalUnits: number, count: number) {
  if (count <= 0) return [] as number[];
  const safeUnits = Math.max(0, Math.trunc(totalUnits));
  const base = Math.floor(safeUnits / count);
  let remainder = safeUnits % count;
  return Array.from({ length: count }, () => {
    const nextValue = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return nextValue;
  });
}

function projectWorkspaceAllocation(
  workspaceUsage: WorkspaceUsage,
  nextSiteName: string,
): WorkspaceAllocationPreview {
  const nextSiteCount = workspaceUsage.sites.length + 1;

  if (nextSiteCount > workspaceUsage.limits.max_sites) {
    return {
      blockedReason: `This workspace has reached its site limit (${workspaceUsage.limits.max_sites}).`,
      sites: [],
    };
  }

  const cpuUnits = splitUsageUnits(
    Math.round(workspaceUsage.limits.max_cpu_total * 100),
    nextSiteCount,
  );
  const memoryUnits = splitUsageUnits(
    workspaceUsage.limits.max_memory_mb_total,
    nextSiteCount,
  );

  if (cpuUnits.some((value) => value < 10)) {
    return {
      blockedReason: `Each site needs at least 0.1 CPU. This workspace pool cannot support ${nextSiteCount} sites.`,
      sites: [],
    };
  }

  if (memoryUnits.some((value) => value < 128)) {
    return {
      blockedReason: `Each site needs at least 128 MB. This workspace pool cannot support ${nextSiteCount} sites.`,
      sites: [],
    };
  }

  const currentSites = workspaceUsage.sites.map((site, index) => ({
    id: site.id,
    name: site.name,
    cpu_limit: cpuUnits[index] / 100,
    memory_mb: memoryUnits[index],
    isNew: false,
  }));

  return {
    blockedReason: null,
    sites: [
      ...currentSites,
      {
        id: "__new__",
        name: nextSiteName.trim() || "New site",
        cpu_limit: cpuUnits[nextSiteCount - 1] / 100,
        memory_mb: memoryUnits[nextSiteCount - 1],
        isNew: true,
      },
    ],
  };
}

// ------------------------------
// Main Component
// ------------------------------
export default function SitesPage() {
  const { sites, user, githubConnection, workspaceUsage } =
    useLoaderData() as LoaderData;
  const nav = useNavigation();
  const revalidator = useRevalidator();
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

  React.useEffect(() => {
    if (!createOpen) return;
    document.getElementById("main-content")?.scrollIntoView({ block: "start" });
  }, [createOpen]);

  const hasActiveTransitions = sites.some((site) => {
    const normalized = normalizeSiteStatus(site.status);
    return normalized === "BUILDING" || normalized === "PROVISIONING";
  });

  React.useEffect(() => {
    const pollInterval = hasActiveTransitions ? 3000 : 10000;
    const interval = window.setInterval(() => {
      if (document.hidden || revalidator.state !== "idle") return;
      revalidator.revalidate();
    }, pollInterval);

    return () => window.clearInterval(interval);
  }, [hasActiveTransitions, revalidator]);

  const isSubmitting = nav.state === "submitting";
  const siteAllocationMap = new Map(
    (workspaceUsage?.sites ?? []).map((site) => [site.id, site]),
  );

  const filtered = sites.filter((site) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return true;
    return (
      site.name.toLowerCase().includes(normalizedQuery) ||
      (site.primaryDomain || "").toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="relative min-h-[calc(100vh-7rem)] space-y-4 pb-16 lg:pb-0">
      {githubStatus === "connected" ? (
        <div className="rounded-md border border-[var(--success)] bg-[var(--success-soft)] px-4 py-3 text-xs text-[var(--success)]">
          <div className="font-semibold">GitHub connected</div>
          <p className="mt-1 opacity-85">
            Eligible private repositories are now available during site setup.
          </p>
        </div>
      ) : githubStatus === "error" || githubStatus === "invalid-state" ? (
        <div className="rounded-md border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-100">
          <div className="font-semibold">GitHub connection failed</div>
          <p className="mt-1 opacity-85">
            {githubMessage || "GitHub could not be connected right now."}
          </p>
        </div>
      ) : null}

      {workspaceUsage ? (
        <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Workspace usage
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {workspaceUsage.plan.replaceAll("_", " ")} pool shared across all sites.
              </p>
            </div>
            <span className="inline-flex items-center border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {workspaceUsage.usage.sites_used} of {workspaceUsage.limits.max_sites} sites in use
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <UsageMetricCard
              label="Sites"
              used={`${workspaceUsage.usage.sites_used}`}
              remaining={`${workspaceUsage.usage.sites_remaining} left`}
              total={`${workspaceUsage.limits.max_sites} total`}
              percentage={workspaceUsage.usage.site_percentage}
            />
            <UsageMetricCard
              label="CPU pool"
              used={formatCpu(workspaceUsage.usage.cpu_used)}
              remaining={`${formatCpu(workspaceUsage.usage.cpu_remaining)} left`}
              total={`${formatCpu(workspaceUsage.limits.max_cpu_total)} total`}
              percentage={workspaceUsage.usage.cpu_percentage}
            />
            <UsageMetricCard
              label="Memory pool"
              used={formatMemoryMb(workspaceUsage.usage.memory_mb_used)}
              remaining={`${formatMemoryMb(workspaceUsage.usage.memory_mb_remaining)} left`}
              total={`${formatMemoryMb(workspaceUsage.limits.max_memory_mb_total)} total`}
              percentage={workspaceUsage.usage.memory_percentage}
            />
          </div>
        </section>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by site or domain"
            className="w-full bg-transparent text-xs text-[var(--text-muted)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-4 text-xs font-medium text-[var(--accent-foreground)] transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          Add site
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-[var(--text-muted)]">
            No websites yet. Create your first site to get started.
          </div>
        )}

        {filtered.map((site, index) => {
          const meta = typeMeta(site.type);
          const allocation = siteAllocationMap.get(site.id);
          const cpuLimit = allocation?.cpu_limit ?? site.cpu_limit;
          const memoryMb = allocation?.memory_mb ?? site.memory_mb;
          return (
            <MotionDiv
              key={site.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/sites/${site.id}`}
                className="group block border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="min-w-0">
                      <div className="inline-flex max-w-full items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                        <span className="text-[var(--text-soft)]">{meta.icon}</span>
                        <span className="truncate">{site.name}</span>
                      </div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {meta.label}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex size-8 shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors group-hover:text-[var(--foreground)]">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <StatusPill status={site.status} />
                  <span
                    className="inline-flex min-w-0 max-w-full items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]"
                    title={site.primaryDomain || "No custom domain"}
                  >
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="truncate">{site.primaryDomain || "No custom domain"}</span>
                  </span>
                  {typeof cpuLimit === "number" ? (
                    <span className="inline-flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                      CPU {formatCpu(cpuLimit)}
                    </span>
                  ) : null}
                  {typeof memoryMb === "number" ? (
                    <span className="inline-flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                      RAM {formatMemoryMb(memoryMb)}
                    </span>
                  ) : null}
                </div>
              </Link>
            </MotionDiv>
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
        workspaceUsage={workspaceUsage}
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
  workspaceUsage,
}: {
  open: boolean;
  onClose: () => void;
  actionData?: ActionData;
  isSubmitting: boolean;
  canUsePrivateGithubApps: boolean;
  githubConnection: GithubConnectionStatus;
  workspaceUsage: WorkspaceUsage | null;
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
  const [currentStep, setCurrentStep] =
    React.useState<CreateSiteStep>("type");
  const [stepNotice, setStepNotice] = React.useState<string | null>(null);
  const canUseConnectedGithub = githubConnection.configured;
  const isConnectedGithubReady =
    githubConnection.configured && githubConnection.connected;
  const selectedTypeMeta = createTypeMeta(createType);
  const allocationPreview = workspaceUsage
    ? projectWorkspaceAllocation(workspaceUsage, siteName)
    : null;

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

  React.useEffect(() => {
    if (
      createType === "wordpress" &&
      (currentStep === "access" ||
        currentStep === "repository" ||
        currentStep === "deploy-key")
    ) {
      setCurrentStep("review");
    }
  }, [createType, currentStep]);

  React.useEffect(() => {
    if (repoAccessMode !== "deploy_key" && currentStep === "deploy-key") {
      setCurrentStep("repository");
    }
  }, [currentStep, repoAccessMode]);

  React.useEffect(() => {
    setStepNotice(null);
  }, [
    createType,
    currentStep,
    deployKey,
    repoAccessMode,
    repoInput,
    selectedGithubApp,
    siteName,
  ]);

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
      icon: <PlatformLogo type="wordpress" className="h-7 w-7" />,
    },
    {
      type: "node",
      title: "Node.js",
      description: "Publish a Node.js application from a GitHub repository.",
      icon: <PlatformLogo type="node" className="h-7 w-7" />,
    },
    {
      type: "static",
      title: "Static",
      description: "Publish a static website or SPA from a GitHub repository.",
      icon: <PlatformLogo type="static" className="h-7 w-7" />,
    },
    {
      type: "php",
      title: "PHP",
      description: "Publish a PHP application from a GitHub repository.",
      icon: <PlatformLogo type="php" className="h-7 w-7" />,
    },
    {
      type: "python",
      title: "Python",
      description: "Publish a Python application from a GitHub repository.",
      icon: <PlatformLogo type="python" className="h-7 w-7" />,
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

  const wizardSteps: CreateSiteStep[] =
    createType === "wordpress"
      ? ["type", "details", "review"]
      : repoAccessMode === "deploy_key"
        ? ["type", "details", "access", "repository", "deploy-key", "review"]
        : ["type", "details", "access", "repository", "review"];
  const activeStep = wizardSteps.includes(currentStep) ? currentStep : "review";
  const activeStepIndex = wizardSteps.indexOf(activeStep);
  const selectedAccessOption = accessOptions.find(
    (option) => option.value === repoAccessMode,
  );
  const selectedGithubAppName =
    githubApps.find((app) => app.uuid === selectedGithubApp)?.name ||
    "Shared GitHub connection";

  function stepMeta(step: CreateSiteStep) {
    switch (step) {
      case "type":
        return { label: "Type", icon: <Boxes className="h-4 w-4" /> };
      case "details":
        return { label: "Name", icon: <Type className="h-4 w-4" /> };
      case "access":
        return { label: "Access", icon: <ShieldCheck className="h-4 w-4" /> };
      case "repository":
        return { label: "Repo", icon: <GitBranch className="h-4 w-4" /> };
      case "deploy-key":
        return { label: "Key", icon: <KeyRound className="h-4 w-4" /> };
      case "review":
        return { label: "Review", icon: <Rocket className="h-4 w-4" /> };
      default:
        return { label: "Step", icon: <Boxes className="h-4 w-4" /> };
    }
  }

  function validateStep(step: CreateSiteStep): string | null {
    if (step === "details" && !siteName.trim()) {
      return "Enter a site name before continuing.";
    }

    if (step === "access" && createType !== "wordpress") {
      if (repoAccessMode === "connected_account") {
        if (!githubConnection.configured) {
          return "GitHub sign-in is not available for this workspace yet.";
        }
        if (!githubConnection.connected) {
          return "Connect GitHub or choose another repository access method.";
        }
      }

      if (repoAccessMode === "github_app") {
        if (!canUsePrivateGithubApps) {
          return "Shared GitHub connections are available to administrators only.";
        }
        if (!selectedGithubApp) {
          return "Select a GitHub App connection before continuing.";
        }
      }
    }

    if (step === "repository" && createType !== "wordpress") {
      if (!repoInput.trim()) {
        return "Enter the GitHub repository before continuing.";
      }
    }

    if (step === "deploy-key" && createType !== "wordpress") {
      if (repoAccessMode === "deploy_key" && !deployKey?.uuid) {
        return "Generate the deploy key and add it to GitHub before continuing.";
      }
    }

    if (step === "review") {
      if (allocationPreview?.blockedReason) {
        return allocationPreview.blockedReason;
      }
      return (
        validateStep("details") ||
        validateStep("access") ||
        validateStep("repository") ||
        validateStep("deploy-key")
      );
    }

    return null;
  }

  function goToNextStep() {
    const validationError = validateStep(activeStep);
    if (validationError) {
      setStepNotice(validationError);
      return;
    }

    const nextStep = wizardSteps[activeStepIndex + 1];
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  }

  function goToPreviousStep() {
    const previousStep = wizardSteps[activeStepIndex - 1];
    if (previousStep) {
      setCurrentStep(previousStep);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (activeStep !== "review") {
      event.preventDefault();
      goToNextStep();
      return;
    }

    const validationError = validateStep("review");
    if (!validationError) return;

    event.preventDefault();
    setStepNotice(validationError);
    if (!siteName.trim()) {
      setCurrentStep("details");
      return;
    }
    if (createType !== "wordpress") {
      if (validateStep("access")) {
        setCurrentStep("access");
        return;
      }
      if (validateStep("repository")) {
        setCurrentStep("repository");
        return;
      }
      setCurrentStep("deploy-key");
    }
  }

  return (
    <AnimatePresenceShim>
      {open && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/45 p-3 backdrop-blur-md sm:p-4"
          onClick={onClose}
        >
        <MotionDiv
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative my-4 w-full max-w-3xl overflow-hidden border border-[var(--line)] bg-[var(--surface-shell)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-site-title"
        >
            <div className="border-b border-[var(--line)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2
                  id="create-site-title"
                  className="text-xl font-bold tracking-tight text-[var(--foreground)]"
                >
                  Create Site
                </h2>
                <p className="max-w-xl text-xs leading-5 text-[var(--text-muted)]">
                  Complete one step at a time without leaving the dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-9 items-center justify-center border border-[var(--line)] bg-[var(--surface-shell-raised)] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
                aria-label="Close site setup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="mt-5 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${wizardSteps.length}, minmax(0, 1fr))` }}
            >
              {wizardSteps.map((step, index) => {
                const isActive = step === activeStep;
                const isComplete = index < activeStepIndex;
                const meta = stepMeta(step);
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      if (index <= activeStepIndex) {
                        setCurrentStep(step);
                      }
                    }}
                    disabled={index > activeStepIndex}
                    className={cx(
                      "flex min-h-11 w-full items-center gap-2 border pl-5 pr-3 text-left text-xs transition-colors",
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : isComplete
                          ? "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--foreground)]"
                          : "border-[var(--line)] bg-[var(--surface-shell-raised)] text-[var(--text-muted)] opacity-70",
                    )}
                  >
                    <span
                      className={cx(
                        "flex shrink-0 items-center justify-center",
                        isActive || isComplete ? "text-[var(--foreground)]" : "text-[var(--text-muted)]",
                      )}
                    >
                      {meta.icon}
                    </span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            </div>

            {actionData?.ok === false && (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{actionData.error}</span>
              </div>
            )}

            <Form
              method="post"
              className="flex max-h-[calc(100vh-13rem)] flex-col"
              onSubmit={handleSubmit}
            >
              <input type="hidden" name="type" value={createType} />
              <input type="hidden" name="name" value={siteName} />
              {createType !== "wordpress" && (
                <>
                  <input
                    type="hidden"
                    name="repo_access"
                    value={repoAccessMode}
                  />
                  <input type="hidden" name="repo_url" value={repoInput} />
                  <input type="hidden" name="repo_branch" value={repoBranch} />
                  <input
                    type="hidden"
                    name="github_app_id"
                    value={selectedGithubApp}
                  />
                  <input
                    type="hidden"
                    name="private_key_uuid"
                    value={deployKey?.uuid ?? ""}
                  />
                </>
              )}

              <div className="aeon-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              {stepNotice && (
                <div className="flex items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{stepNotice}</span>
                </div>
              )}

              {activeStep === "type" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Site Type
                  </label>
                  <p className="ml-1 text-xs text-[var(--text-muted)]">
                    Pick the runtime that matches what you want to deploy.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {createOptions.map((option) => {
                    const active = createType === option.type;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => setCreateType(option.type)}
                        className={cx(
                          "border p-4 text-left transition-all",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line)] hover:bg-[var(--surface-muted)]",
                        )}
                      >
                        <div className="flex size-12 items-center justify-center border border-current/20 bg-[var(--surface)]">
                          <span className={cx(active ? "text-[var(--accent)]" : "text-[var(--text-soft)]")}>
                            {option.icon}
                          </span>
                        </div>
                        <div className="mt-5 space-y-1.5">
                          <div className="text-sm font-bold text-[var(--foreground)]">
                            {option.title}
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            {option.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {activeStep === "details" && (
                <div className="space-y-4">
              <label className="block space-y-2">
                <span className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Site Name
                </span>
                <input
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder={selectedTypeMeta.placeholder}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:ring-2 ring-white/10"
                />
              </label>

              {workspaceUsage ? (
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs leading-5 text-[var(--text-muted)]">
                  <div>
                    This workspace shares {formatCpu(workspaceUsage.limits.max_cpu_total)} CPU and{" "}
                    {formatMemoryMb(workspaceUsage.limits.max_memory_mb_total)} across{" "}
                    {workspaceUsage.limits.max_sites} site
                    {workspaceUsage.limits.max_sites === 1 ? "" : "s"}.
                  </div>
                  <div className="mt-2">
                    Currently using {formatCpu(workspaceUsage.usage.cpu_used)} CPU and{" "}
                    {formatMemoryMb(workspaceUsage.usage.memory_mb_used)} across{" "}
                    {workspaceUsage.usage.sites_used} site
                    {workspaceUsage.usage.sites_used === 1 ? "" : "s"}.
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs leading-5 text-[var(--text-muted)]">
                  Workspace limits apply before launch, including site count,
                  CPU, memory, and people access.
                </div>
              )}
                </div>
              )}

              {activeStep === "access" && createType !== "wordpress" && (
                <div className="space-y-4 border border-[var(--line)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-[var(--text-soft)]" />
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[var(--foreground)]">
                        Repository access
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Choose how ZephyrCloud will reach your repository.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Repository access
                    </div>
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
                              "border p-4 text-left transition-all",
                              active
                                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                                : option.disabled
                                  ? "cursor-not-allowed border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] opacity-60"
                                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line)] hover:bg-[var(--surface-muted)]",
                            )}
                          >
                            <div className="space-y-1.5">
                              <div className="text-sm font-bold text-[var(--foreground)]">
                                {option.title}
                              </div>
                              <p className="text-xs text-[var(--text-muted)]">
                                {option.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Connection method
                    </div>
                    {repoAccessMode === "github_app" &&
                    canUsePrivateGithubApps ? (
                      <>
                        <select
                          name="github_app_id"
                          value={selectedGithubApp}
                          onChange={(event) =>
                            setSelectedGithubApp(event.target.value)
                          }
                          className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none transition-all focus:ring-2 ring-white/10"
                        >
                          <option value="" className="bg-[var(--surface)] text-[var(--foreground)]">
                            No shared GitHub connection selected
                          </option>
                          {githubApps.map((app) => (
                            <option
                              key={app.uuid}
                              value={app.uuid}
                              className="bg-[var(--surface)] text-[var(--foreground)]"
                            >
                              {app.name}
                            </option>
                          ))}
                        </select>
                        {githubAppsState === "loading" && (
                          <p className="text-xs text-[var(--text-muted)]">
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
                      <div className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
                        Shared GitHub connections are available to administrators only.
                      </div>
                    ) : repoAccessMode === "connected_account" ? (
                      !githubConnection.configured ? (
                        <div className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-100">
                          GitHub sign-in is not available for this workspace yet.
                        </div>
                      ) : !githubConnection.connected ? (
                        <div className="flex flex-col gap-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-xs text-amber-100 md:flex-row md:items-center md:justify-between">
                          <div>
                            Connect GitHub once to choose from eligible private repositories.
                          </div>
                          <a
                            href="/api/github/oauth/start?returnTo=/sites?new=1"
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                          >
                            <Github className="h-4 w-4" />
                            Connect GitHub
                          </a>
                        </div>
                      ) : (
                        <div className="rounded-md border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2.5 text-xs text-[var(--success)]">
                          Connected as{" "}
                          <span className="font-semibold text-[var(--foreground)]">
                            @
                            {githubConnection.login ||
                              githubConnection.name ||
                              "github-user"}
                          </span>
                          . Private repositories are ready to use.
                        </div>
                      )
                    ) : repoAccessMode === "deploy_key" ? (
                      <div className="rounded-md border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2.5 text-xs text-[var(--success)]">
                        Use a repository deploy key if you prefer not to connect GitHub.
                      </div>
                    ) : (
                      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
                        Public repositories do not need any additional connection.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeStep === "repository" && createType !== "wordpress" && (
                <div className="space-y-4 border border-[var(--line)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-[var(--text-soft)]" />
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[var(--foreground)]">
                        Repository details
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Enter the repository and branch for this site.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Repository
                    </div>
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
                      className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:ring-2 ring-white/10"
                    />
                    <datalist id="node-repository-options">
                      {repoOptions.map((repo) => (
                        <option key={repo.full_name} value={repo.full_name}>
                          {repo.full_name}
                        </option>
                      ))}
                    </datalist>
                    {repoOptionsState === "loading" && (
                      <p className="text-xs text-[var(--text-muted)]">
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
                      <p className="text-xs text-[var(--text-muted)]">
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
                      <p className="text-xs text-[var(--text-muted)]">
                        GitHub URLs are normalized automatically when the key is generated.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Branch
                    </div>
                    <input
                      name="repo_branch"
                      list="node-branch-options"
                      value={repoBranch}
                      onChange={(event) => setRepoBranch(event.target.value)}
                      placeholder="main"
                      className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:ring-2 ring-white/10"
                    />
                    <datalist id="node-branch-options">
                      {branchOptions.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </datalist>
                    {branchOptionsState === "loading" && (
                      <p className="text-xs text-[var(--text-muted)]">
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
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedTypeMeta.repoHelp}
                    </p>
                  </div>
                </div>
              )}

              {activeStep === "deploy-key" &&
                createType !== "wordpress" &&
                repoAccessMode === "deploy_key" && (
                  <div className="space-y-4 border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold text-[var(--foreground)]">
                            Repository deploy key
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            Generate a read-only key, add it to GitHub, then create the site.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void generateDeployKey()}
                          disabled={deployKeyState === "loading"}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
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
                        <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                          {deployKeyError}
                        </div>
                      )}

                      {deployKey && (
                        <div className="space-y-3">
                          <div className="border border-[var(--success)] bg-[var(--success-soft)] px-4 py-3 text-xs text-[var(--success)]">
                            <div className="flex items-center gap-2">
                              <KeyRound className="h-4 w-4" />
                              Add this public key to the repository as a read-only deploy key.
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <GitBranch className="h-4 w-4" />
                              Confirm the correct branch is selected.
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Rocket className="h-4 w-4" />
                              Create the site once GitHub accepts the key.
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Public key
                            </label>
                            <textarea
                              readOnly
                              value={deployKey.public_key}
                              rows={4}
                              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--text-muted)] outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void copyDeployKey()}
                              className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                            >
                              <Copy className="h-4 w-4" />
                              {deployKeyCopied ? "Copied" : "Copy key"}
                            </button>
                            {repoSettingsUrl && (
                              <a
                                href={repoSettingsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open GitHub settings
                              </a>
                            )}
                          </div>

                          {deployKey.fingerprint && (
                            <p className="text-xs text-[var(--text-muted)]">
                              Fingerprint:{" "}
                              <span className="font-mono text-[var(--text-muted)]">
                                {deployKey.fingerprint}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                )}

              {activeStep === "review" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="ml-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Review
                    </div>
                    <p className="ml-1 text-xs text-[var(--text-muted)]">
                      Confirm the setup before the site is created.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Site type
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                        {selectedTypeMeta.title}
                      </div>
                    </div>
                    <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Site name
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                        {siteName.trim() || "Not set"}
                      </div>
                    </div>
                  </div>

                  {createType === "wordpress" ? (
                    <div className="space-y-3 border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-3">
                        <PlatformLogo type="wordpress" className="h-6 w-6" />
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-[var(--foreground)]">
                            Managed WordPress
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            Your website and database will be prepared automatically.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-3">
                        <Github className="h-5 w-5 text-[var(--text-soft)]" />
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-[var(--foreground)]">
                            Repository source
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            {selectedAccessOption?.title || "Repository access"}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <div className="uppercase tracking-[0.18em] text-[var(--text-soft)]">
                            Repository
                          </div>
                          <div className="mt-1 break-words font-semibold text-[var(--foreground)]">
                            {repoInput.trim() || "Not set"}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.18em] text-[var(--text-soft)]">
                            Branch
                          </div>
                          <div className="mt-1 font-semibold text-[var(--foreground)]">
                            {repoBranch.trim() || "main"}
                          </div>
                        </div>
                        {repoAccessMode === "github_app" ? (
                          <div>
                            <div className="uppercase tracking-[0.18em] text-[var(--text-soft)]">
                              GitHub App
                            </div>
                            <div className="mt-1 font-semibold text-[var(--foreground)]">
                              {selectedGithubApp ? selectedGithubAppName : "Not selected"}
                            </div>
                          </div>
                        ) : null}
                        {repoAccessMode === "connected_account" ? (
                          <div>
                            <div className="uppercase tracking-[0.18em] text-[var(--text-soft)]">
                              GitHub account
                            </div>
                            <div className="mt-1 font-semibold text-[var(--foreground)]">
                              {githubConnection.connected
                                ? `@${githubConnection.login || githubConnection.name || "github-user"}`
                                : "Not connected"}
                            </div>
                          </div>
                        ) : null}
                        {repoAccessMode === "deploy_key" ? (
                          <div>
                            <div className="uppercase tracking-[0.18em] text-[var(--text-soft)]">
                              Deploy key
                            </div>
                            <div className="mt-1 font-semibold text-[var(--foreground)]">
                              {deployKey?.fingerprint || deployKey?.uuid || "Not generated"}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {workspaceUsage ? (
                    <div className="space-y-3 border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-[var(--foreground)]">
                            Post-create rebalance
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Every site shares the workspace pool. These allocations apply right after creation.
                          </p>
                        </div>
                        <span className="inline-flex items-center border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                          {workspaceUsage.usage.sites_used + 1} of {workspaceUsage.limits.max_sites} sites
                        </span>
                      </div>

                      {allocationPreview?.blockedReason ? (
                        <div className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-100">
                          {allocationPreview.blockedReason}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {allocationPreview?.sites.map((site) => (
                            <div
                              key={site.id}
                              className={cx(
                                "flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-xs",
                                site.isNew
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                                  : "border-[var(--line)] bg-[var(--surface-muted)]",
                              )}
                            >
                              <div className="font-medium text-[var(--foreground)]">
                                {site.name}
                                {site.isNew ? " (new)" : ""}
                              </div>
                              <div className="flex flex-wrap gap-2 text-[var(--text-muted)]">
                                <span>CPU {formatCpu(site.cpu_limit)}</span>
                                <span>RAM {formatMemoryMb(site.memory_mb)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  disabled={activeStepIndex === 0 || isSubmitting}
                  className="inline-flex min-h-10 items-center justify-center border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>

                {activeStep === "review" ? (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-10 items-center justify-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-foreground)] transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-30"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Rocket className="h-5 w-5" />
                    )}
                    {selectedTypeMeta.submitLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    disabled={isSubmitting}
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--foreground)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)] disabled:pointer-events-none disabled:opacity-30"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </Form>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresenceShim>
  );
}

function UsageMetricCard({
  label,
  used,
  remaining,
  total,
  percentage,
}: {
  label: string;
  used: string;
  remaining: string;
  total: string;
  percentage: number;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface-muted)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {label}
        </span>
        <span className="text-[11px] font-medium text-[var(--text-muted)]">
          {formatPercent(percentage)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden bg-[var(--surface)]">
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: formatPercent(percentage) }}
        />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--foreground)]">{used}</div>
          <div className="text-[11px] text-[var(--text-muted)]">used</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium text-[var(--text-muted)]">{remaining}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{total}</div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeSiteStatus(status);
  const cfg =
    (
      {
        RUNNING: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
        STOPPED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
        ERROR: "bg-red-500/10 text-red-100 border-red-500/20",
        BUILDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        PROVISIONING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        UNKNOWN: "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--line)]",
      } as const
    )[normalized];
  const label = (normalized === "UNKNOWN" ? status || "Unknown" : normalized)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <span
      className={cx(
        "flex items-center gap-1.5 rounded-none border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
        cfg,
      )}
    >
      {(normalized === "BUILDING" || normalized === "PROVISIONING") && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {label}
    </span>
  );
}
