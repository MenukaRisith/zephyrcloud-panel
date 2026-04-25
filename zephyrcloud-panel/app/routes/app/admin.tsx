import * as React from "react";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";

import {
  Tabs,
  TabsContent,
} from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { inputClass } from "~/lib/ui";
import { apiFetchAuthed } from "~/services/api.authed.server";
import { requireUser } from "~/services/session.server";

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

function MotionSection({
  animate,
  exit,
  initial,
  transition,
  whileHover,
  whileTap,
  ...props
}: MotionLikeProps<HTMLElement>) {
  return <section {...props} />;
}

type PanelEnv = {
  key: string;
  value: string;
  is_buildtime: boolean;
  is_literal: boolean;
  is_multiline: boolean;
  is_shown_once: boolean;
  has_preview: boolean;
  variant_count: number;
};

type PanelApp = {
  target: "backend" | "frontend";
  label: string;
  uuid: string;
  name: string;
  status?: string;
  fqdn?: string;
  base_directory?: string;
  envs: PanelEnv[];
};

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  is_active: boolean;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_package_id: string | null;
  tenant_package_name: string | null;
  tenant_package_kind: PackageKind | null;
  site_memberships: number;
  last_login_at: string | null;
  created_at: string;
};

type PlanKey =
  | "FREE"
  | "PRO"
  | "DRIFT_START"
  | "DRIFT_CORE"
  | "DRIFT_PLUS"
  | "DRIFT_GLOBAL";

type PackageKind = "WEB" | "N8N";
type N8nVariant = "SIMPLE" | "POSTGRES" | "QUEUE";

type PlanCatalogItem = {
  key: PlanKey;
  label: string;
  description: string;
  resources: {
    max_sites: number;
    max_cpu_total: number;
    max_memory_mb_total: number;
    max_team_members_per_site: number;
  };
};

type AdminPackage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: PackageKind;
  is_active: boolean;
  n8n_variant: N8nVariant | null;
  legacy_plan: PlanKey | null;
  resources: {
    max_sites: number | null;
    max_services: number | null;
    max_cpu_total: number | null;
    max_memory_mb_total: number | null;
    max_storage_gb_total: number | null;
    max_team_members_per_site: number | null;
  };
  variant_details: {
    label: string;
    description: string;
  } | null;
  usage: {
    tenants: number;
    managed_services: number;
  };
  created_at: string;
  updated_at: string;
};

type N8nVariantDetail = {
  key: N8nVariant;
  label: string;
  description: string;
};

type AdminTenant = {
  id: string;
  name: string;
  slug: string;
  plan: PlanKey;
  package_id: string | null;
  package_name: string | null;
  package_kind: PackageKind | null;
  package_is_active: boolean | null;
  n8n_variant: N8nVariant | null;
  is_active: boolean;
  suspended_at: string | null;
  usage: {
    users: number;
    sites: number;
    services: number;
    assigned_sites: number;
    unassigned_sites: number;
  };
  resources: {
    overrides: {
      max_sites: number | null;
      max_cpu_total: number | null;
      max_memory_mb_total: number | null;
      max_team_members_per_site: number | null;
    };
    effective: {
      max_sites: number;
      max_cpu_total: number;
      max_memory_mb_total: number;
      max_team_members_per_site: number;
    };
  };
};

type AdminSite = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "php" | "static" | "python";
  status: string;
  tenant_id: string;
  tenant_name: string;
  tenant_plan: PlanKey;
  tenant_package_id: string | null;
  tenant_package_name: string | null;
  tenant_package_kind: PackageKind | null;
  primary_domain: string | null;
  repo_url: string | null;
  repo_branch: string | null;
  auto_deploy: boolean;
  cpu_limit: number;
  memory_mb: number;
  member_count: number;
  is_unassigned: boolean;
  assigned_users: Array<{
    id: string;
    email: string;
    name: string;
    role: "viewer" | "editor";
  }>;
  created_at: string;
  updated_at: string;
};

type AdminManagedService = {
  id: string;
  name: string;
  type: string;
  status: string;
  tenant_id: string;
  tenant_name: string;
  tenant_package_id: string | null;
  tenant_package_name: string | null;
  n8n_variant: N8nVariant;
  primary_domain: string | null;
  cpu_limit: number;
  memory_mb: number;
  storage_gb: number;
  coolify_service_id: string | null;
  created_at: string;
  updated_at: string;
};

type CoolifySiteCandidate = {
  uuid: string;
  name: string;
  status?: string;
  fqdn?: string;
  base_directory?: string;
};

type LoaderData = {
  panelApps: PanelApp[];
  users: AdminUser[];
  tenants: AdminTenant[];
  sites: AdminSite[];
  services: AdminManagedService[];
  coolifySites: CoolifySiteCandidate[];
  packages: AdminPackage[];
  n8nVariants: N8nVariantDetail[];
  planCatalog: PlanCatalogItem[];
  adminEmails: string[];
  stats: {
    total_users: number;
    active_users: number;
    admin_users: number;
    total_tenants: number;
    active_tenants: number;
    total_sites: number;
    unassigned_sites: number;
    total_services: number;
  };
  coolifyHealth: {
    ok: boolean;
    tried: string[];
    error?: string;
  } | null;
  errors: string[];
};

type ActionData = { ok: true; message: string } | { ok: false; error: string };
type AdminTab = "users" | "packages" | "sites" | "services" | "platform";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function safeJson(response: Response) {
  return response.json().catch(() => null);
}

function messageFrom(payload: unknown, fallback: string) {
  if (isRecord(payload)) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (Array.isArray(payload.message)) {
      const first = payload.message.find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      );
      if (first) return first;
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }
  return fallback;
}

function boolField(formData: FormData, name: string) {
  if (!formData.has(`${name}_present`)) return undefined;
  return formData.get(name) === "on";
}

function optionalStringField(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return value.length > 0 ? value : undefined;
}

function optionalNumberField(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nullableNumberField(formData: FormData, name: string) {
  const raw = formData.get(name);
  if (raw === null) return undefined;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function readNumberWithFallback(
  record: Record<string, unknown>,
  primaryKey: string,
  fallbackKey?: string,
): number | null {
  const primary = record[primaryKey];
  if (typeof primary === "number") return primary;
  if (!fallbackKey) return null;
  const fallback = record[fallbackKey];
  return typeof fallback === "number" ? fallback : null;
}

function statusTone(status?: string) {
  if (!status) return "border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]";
  const normalized = status.toLowerCase();
  if (
    normalized.includes("healthy") ||
    normalized.includes("running") ||
    normalized === "up"
  ) {
    return "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]";
  }
  if (normalized.includes("error") || normalized.includes("failed")) {
    return "border-red-400/20 bg-red-400/10 text-red-100";
  }
  return "border-amber-400/20 bg-amber-400/10 text-amber-100";
}

function normalizePackageKind(value: unknown): PackageKind | null {
  if (value === "WEB" || value === "N8N") return value;
  return null;
}

function normalizeN8nVariant(value: unknown): N8nVariant | null {
  if (value === "SIMPLE" || value === "POSTGRES" || value === "QUEUE") {
    return value;
  }
  return null;
}

function parsePanelApps(panelAppsPayload: unknown): PanelApp[] {
  const panelApps = Array.isArray(panelAppsPayload)
    ? panelAppsPayload.filter(isRecord).map((app) => ({
        target: (app.target === "backend" ? "backend" : "frontend") as
          | "backend"
          | "frontend",
        label:
          typeof app.label === "string" && app.label.trim()
            ? app.label
            : app.target === "backend"
              ? "Backend API"
              : "Frontend Panel",
        uuid: typeof app.uuid === "string" ? app.uuid : "",
        name: typeof app.name === "string" ? app.name : "",
        status: typeof app.status === "string" ? app.status : undefined,
        fqdn: typeof app.fqdn === "string" ? app.fqdn : undefined,
        base_directory:
          typeof app.base_directory === "string"
            ? app.base_directory
            : undefined,
        envs: Array.isArray(app.envs)
          ? app.envs.filter(isRecord).map((env) => ({
              key: typeof env.key === "string" ? env.key : "",
              value: typeof env.value === "string" ? env.value : "",
              is_buildtime: Boolean(env.is_buildtime),
              is_literal: env.is_literal !== false,
              is_multiline: Boolean(env.is_multiline),
              is_shown_once: Boolean(env.is_shown_once),
              has_preview: Boolean(env.has_preview),
              variant_count:
                typeof env.variant_count === "number" ? env.variant_count : 1,
            }))
          : [],
      }))
    : [];

  return panelApps.filter((app) => app.uuid.length > 0);
}

function parseUsers(
  usersPayload: unknown,
): Pick<LoaderData, "users" | "adminEmails" | "stats"> {
  const statsRecord =
    isRecord(usersPayload) && isRecord(usersPayload.stats)
      ? usersPayload.stats
      : {};
  const users =
    isRecord(usersPayload) && Array.isArray(usersPayload.users)
      ? usersPayload.users.filter(isRecord).map((user) => ({
          id: typeof user.id === "string" ? user.id : "",
          email: typeof user.email === "string" ? user.email : "",
          name: typeof user.name === "string" ? user.name : "",
          role: (user.role === "admin" ? "admin" : "user") as "admin" | "user",
          is_active: Boolean(user.is_active),
          tenant_id: typeof user.tenant_id === "string" ? user.tenant_id : null,
          tenant_name:
            typeof user.tenant_name === "string" ? user.tenant_name : null,
          tenant_slug:
            typeof user.tenant_slug === "string" ? user.tenant_slug : null,
          tenant_package_id:
            typeof user.tenant_package_id === "string"
              ? user.tenant_package_id
              : null,
          tenant_package_name:
            typeof user.tenant_package_name === "string"
              ? user.tenant_package_name
              : null,
          tenant_package_kind:
            normalizePackageKind(user.tenant_package_kind),
          site_memberships:
            typeof user.site_memberships === "number"
              ? user.site_memberships
              : 0,
          last_login_at:
            typeof user.last_login_at === "string" ? user.last_login_at : null,
          created_at:
            typeof user.created_at === "string"
              ? user.created_at
              : new Date(0).toISOString(),
        }))
      : [];

  const adminEmails =
    isRecord(usersPayload) && Array.isArray(usersPayload.admin_emails)
      ? usersPayload.admin_emails.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];

  return {
    users: users.filter((user) => user.id.length > 0),
    adminEmails,
    stats: {
      total_users:
        typeof statsRecord.total_users === "number"
          ? statsRecord.total_users
          : 0,
      active_users:
        typeof statsRecord.active_users === "number"
          ? statsRecord.active_users
          : 0,
      admin_users:
        typeof statsRecord.admin_users === "number"
          ? statsRecord.admin_users
          : 0,
      total_tenants: 0,
      active_tenants: 0,
      total_sites: 0,
      unassigned_sites: 0,
      total_services: 0,
    },
  };
}

function parseTenants(
  tenantsPayload: unknown,
): Pick<LoaderData, "tenants" | "planCatalog" | "stats"> {
  const statsRecord =
    isRecord(tenantsPayload) && isRecord(tenantsPayload.stats)
      ? tenantsPayload.stats
      : {};

  const planCatalog =
    isRecord(tenantsPayload) && Array.isArray(tenantsPayload.plan_catalog)
      ? (tenantsPayload.plan_catalog.filter(isRecord).map((plan) => ({
          key: typeof plan.key === "string" ? plan.key : "FREE",
          label: typeof plan.label === "string" ? plan.label : "Free",
          description:
            typeof plan.description === "string" ? plan.description : "",
          resources: isRecord(plan.resources)
            ? {
                max_sites:
                  typeof plan.resources.max_sites === "number"
                    ? plan.resources.max_sites
                    : 0,
                max_cpu_total:
                  readNumberWithFallback(
                    plan.resources,
                    "max_cpu_total",
                    "max_cpu_per_site",
                  ) ?? 0,
                max_memory_mb_total:
                  readNumberWithFallback(
                    plan.resources,
                    "max_memory_mb_total",
                    "max_memory_mb_per_site",
                  ) ?? 0,
                max_team_members_per_site:
                  typeof plan.resources.max_team_members_per_site === "number"
                    ? plan.resources.max_team_members_per_site
                    : 0,
              }
            : {
                max_sites: 0,
                max_cpu_total: 0,
                max_memory_mb_total: 0,
                max_team_members_per_site: 0,
              },
        })) as PlanCatalogItem[])
      : [];

  const tenants =
    isRecord(tenantsPayload) && Array.isArray(tenantsPayload.tenants)
      ? (tenantsPayload.tenants.filter(isRecord).map((tenant) => ({
          id: typeof tenant.id === "string" ? tenant.id : "",
          name: typeof tenant.name === "string" ? tenant.name : "",
          slug: typeof tenant.slug === "string" ? tenant.slug : "",
          plan: typeof tenant.plan === "string" ? tenant.plan : "FREE",
          package_id:
            typeof tenant.package_id === "string" ? tenant.package_id : null,
          package_name:
            typeof tenant.package_name === "string"
              ? tenant.package_name
              : null,
          package_kind:
            normalizePackageKind(tenant.package_kind),
          package_is_active:
            typeof tenant.package_is_active === "boolean"
              ? tenant.package_is_active
              : null,
          n8n_variant:
            normalizeN8nVariant(tenant.n8n_variant),
          is_active: Boolean(tenant.is_active),
          suspended_at:
            typeof tenant.suspended_at === "string"
              ? tenant.suspended_at
              : null,
          usage: isRecord(tenant.usage)
            ? {
                users:
                  typeof tenant.usage.users === "number"
                    ? tenant.usage.users
                    : 0,
                sites:
                  typeof tenant.usage.sites === "number"
                    ? tenant.usage.sites
                    : 0,
                services:
                  typeof tenant.usage.services === "number"
                    ? tenant.usage.services
                    : 0,
                assigned_sites:
                  typeof tenant.usage.assigned_sites === "number"
                    ? tenant.usage.assigned_sites
                    : 0,
                unassigned_sites:
                  typeof tenant.usage.unassigned_sites === "number"
                    ? tenant.usage.unassigned_sites
                    : 0,
              }
            : {
                users: 0,
                sites: 0,
                services: 0,
                assigned_sites: 0,
                unassigned_sites: 0,
              },
          resources: isRecord(tenant.resources)
            ? {
                overrides: isRecord(tenant.resources.overrides)
                  ? {
                      max_sites:
                        typeof tenant.resources.overrides.max_sites === "number"
                          ? tenant.resources.overrides.max_sites
                          : null,
                      max_cpu_total:
                        readNumberWithFallback(
                          tenant.resources.overrides,
                          "max_cpu_total",
                          "max_cpu_per_site",
                        ),
                      max_memory_mb_total:
                        readNumberWithFallback(
                          tenant.resources.overrides,
                          "max_memory_mb_total",
                          "max_memory_mb_per_site",
                        ),
                      max_team_members_per_site:
                        typeof tenant.resources.overrides
                          .max_team_members_per_site === "number"
                          ? tenant.resources.overrides.max_team_members_per_site
                          : null,
                    }
                  : {
                      max_sites: null,
                      max_cpu_total: null,
                      max_memory_mb_total: null,
                      max_team_members_per_site: null,
                    },
                effective: isRecord(tenant.resources.effective)
                  ? {
                      max_sites:
                        typeof tenant.resources.effective.max_sites === "number"
                          ? tenant.resources.effective.max_sites
                          : 0,
                      max_cpu_total:
                        readNumberWithFallback(
                          tenant.resources.effective,
                          "max_cpu_total",
                          "max_cpu_per_site",
                        ) ?? 0,
                      max_memory_mb_total:
                        readNumberWithFallback(
                          tenant.resources.effective,
                          "max_memory_mb_total",
                          "max_memory_mb_per_site",
                        ) ?? 0,
                      max_team_members_per_site:
                        typeof tenant.resources.effective
                          .max_team_members_per_site === "number"
                          ? tenant.resources.effective.max_team_members_per_site
                          : 0,
                    }
                  : {
                      max_sites: 0,
                      max_cpu_total: 0,
                      max_memory_mb_total: 0,
                      max_team_members_per_site: 0,
                    },
              }
            : {
                overrides: {
                  max_sites: null,
                  max_cpu_total: null,
                  max_memory_mb_total: null,
                  max_team_members_per_site: null,
                },
                effective: {
                  max_sites: 0,
                  max_cpu_total: 0,
                  max_memory_mb_total: 0,
                  max_team_members_per_site: 0,
                },
              },
        })) as AdminTenant[])
      : [];

  return {
    tenants: tenants.filter((tenant) => tenant.id.length > 0),
    planCatalog,
    stats: {
      total_users: 0,
      active_users: 0,
      admin_users: 0,
      total_tenants:
        typeof statsRecord.total_tenants === "number"
          ? statsRecord.total_tenants
          : 0,
      active_tenants:
        typeof statsRecord.active_tenants === "number"
          ? statsRecord.active_tenants
          : 0,
      total_sites: 0,
      unassigned_sites: 0,
      total_services: 0,
    },
  };
}

function parseSites(
  sitesPayload: unknown,
): Pick<LoaderData, "sites" | "stats"> {
  const statsRecord =
    isRecord(sitesPayload) && isRecord(sitesPayload.stats)
      ? sitesPayload.stats
      : {};

  const sites =
    isRecord(sitesPayload) && Array.isArray(sitesPayload.sites)
      ? (sitesPayload.sites.filter(isRecord).map((site) => ({
          id: typeof site.id === "string" ? site.id : "",
          name: typeof site.name === "string" ? site.name : "",
          type:
            site.type === "wordpress" ||
            site.type === "php" ||
            site.type === "static" ||
            site.type === "python"
              ? site.type
              : "node",
          status: typeof site.status === "string" ? site.status : "UNKNOWN",
          tenant_id: typeof site.tenant_id === "string" ? site.tenant_id : "",
          tenant_name:
            typeof site.tenant_name === "string" ? site.tenant_name : "",
          tenant_plan:
            typeof site.tenant_plan === "string" ? site.tenant_plan : "FREE",
          tenant_package_id:
            typeof site.tenant_package_id === "string"
              ? site.tenant_package_id
              : null,
          tenant_package_name:
            typeof site.tenant_package_name === "string"
              ? site.tenant_package_name
              : null,
          tenant_package_kind:
            normalizePackageKind(site.tenant_package_kind),
          primary_domain:
            typeof site.primary_domain === "string"
              ? site.primary_domain
              : null,
          repo_url: typeof site.repo_url === "string" ? site.repo_url : null,
          repo_branch:
            typeof site.repo_branch === "string" ? site.repo_branch : null,
          auto_deploy: Boolean(site.auto_deploy),
          cpu_limit: typeof site.cpu_limit === "number" ? site.cpu_limit : 0,
          memory_mb: typeof site.memory_mb === "number" ? site.memory_mb : 0,
          member_count:
            typeof site.member_count === "number" ? site.member_count : 0,
          is_unassigned: Boolean(site.is_unassigned),
          assigned_users: Array.isArray(site.assigned_users)
            ? site.assigned_users.filter(isRecord).map((assigned) => ({
                id: typeof assigned.id === "string" ? assigned.id : "",
                email: typeof assigned.email === "string" ? assigned.email : "",
                name: typeof assigned.name === "string" ? assigned.name : "",
                role: assigned.role === "viewer" ? "viewer" : "editor",
              }))
            : [],
          created_at:
            typeof site.created_at === "string"
              ? site.created_at
              : new Date(0).toISOString(),
          updated_at:
            typeof site.updated_at === "string"
              ? site.updated_at
              : new Date(0).toISOString(),
        })) as AdminSite[])
      : [];

  return {
    sites: sites.filter((site) => site.id.length > 0),
    stats: {
      total_users: 0,
      active_users: 0,
      admin_users: 0,
      total_tenants: 0,
      active_tenants: 0,
      total_sites:
        typeof statsRecord.total_sites === "number"
          ? statsRecord.total_sites
          : 0,
      unassigned_sites:
        typeof statsRecord.unassigned_sites === "number"
          ? statsRecord.unassigned_sites
          : 0,
      total_services: 0,
    },
  };
}

function parsePackages(packagesPayload: unknown): {
  packages: AdminPackage[];
  n8nVariants: N8nVariantDetail[];
} {
  const packages =
    isRecord(packagesPayload) && Array.isArray(packagesPayload.packages)
      ? packagesPayload.packages.filter(isRecord).map((pkg) => {
          const resources = isRecord(pkg.resources) ? pkg.resources : {};
          const variantDetails = isRecord(pkg.variant_details)
            ? pkg.variant_details
            : null;
          const usage = isRecord(pkg.usage) ? pkg.usage : {};
          return {
            id: typeof pkg.id === "string" ? pkg.id : "",
            name: typeof pkg.name === "string" ? pkg.name : "",
            slug: typeof pkg.slug === "string" ? pkg.slug : "",
            description:
              typeof pkg.description === "string" ? pkg.description : null,
            kind: pkg.kind === "N8N" ? "N8N" : "WEB",
            is_active: Boolean(pkg.is_active),
            n8n_variant:
              normalizeN8nVariant(pkg.n8n_variant),
            legacy_plan:
              typeof pkg.legacy_plan === "string"
                ? (pkg.legacy_plan as PlanKey)
                : null,
            resources: {
              max_sites:
                typeof resources.max_sites === "number"
                  ? resources.max_sites
                  : null,
              max_services:
                typeof resources.max_services === "number"
                  ? resources.max_services
                  : null,
              max_cpu_total:
                typeof resources.max_cpu_total === "number"
                  ? resources.max_cpu_total
                  : null,
              max_memory_mb_total:
                typeof resources.max_memory_mb_total === "number"
                  ? resources.max_memory_mb_total
                  : null,
              max_storage_gb_total:
                typeof resources.max_storage_gb_total === "number"
                  ? resources.max_storage_gb_total
                  : null,
              max_team_members_per_site:
                typeof resources.max_team_members_per_site === "number"
                  ? resources.max_team_members_per_site
                  : null,
            },
            variant_details: variantDetails
              ? {
                  label:
                    typeof variantDetails.label === "string"
                      ? variantDetails.label
                      : "",
                  description:
                    typeof variantDetails.description === "string"
                      ? variantDetails.description
                      : "",
                }
              : null,
            usage: {
              tenants:
                typeof usage.tenants === "number" ? usage.tenants : 0,
              managed_services:
                typeof usage.managed_services === "number"
                  ? usage.managed_services
                  : 0,
            },
            created_at:
              typeof pkg.created_at === "string"
                ? pkg.created_at
                : new Date(0).toISOString(),
            updated_at:
              typeof pkg.updated_at === "string"
                ? pkg.updated_at
                : new Date(0).toISOString(),
          } satisfies AdminPackage;
        })
      : [];

  const n8nVariants =
    isRecord(packagesPayload) && Array.isArray(packagesPayload.n8n_variants)
      ? packagesPayload.n8n_variants.filter(isRecord).map((variant) => ({
          key:
            normalizeN8nVariant(variant.key) ?? "SIMPLE",
          label: typeof variant.label === "string" ? variant.label : "",
          description:
            typeof variant.description === "string"
              ? variant.description
              : "",
        }))
      : [
          {
            key: "SIMPLE" as const,
            label: "Simple",
            description:
              "One n8n container with persistent /home/node/.n8n storage.",
          },
          {
            key: "POSTGRES" as const,
            label: "With Postgres",
            description: "n8n plus PostgreSQL.",
          },
          {
            key: "QUEUE" as const,
            label: "Queue mode",
            description: "n8n plus PostgreSQL, Redis, and a worker.",
          },
        ];

  return {
    packages: packages.filter((pkg) => pkg.id.length > 0),
    n8nVariants,
  };
}

function parseServices(servicesPayload: unknown): {
  services: AdminManagedService[];
  totalServices: number;
} {
  const statsRecord =
    isRecord(servicesPayload) && isRecord(servicesPayload.stats)
      ? servicesPayload.stats
      : {};
  const services =
    isRecord(servicesPayload) && Array.isArray(servicesPayload.services)
      ? servicesPayload.services.filter(isRecord).map((service) => ({
          id: typeof service.id === "string" ? service.id : "",
          name: typeof service.name === "string" ? service.name : "",
          type: typeof service.type === "string" ? service.type : "n8n",
          status:
            typeof service.status === "string" ? service.status : "UNKNOWN",
          tenant_id:
            typeof service.tenant_id === "string" ? service.tenant_id : "",
          tenant_name:
            typeof service.tenant_name === "string" ? service.tenant_name : "",
          tenant_package_id:
            typeof service.tenant_package_id === "string"
              ? service.tenant_package_id
              : null,
          tenant_package_name:
            typeof service.tenant_package_name === "string"
              ? service.tenant_package_name
              : null,
          n8n_variant:
            normalizeN8nVariant(service.n8n_variant) ?? "SIMPLE",
          primary_domain:
            typeof service.primary_domain === "string"
              ? service.primary_domain
              : null,
          cpu_limit:
            typeof service.cpu_limit === "number" ? service.cpu_limit : 0,
          memory_mb:
            typeof service.memory_mb === "number" ? service.memory_mb : 0,
          storage_gb:
            typeof service.storage_gb === "number" ? service.storage_gb : 0,
          coolify_service_id:
            typeof service.coolify_service_id === "string"
              ? service.coolify_service_id
              : null,
          created_at:
            typeof service.created_at === "string"
              ? service.created_at
              : new Date(0).toISOString(),
          updated_at:
            typeof service.updated_at === "string"
              ? service.updated_at
              : new Date(0).toISOString(),
        }))
      : [];

  return {
    services: services.filter((service) => service.id.length > 0),
    totalServices:
      typeof statsRecord.total_services === "number"
        ? statsRecord.total_services
        : services.length,
  };
}

function parseCoolifySites(
  coolifySitesPayload: unknown,
): CoolifySiteCandidate[] {
  if (
    !isRecord(coolifySitesPayload) ||
    !Array.isArray(coolifySitesPayload.coolify_sites)
  ) {
    return [];
  }

  return coolifySitesPayload.coolify_sites
    .filter(isRecord)
    .map((site) => ({
      uuid: typeof site.uuid === "string" ? site.uuid : "",
      name: typeof site.name === "string" ? site.name : "",
      status: typeof site.status === "string" ? site.status : undefined,
      fqdn: typeof site.fqdn === "string" ? site.fqdn : undefined,
      base_directory:
        typeof site.base_directory === "string"
          ? site.base_directory
          : undefined,
    }))
    .filter((site) => site.uuid.length > 0);
}

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData | Response> {
  const { user } = await requireUser(request);
  if (user.role !== "admin") return redirect("/");

  const errors: string[] = [];
  const [
    appsRes,
    usersRes,
    tenantsRes,
    packagesRes,
    sitesRes,
    servicesRes,
    coolifySitesRes,
    healthRes,
  ] = await Promise.all([
    apiFetchAuthed(request, "/api/admin/panel-apps"),
    apiFetchAuthed(request, "/api/admin/users"),
    apiFetchAuthed(request, "/api/admin/tenants"),
    apiFetchAuthed(request, "/api/admin/packages"),
    apiFetchAuthed(request, "/api/admin/sites"),
    apiFetchAuthed(request, "/api/admin/services"),
    apiFetchAuthed(request, "/api/admin/coolify-sites"),
    apiFetchAuthed(request, "/api/admin/coolify/health"),
  ]);

  const appsPayload = await safeJson(appsRes);
  const usersPayload = await safeJson(usersRes);
  const tenantsPayload = await safeJson(tenantsRes);
  const packagesPayload = await safeJson(packagesRes);
  const sitesPayload = await safeJson(sitesRes);
  const servicesPayload = await safeJson(servicesRes);
  const coolifySitesPayload = await safeJson(coolifySitesRes);
  const healthPayload = await safeJson(healthRes);

  if (!appsRes.ok) {
    errors.push(messageFrom(appsPayload, "Could not load panel app data."));
  }
  if (!usersRes.ok) {
    errors.push(messageFrom(usersPayload, "Could not load users."));
  }
  if (!tenantsRes.ok) {
    errors.push(messageFrom(tenantsPayload, "Could not load tenants."));
  }
  if (!packagesRes.ok) {
    errors.push(messageFrom(packagesPayload, "Could not load packages."));
  }
  if (!sitesRes.ok) {
    errors.push(messageFrom(sitesPayload, "Could not load sites."));
  }
  if (!servicesRes.ok) {
    errors.push(messageFrom(servicesPayload, "Could not load services."));
  }
  if (!coolifySitesRes.ok) {
    errors.push(
      messageFrom(coolifySitesPayload, "Could not load Coolify sites."),
    );
  }
  if (!healthRes.ok) {
    errors.push(messageFrom(healthPayload, "Could not load Coolify health."));
  }

  const usersData = parseUsers(usersPayload);
  const tenantsData = parseTenants(tenantsPayload);
  const packagesData = parsePackages(packagesPayload);
  const sitesData = parseSites(sitesPayload);
  const servicesData = parseServices(servicesPayload);

  return {
    panelApps: parsePanelApps(appsPayload),
    users: usersData.users,
    tenants: tenantsData.tenants,
    sites: sitesData.sites,
    services: servicesData.services,
    coolifySites: parseCoolifySites(coolifySitesPayload),
    packages: packagesData.packages,
    n8nVariants: packagesData.n8nVariants,
    planCatalog: tenantsData.planCatalog,
    adminEmails: usersData.adminEmails,
    stats: {
      ...usersData.stats,
      total_tenants: tenantsData.stats.total_tenants,
      active_tenants: tenantsData.stats.active_tenants,
      total_sites: sitesData.stats.total_sites,
      unassigned_sites: sitesData.stats.unassigned_sites,
      total_services: servicesData.totalServices,
    },
    coolifyHealth:
      isRecord(healthPayload) &&
      typeof healthPayload.ok === "boolean" &&
      Array.isArray(healthPayload.tried)
        ? {
            ok: healthPayload.ok,
            tried: healthPayload.tried.filter(
              (value): value is string => typeof value === "string",
            ),
            error:
              typeof healthPayload.error === "string"
                ? healthPayload.error
                : undefined,
          }
        : null,
    errors,
  };
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<ActionData | Response> {
  const { user } = await requireUser(request);
  if (user.role !== "admin") return redirect("/");

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "upsert-env") {
    const target = String(formData.get("target") || "");
    const key = String(formData.get("key") || "").trim();
    const value = String(formData.get("value") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/panel-apps/${encodeURIComponent(target)}/envs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          value,
          is_buildtime: boolField(formData, "is_buildtime"),
          is_literal: boolField(formData, "is_literal"),
          is_multiline: boolField(formData, "is_multiline"),
          is_shown_once: boolField(formData, "is_shown_once"),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(
          payload,
          "Could not save that environment variable.",
        ),
      };
    }
    return { ok: true, message: `${key} saved on ${target}.` };
  }

  if (intent === "delete-env") {
    const target = String(formData.get("target") || "");
    const key = String(formData.get("key") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/panel-apps/${encodeURIComponent(target)}/envs/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(
          payload,
          "Could not delete that environment variable.",
        ),
      };
    }
    return { ok: true, message: `${key} deleted from ${target}.` };
  }

  if (intent === "restart-panel-app" || intent === "redeploy-panel-app") {
    const target = String(formData.get("target") || "");
    const endpoint =
      intent === "redeploy-panel-app"
        ? `/api/admin/panel-apps/${encodeURIComponent(target)}/redeploy`
        : `/api/admin/panel-apps/${encodeURIComponent(target)}/restart`;
    const res = await apiFetchAuthed(request, endpoint, { method: "POST" });
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not trigger that panel app action."),
      };
    }
    return {
      ok: true,
      message:
        intent === "redeploy-panel-app"
          ? `${target} redeploy queued.`
          : `${target} restart queued.`,
    };
  }

  if (intent === "update-user") {
    const userId = String(formData.get("user_id") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          role: String(formData.get("role") || "user"),
          is_active: String(formData.get("is_active") || "true") === "true",
          tenant_id: optionalStringField(formData, "tenant_id"),
          package_id: optionalStringField(formData, "package_id"),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not update that user."),
      };
    }
    return { ok: true, message: "User updated." };
  }

  if (intent === "create-user") {
    const res = await apiFetchAuthed(request, "/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || ""),
        role: String(formData.get("role") || "user"),
        tenant_id: optionalStringField(formData, "tenant_id"),
        tenant_name: optionalStringField(formData, "tenant_name"),
        plan: optionalStringField(formData, "plan"),
        package_id: optionalStringField(formData, "package_id"),
      }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not create that user."),
      };
    }
    return { ok: true, message: "User created." };
  }

  if (intent === "set-password") {
    const userId = String(formData.get("user_id") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/users/${encodeURIComponent(userId)}/password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: String(formData.get("password") || ""),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not change that password."),
      };
    }
    return { ok: true, message: "Password updated." };
  }

  if (intent === "update-tenant") {
    const tenantId = String(formData.get("tenant_id") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/tenants/${encodeURIComponent(tenantId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optionalStringField(formData, "name"),
          plan: optionalStringField(formData, "plan"),
          package_id: optionalStringField(formData, "package_id"),
          is_active: String(formData.get("is_active") || "true") === "true",
          max_sites: nullableNumberField(formData, "max_sites"),
          max_cpu_total: nullableNumberField(formData, "max_cpu_total"),
          max_memory_mb_total: nullableNumberField(
            formData,
            "max_memory_mb_total",
          ),
          max_team_members_per_site: nullableNumberField(
            formData,
            "max_team_members_per_site",
          ),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not update that plan."),
      };
    }
    return { ok: true, message: "Tenant package updated." };
  }

  if (intent === "create-package") {
    const res = await apiFetchAuthed(request, "/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        description: optionalStringField(formData, "description"),
        kind: String(formData.get("kind") || "WEB"),
        is_active: String(formData.get("is_active") || "true") === "true",
        n8n_variant: optionalStringField(formData, "n8n_variant"),
        max_sites: nullableNumberField(formData, "max_sites"),
        max_services: nullableNumberField(formData, "max_services"),
        max_cpu_total: nullableNumberField(formData, "max_cpu_total"),
        max_memory_mb_total: nullableNumberField(
          formData,
          "max_memory_mb_total",
        ),
        max_storage_gb_total: nullableNumberField(
          formData,
          "max_storage_gb_total",
        ),
        max_team_members_per_site: nullableNumberField(
          formData,
          "max_team_members_per_site",
        ),
      }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not create that package."),
      };
    }
    return { ok: true, message: "Package created." };
  }

  if (intent === "update-package") {
    const packageId = String(formData.get("package_id") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/packages/${encodeURIComponent(packageId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          description: optionalStringField(formData, "description") ?? null,
          kind: String(formData.get("kind") || "WEB"),
          is_active: String(formData.get("is_active") || "true") === "true",
          n8n_variant: optionalStringField(formData, "n8n_variant"),
          max_sites: nullableNumberField(formData, "max_sites"),
          max_services: nullableNumberField(formData, "max_services"),
          max_cpu_total: nullableNumberField(formData, "max_cpu_total"),
          max_memory_mb_total: nullableNumberField(
            formData,
            "max_memory_mb_total",
          ),
          max_storage_gb_total: nullableNumberField(
            formData,
            "max_storage_gb_total",
          ),
          max_team_members_per_site: nullableNumberField(
            formData,
            "max_team_members_per_site",
          ),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not update that package."),
      };
    }
    return { ok: true, message: "Package updated." };
  }

  if (intent === "create-site") {
    const res = await apiFetchAuthed(request, "/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: String(formData.get("tenant_id") || "").trim(),
        assign_user_id: optionalStringField(formData, "assign_user_id"),
        name: String(formData.get("name") || "").trim(),
        type: String(formData.get("type") || "node"),
        repo_url: optionalStringField(formData, "repo_url"),
        repo_branch: optionalStringField(formData, "repo_branch"),
        auto_deploy: String(formData.get("auto_deploy") || "false") === "true",
        github_app_id: optionalStringField(formData, "github_app_id"),
        private_key_uuid: optionalStringField(formData, "private_key_uuid"),
        use_github_connection:
          String(formData.get("use_github_connection") || "false") === "true",
      }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not create that site."),
      };
    }
    return { ok: true, message: "Site created." };
  }

  if (intent === "import-coolify-site") {
    const res = await apiFetchAuthed(
      request,
      "/api/admin/coolify-sites/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coolify_resource_id: String(
            formData.get("coolify_resource_id") || "",
          ).trim(),
          tenant_id: String(formData.get("tenant_id") || "").trim(),
          assign_user_id: optionalStringField(formData, "assign_user_id"),
          name: optionalStringField(formData, "name"),
          type: String(formData.get("type") || "node"),
          role: String(formData.get("role") || "editor"),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not import that Coolify site."),
      };
    }
    return { ok: true, message: "Coolify site imported." };
  }

  if (intent === "assign-site") {
    const siteId = String(formData.get("site_id") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/sites/${encodeURIComponent(siteId)}/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(formData.get("user_id") || "").trim(),
          role: String(formData.get("role") || "editor"),
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not assign that site."),
      };
    }
    return { ok: true, message: "Site assignment updated." };
  }

  if (intent === "create-service") {
    const res = await apiFetchAuthed(request, "/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: String(formData.get("tenant_id") || "").trim(),
        name: String(formData.get("name") || "").trim(),
      }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not create that service."),
      };
    }
    return { ok: true, message: "n8n service created." };
  }

  if (
    intent === "deploy-service" ||
    intent === "restart-service" ||
    intent === "start-service" ||
    intent === "stop-service" ||
    intent === "delete-service"
  ) {
    const serviceId = String(formData.get("service_id") || "");
    const serviceAction = intent.replace("-service", "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/services/${encodeURIComponent(serviceId)}${
        intent === "delete-service" ? "" : `/${serviceAction}`
      }`,
      { method: intent === "delete-service" ? "DELETE" : "POST" },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not update that service."),
      };
    }
    return { ok: true, message: `Service ${serviceAction} queued.` };
  }

  if (
    intent === "deploy-site" ||
    intent === "restart-site" ||
    intent === "start-site" ||
    intent === "stop-site" ||
    intent === "delete-site"
  ) {
    const siteId = String(formData.get("site_id") || "");
    const siteAction = intent.replace("-site", "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/sites/${encodeURIComponent(siteId)}${
        intent === "delete-site" ? "" : `/${siteAction}`
      }`,
      { method: intent === "delete-site" ? "DELETE" : "POST" },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        error: messageFrom(payload, "Could not update that site."),
      };
    }
    return { ok: true, message: `Site ${siteAction} queued.` };
  }

  return { ok: false, error: "Unknown action." };
}

export default function AdminPage() {
  const {
    panelApps,
    users,
    tenants,
    sites,
    services,
    coolifySites,
    packages,
    n8nVariants,
    planCatalog,
    adminEmails,
    stats,
    coolifyHealth,
    errors,
  } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userQuery, setUserQuery] = React.useState("");
  const [packageQuery, setPackageQuery] = React.useState("");
  const [siteQuery, setSiteQuery] = React.useState("");
  const [serviceQuery, setServiceQuery] = React.useState("");
  const [createSiteTenantId, setCreateSiteTenantId] = React.useState("");

  const currentIntent =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("intent") || "")
      : "";
  const currentTarget =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("target") || "")
      : "";
  const currentKey =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("key") || "")
      : "";
  const currentUserId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("user_id") || "")
      : "";
  const currentTenantId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("tenant_id") || "")
      : "";
  const currentPackageId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("package_id") || "")
      : "";
  const currentSiteId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("site_id") || "")
      : "";
  const currentServiceId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("service_id") || "")
      : "";
  const currentCoolifyResourceId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("coolify_resource_id") || "")
      : "";

  const rawTab = searchParams.get("tab");
  const currentTab: AdminTab =
    rawTab === "users" ||
    rawTab === "packages" ||
    rawTab === "sites" ||
    rawTab === "services" ||
    rawTab === "platform"
      ? rawTab
      : "sites";

  const userSearch = userQuery.trim().toLowerCase();
  const packageSearch = packageQuery.trim().toLowerCase();
  const siteSearch = siteQuery.trim().toLowerCase();
  const serviceSearch = serviceQuery.trim().toLowerCase();

  const filteredUsers = userSearch
    ? users.filter((user) =>
        [
          user.email,
          user.name,
          user.role,
          user.tenant_name || "",
          user.tenant_slug || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(userSearch),
      )
    : users;
  const filteredTenants = packageSearch
    ? tenants.filter((tenant) =>
        [
          tenant.name,
          tenant.slug,
          tenant.plan,
          tenant.package_name || "",
          tenant.package_kind || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(packageSearch),
      )
    : tenants;
  const filteredPackages = packageSearch
    ? packages.filter((pkg) =>
        [pkg.name, pkg.slug, pkg.kind, pkg.n8n_variant || ""]
          .join(" ")
          .toLowerCase()
          .includes(packageSearch),
      )
    : packages;
  const filteredSites = siteSearch
    ? sites.filter((site) =>
        [
          site.name,
          site.type,
          site.tenant_name,
          site.primary_domain || "",
          site.repo_url || "",
          ...site.assigned_users.map((assigned) => assigned.email),
        ]
          .join(" ")
          .toLowerCase()
          .includes(siteSearch),
      )
    : sites;
  const filteredServices = serviceSearch
    ? services.filter((service) =>
        [
          service.name,
          service.status,
          service.tenant_name,
          service.tenant_package_name || "",
          service.n8n_variant,
          service.primary_domain || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(serviceSearch),
      )
    : services;
  const webTenants = tenants.filter(
    (tenant) => tenant.package_kind === "WEB" || tenant.package_kind === null,
  );
  const n8nTenants = tenants.filter((tenant) => tenant.package_kind === "N8N");
  const createSiteAssignableUsers = users.filter(
    (user) =>
      !createSiteTenantId ||
      user.role === "admin" ||
      user.tenant_id === createSiteTenantId,
  );
  const createSiteTenant = webTenants.find(
    (tenant) => tenant.id === createSiteTenantId,
  );

  function handleTabChange(nextTab: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", nextTab);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Administration
          </p>
          <h1 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Workspace administration
          </h1>
        </div>
        <div className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          <ShieldCheck className="h-4 w-4" />
          Admin only
        </div>
      </div>

      {errors.length > 0 ? (
        <Banner tone="warn" title="Partial data loaded">
          {errors.join(" ")}
        </Banner>
      ) : null}
      {actionData?.ok === true ? (
        <Banner tone="success" title="Change applied">
          {actionData.message}
        </Banner>
      ) : null}
      {actionData?.ok === false ? (
        <Banner tone="error" title="Action failed">
          {actionData.error}
        </Banner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard
          icon={<Server className="h-5 w-5" />}
          label="Panel apps"
          value={String(panelApps.length)}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Users"
          value={String(stats.total_users)}
        />
        <StatCard
          icon={<KeyRound className="h-5 w-5" />}
          label="Admins"
          value={String(stats.admin_users)}
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Tenants"
          value={String(stats.total_tenants)}
        />
        <StatCard
          icon={<Globe className="h-5 w-5" />}
          label="Sites"
          value={String(stats.total_sites)}
        />
        <StatCard
          icon={<Workflow className="h-5 w-5" />}
          label="Services"
          value={String(stats.total_services)}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Unassigned"
          value={String(stats.unassigned_sites)}
        />
      </div>

      {coolifyHealth ? (
        <Banner
          tone={coolifyHealth.ok ? "success" : "warn"}
          title={
            coolifyHealth.ok
              ? "Hosting platform connected"
              : "Hosting platform needs attention"
          }
        >
          {coolifyHealth.ok
            ? `Checked ${coolifyHealth.tried.join(", ")} successfully.`
            : `${coolifyHealth.error || "The Coolify API check failed."} Tried: ${coolifyHealth.tried.join(", ")}`}
        </Banner>
      ) : null}

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsContent value="users" className="space-y-4">
          <AdminUsersTab
            adminEmails={adminEmails}
            currentIntent={currentIntent}
            currentUserId={currentUserId}
            filteredUsers={filteredUsers}
            packages={packages}
            planCatalog={planCatalog}
            stats={stats}
            tenants={tenants}
            userQuery={userQuery}
            onUserQueryChange={setUserQuery}
          />
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <AdminPackagesTab
            currentIntent={currentIntent}
            currentPackageId={currentPackageId}
            currentTenantId={currentTenantId}
            filteredPackages={filteredPackages}
            filteredTenants={filteredTenants}
            n8nVariants={n8nVariants}
            packages={packages}
            planCatalog={planCatalog}
            packageQuery={packageQuery}
            onPackageQueryChange={setPackageQuery}
          />
        </TabsContent>

        <TabsContent value="sites" className="space-y-4">
          <AdminSitesTab
            createSiteAssignableUsers={createSiteAssignableUsers}
            createSiteTenant={createSiteTenant}
            createSiteTenantId={createSiteTenantId}
            currentCoolifyResourceId={currentCoolifyResourceId}
            currentIntent={currentIntent}
            currentSiteId={currentSiteId}
            coolifySites={coolifySites}
            filteredSites={filteredSites}
            siteQuery={siteQuery}
            stats={stats}
            tenants={webTenants}
            users={users}
            onCreateSiteTenantChange={setCreateSiteTenantId}
            onSiteQueryChange={setSiteQuery}
          />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <AdminServicesTab
            currentIntent={currentIntent}
            currentServiceId={currentServiceId}
            filteredServices={filteredServices}
            n8nTenants={n8nTenants}
            serviceQuery={serviceQuery}
            stats={stats}
            onServiceQueryChange={setServiceQuery}
          />
        </TabsContent>

        <TabsContent value="platform" className="space-y-4">
          <AdminPlatformTab
            currentIntent={currentIntent}
            currentKey={currentKey}
            currentTarget={currentTarget}
            panelApps={panelApps}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
      <Search className="h-4 w-4" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] md:w-72"
      />
    </label>
  );
}

function AdminUsersTab({
  adminEmails,
  currentIntent,
  currentUserId,
  filteredUsers,
  packages,
  planCatalog,
  stats,
  tenants,
  userQuery,
  onUserQueryChange,
}: {
  adminEmails: string[];
  currentIntent: string;
  currentUserId: string;
  filteredUsers: AdminUser[];
  packages: AdminPackage[];
  planCatalog: PlanCatalogItem[];
  stats: LoaderData["stats"];
  tenants: AdminTenant[];
  userQuery: string;
  onUserQueryChange: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <MotionSection
          id="create-users"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              People
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Create people
            </h2>
          </div>
          <Form
            method="post"
            className="mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <input type="hidden" name="intent" value="create-user" />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="name"
                placeholder="Full name"
                className={fieldClassName}
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Email address"
                className={fieldClassName}
                required
              />
              <input
                type="password"
                name="password"
                minLength={8}
                placeholder="Temporary password"
                className={fieldClassName}
                required
              />
              <select
                name="role"
                defaultValue="user"
                className={fieldClassName}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <select
                name="tenant_id"
                defaultValue=""
                className={fieldClassName}
              >
                <option value="">Create workspace from name below</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.package_name || tenant.plan})
                  </option>
                ))}
              </select>
              <select
                name="plan"
                defaultValue="FREE"
                className={fieldClassName}
              >
                {planCatalog.map((plan) => (
                  <option key={plan.key} value={plan.key}>
                    {plan.label}
                  </option>
                ))}
              </select>
              <select
                name="package_id"
                defaultValue=""
                className={fieldClassName}
              >
                <option value="">Default web package for plan</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.kind})
                  </option>
                ))}
              </select>
            </div>
            <input
              name="tenant_name"
              placeholder="New workspace name"
              className={fieldClassName}
            />
            <button
              type="submit"
              disabled={currentIntent === "create-user"}
              className={primaryButtonClassName}
            >
              {currentIntent === "create-user" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create person
            </button>
          </Form>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.03 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Directory
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            Manage users
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {adminEmails.length
              ? `${adminEmails.length} admin accounts`
              : "No admin accounts"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PlanLimit label="Total users" value={String(stats.total_users)} />
            <PlanLimit label="Active users" value={String(stats.active_users)} />
            <PlanLimit label="Admins" value={String(stats.admin_users)} />
          </div>
          <div className="mt-4">
            <SearchField
              value={userQuery}
              onChange={onUserQueryChange}
              placeholder="Search people"
            />
          </div>
        </MotionSection>
      </div>

      <MotionSection
        id="manage-users"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.05 }}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <div className="space-y-4">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                packages={packages}
                tenants={tenants}
                isUpdating={
                  currentIntent === "update-user" && currentUserId === user.id
                }
                isChangingPassword={
                  currentIntent === "set-password" && currentUserId === user.id
                }
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-xs text-[var(--text-muted)]">
              No users matched that search.
            </div>
          )}
        </div>
      </MotionSection>
    </>
  );
}

function AdminPackagesTab({
  currentIntent,
  currentPackageId,
  currentTenantId,
  filteredPackages,
  filteredTenants,
  n8nVariants,
  packages,
  planCatalog,
  packageQuery,
  onPackageQueryChange,
}: {
  currentIntent: string;
  currentPackageId: string;
  currentTenantId: string;
  filteredPackages: AdminPackage[];
  filteredTenants: AdminTenant[];
  n8nVariants: N8nVariantDetail[];
  packages: AdminPackage[];
  planCatalog: PlanCatalogItem[];
  packageQuery: string;
  onPackageQueryChange: (value: string) => void;
}) {
  return (
    <>
      <MotionSection
        id="packages"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Packages
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Manage packages
            </h2>
          </div>
          <SearchField
            value={packageQuery}
            onChange={onPackageQueryChange}
            placeholder="Search packages and workspaces"
          />
        </div>

        <PackageCreateCard
          currentIntent={currentIntent}
          n8nVariants={n8nVariants}
        />

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {filteredPackages.length > 0 ? (
            filteredPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                currentIntent={currentIntent}
                currentPackageId={currentPackageId}
                n8nVariants={n8nVariants}
                pkg={pkg}
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-xs text-[var(--text-muted)]">
              No packages matched that search.
            </div>
          )}
        </div>
      </MotionSection>

      <MotionSection
        id="workspace-packages"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.04 }}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Workspaces
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Assign packages and limits
            </h2>
          </div>
          <Badge>{packages.length} packages</Badge>
        </div>

        {planCatalog.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {planCatalog.map((plan) => (
              <PlanCatalogCard key={plan.key} plan={plan} />
            ))}
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {filteredTenants.length > 0 ? (
            filteredTenants.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                packages={packages}
                planCatalog={planCatalog}
                isUpdating={
                  currentIntent === "update-tenant" &&
                  currentTenantId === tenant.id
                }
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-xs text-[var(--text-muted)]">
              No workspaces matched that search.
            </div>
          )}
        </div>
      </MotionSection>
    </>
  );
}

function AdminSitesTab({
  createSiteAssignableUsers,
  createSiteTenant,
  createSiteTenantId,
  currentCoolifyResourceId,
  currentIntent,
  currentSiteId,
  coolifySites,
  filteredSites,
  siteQuery,
  stats,
  tenants,
  users,
  onCreateSiteTenantChange,
  onSiteQueryChange,
}: {
  createSiteAssignableUsers: AdminUser[];
  createSiteTenant: AdminTenant | undefined;
  createSiteTenantId: string;
  currentCoolifyResourceId: string;
  currentIntent: string;
  currentSiteId: string;
  coolifySites: CoolifySiteCandidate[];
  filteredSites: AdminSite[];
  siteQuery: string;
  stats: LoaderData["stats"];
  tenants: AdminTenant[];
  users: AdminUser[];
  onCreateSiteTenantChange: (value: string) => void;
  onSiteQueryChange: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <MotionSection
          id="create-sites"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Websites
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Create sites
            </h2>
          </div>
          <Form
            method="post"
            className="mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <input type="hidden" name="intent" value="create-site" />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                name="tenant_id"
                className={fieldClassName}
                required
                value={createSiteTenantId}
                onChange={(event) => onCreateSiteTenantChange(event.target.value)}
              >
                <option value="" disabled>
                  Select workspace
                </option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.package_name || tenant.plan})
                  </option>
                ))}
              </select>
              <select
                name="type"
                defaultValue="node"
                className={fieldClassName}
              >
                <option value="node">Node</option>
                <option value="wordpress">WordPress</option>
                <option value="php">PHP</option>
                <option value="static">Static</option>
                <option value="python">Python</option>
              </select>
              <input
                name="name"
                placeholder="Site name"
                className={fieldClassName}
                required
              />
              <select
                name="assign_user_id"
                defaultValue=""
                className={fieldClassName}
              >
                <option value="">Leave unassigned</option>
                {createSiteAssignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}{" "}
                    {user.tenant_name ? `(${user.tenant_name})` : "(admin)"}
                  </option>
                ))}
              </select>
              <input
                name="repo_url"
                placeholder="Repository URL (required outside WordPress)"
                className={fieldClassName}
              />
              <input
                name="repo_branch"
                placeholder="Branch (default: main)"
                className={fieldClassName}
              />
              <select
                name="auto_deploy"
                defaultValue="false"
                className={fieldClassName}
              >
                <option value="false">Manual deploys</option>
                <option value="true">Auto deploy enabled</option>
              </select>
              <select
                name="use_github_connection"
                defaultValue="false"
                className={fieldClassName}
              >
                <option value="false">Direct repo credentials</option>
                <option value="true">Use tenant GitHub connection</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="github_app_id"
                placeholder="GitHub app id"
                className={fieldClassName}
              />
              <input
                name="private_key_uuid"
                placeholder="Private key UUID"
                className={fieldClassName}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Owner options are limited to administrators and people in the
              selected workspace.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              CPU and memory come from the workspace pool and rebalance across
              every site automatically.
            </p>
            {createSiteTenant ? (
              <div className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 text-xs text-[var(--text-muted)] md:grid-cols-4">
                <PlanLimit
                  label="Sites used"
                  value={`${createSiteTenant.usage.sites}/${createSiteTenant.resources.effective.max_sites}`}
                />
                <PlanLimit
                  label="CPU pool"
                  value={`${createSiteTenant.resources.effective.max_cpu_total}`}
                />
                <PlanLimit
                  label="Memory pool"
                  value={`${createSiteTenant.resources.effective.max_memory_mb_total} MB`}
                />
                <PlanLimit
                  label="Team cap"
                  value={`${createSiteTenant.resources.effective.max_team_members_per_site}`}
                />
              </div>
            ) : null}
            <button
              type="submit"
              disabled={currentIntent === "create-site"}
              className={primaryButtonClassName}
            >
              {currentIntent === "create-site" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Create site
            </button>
          </Form>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.03 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Directory
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            Browse sites
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PlanLimit label="Total sites" value={String(stats.total_sites)} />
            <PlanLimit
              label="Unassigned sites"
              value={String(stats.unassigned_sites)}
            />
          </div>
          <div className="mt-4">
            <SearchField
              value={siteQuery}
              onChange={onSiteQueryChange}
              placeholder="Search sites, domains, or repositories"
            />
          </div>
        </MotionSection>
      </div>

      <MotionSection
        id="coolify-sites"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.05 }}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Imported apps
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Import existing apps
            </h2>
          </div>
          <Badge>{coolifySites.length} available</Badge>
        </div>

        {coolifySites.length > 0 ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {coolifySites.map((site) => (
              <CoolifySiteImportCard
                key={site.uuid}
                site={site}
                tenants={tenants}
                users={users}
                isImporting={
                  currentIntent === "import-coolify-site" &&
                  currentCoolifyResourceId === site.uuid
                }
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-5 text-xs text-[var(--text-muted)]">
            No additional apps are available to import right now.
          </div>
        )}
      </MotionSection>

      <MotionSection
        id="assign-sites"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.07 }}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Site access
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            Assign existing sites
          </h2>
        </div>

        <div className="mt-4 space-y-4">
          {filteredSites.length > 0 ? (
            filteredSites.map((site) => (
              <SiteRow
                key={site.id}
                currentIntent={currentIntent}
                currentSiteId={currentSiteId}
                site={site}
                users={users}
                isAssigning={
                  currentIntent === "assign-site" && currentSiteId === site.id
                }
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-xs text-[var(--text-muted)]">
              No sites matched that search.
            </div>
          )}
        </div>
      </MotionSection>
    </>
  );
}

function AdminServicesTab({
  currentIntent,
  currentServiceId,
  filteredServices,
  n8nTenants,
  serviceQuery,
  stats,
  onServiceQueryChange,
}: {
  currentIntent: string;
  currentServiceId: string;
  filteredServices: AdminManagedService[];
  n8nTenants: AdminTenant[];
  serviceQuery: string;
  stats: LoaderData["stats"];
  onServiceQueryChange: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <MotionSection
          id="create-services"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              n8n
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Create n8n services
            </h2>
          </div>
          <Form method="post" className="mt-4 space-y-3">
            <input type="hidden" name="intent" value="create-service" />
            <div className="grid gap-3 md:grid-cols-2">
              <select name="tenant_id" className={fieldClassName} required>
                <option value="">Select n8n workspace</option>
                {n8nTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.package_name || "n8n"})
                  </option>
                ))}
              </select>
              <input
                name="name"
                placeholder="Service name"
                className={fieldClassName}
                required
              />
            </div>
            <button
              type="submit"
              disabled={currentIntent === "create-service"}
              className={primaryButtonClassName}
            >
              {currentIntent === "create-service" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Workflow className="h-4 w-4" />
              )}
              Create service
            </button>
          </Form>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.03 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Directory
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            Manage n8n services
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PlanLimit
              label="Total services"
              value={String(stats.total_services)}
            />
            <PlanLimit
              label="n8n workspaces"
              value={String(n8nTenants.length)}
            />
          </div>
          <div className="mt-4">
            <SearchField
              value={serviceQuery}
              onChange={onServiceQueryChange}
              placeholder="Search services"
            />
          </div>
        </MotionSection>
      </div>

      <MotionSection
        id="manage-services"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.06 }}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <div className="space-y-4">
          {filteredServices.length > 0 ? (
            filteredServices.map((service) => (
              <ServiceRow
                key={service.id}
                currentIntent={currentIntent}
                currentServiceId={currentServiceId}
                service={service}
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-xs text-[var(--text-muted)]">
              No services matched that search.
            </div>
          )}
        </div>
      </MotionSection>
    </>
  );
}

function ServiceRow({
  currentIntent,
  currentServiceId,
  service,
}: {
  currentIntent: string;
  currentServiceId: string;
  service: AdminManagedService;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-[var(--foreground)]">
          {service.name}
        </div>
        <Badge>{service.status}</Badge>
        <Badge>{service.n8n_variant}</Badge>
        <Badge>{service.tenant_name}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>Domain: {service.primary_domain || "none"}</span>
        <span>CPU: {service.cpu_limit}</span>
        <span>Memory: {service.memory_mb} MB</span>
        <span>Storage: {service.storage_gb} GB</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["deploy", "restart", "start", "stop"] as const).map((action) => (
          <Form key={action} method="post">
            <input type="hidden" name="intent" value={`${action}-service`} />
            <input type="hidden" name="service_id" value={service.id} />
            <button
              type="submit"
              disabled={
                currentIntent === `${action}-service` &&
                currentServiceId === service.id
              }
              className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-60"
            >
              {currentIntent === `${action}-service` &&
              currentServiceId === service.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {action}
            </button>
          </Form>
        ))}
        <Form
          method="post"
          onSubmit={(event) => {
            if (!confirm(`Delete ${service.name}?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete-service" />
          <input type="hidden" name="service_id" value={service.id} />
          <button
            type="submit"
            disabled={
              currentIntent === "delete-service" &&
              currentServiceId === service.id
            }
            className="inline-flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-400/15 disabled:opacity-60"
          >
            {currentIntent === "delete-service" &&
            currentServiceId === service.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </button>
        </Form>
      </div>
    </div>
  );
}

function AdminPlatformTab({
  currentIntent,
  currentKey,
  currentTarget,
  panelApps,
}: {
  currentIntent: string;
  currentKey: string;
  currentTarget: string;
  panelApps: PanelApp[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {panelApps.map((app, index) => (
        <MotionSection
          key={app.uuid}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: index * 0.04 }}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
                {app.target}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {app.label}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {app.name}
                {app.base_directory ? ` - ${app.base_directory}` : ""}
              </p>
            </div>
            <span
              className={`rounded-none border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(app.status)}`}
            >
              {app.status || "unknown"}
            </span>
          </div>

          {app.fqdn ? (
            <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                <Globe className="h-4 w-4" />
                Public endpoints
              </div>
              <div className="break-all text-xs font-mono text-[var(--text-muted)]">
                {app.fqdn}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Form method="post">
              <input type="hidden" name="intent" value="restart-panel-app" />
              <input type="hidden" name="target" value={app.target} />
              <button
                type="submit"
                disabled={
                  currentIntent === "restart-panel-app" &&
                  currentTarget === app.target
                }
                className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-60"
              >
                {currentIntent === "restart-panel-app" &&
                currentTarget === app.target ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Restart
              </button>
            </Form>

            <Form method="post">
              <input type="hidden" name="intent" value="redeploy-panel-app" />
              <input type="hidden" name="target" value={app.target} />
              <button
                type="submit"
                disabled={
                  currentIntent === "redeploy-panel-app" &&
                  currentTarget === app.target
                }
                className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
              >
                {currentIntent === "redeploy-panel-app" &&
                currentTarget === app.target ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Republish
              </button>
            </Form>
          </div>

          <Form
            method="post"
            className="mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <input type="hidden" name="intent" value="upsert-env" />
            <input type="hidden" name="target" value={app.target} />
            <div className="text-sm font-semibold text-[var(--foreground)]">Add variable</div>
            <input
              name="key"
              placeholder="GITHUB_OAUTH_CLIENT_ID"
              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm font-mono text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
            <textarea
              name="value"
              rows={3}
              placeholder="Value"
              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm font-mono text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
            <EnvFlags />
            <button
              type="submit"
              disabled={
                currentIntent === "upsert-env" &&
                currentTarget === app.target &&
                !currentKey
              }
              className="inline-flex items-center gap-2 rounded-md bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
            >
              {currentIntent === "upsert-env" &&
              currentTarget === app.target &&
              !currentKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add variable
            </button>
          </Form>

          <div className="mt-4 space-y-3">
            {app.envs.length > 0 ? (
              app.envs.map((env) => (
                <EnvRow
                  key={`${app.target}:${env.key}`}
                  target={app.target}
                  env={env}
                  isBusy={
                    currentTarget === app.target && currentKey === env.key
                  }
                  currentIntent={currentIntent}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-xs text-[var(--text-muted)]">
                No variables added yet.
              </div>
            )}
          </div>
        </MotionSection>
      ))}
    </div>
  );
}

const fieldClassName =
  `${inputClass} min-h-10 [&>option]:bg-[var(--surface)] [&>option]:text-[var(--foreground)]`;

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] disabled:opacity-60";

function CoolifySiteImportCard({
  site,
  tenants,
  users,
  isImporting,
}: {
  site: CoolifySiteCandidate;
  tenants: AdminTenant[];
  users: AdminUser[];
  isImporting: boolean;
}) {
  const [tenantId, setTenantId] = React.useState("");
  const assignableUsers = users.filter(
    (user) => !tenantId || user.role === "admin" || user.tenant_id === tenantId,
  );

  return (
    <Form
      method="post"
      className="flex min-h-[360px] min-w-0 flex-col rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <input type="hidden" name="intent" value="import-coolify-site" />
      <input type="hidden" name="coolify_resource_id" value={site.uuid} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-[var(--foreground)]">
              {site.name || "Coolify application"}
            </h3>
            {site.status ? <Badge>{site.status}</Badge> : null}
          </div>
          <div className="mt-2 break-all font-mono text-xs text-[var(--text-muted)]">
            {site.uuid}
          </div>
        </div>
        {site.base_directory ? <Badge>{site.base_directory}</Badge> : null}
      </div>

      {site.fqdn ? (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Public URL
          </div>
          <div className="mt-1 break-all text-xs leading-5 text-[var(--text-muted)]">
            {site.fqdn}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Tenant</span>
          <select
            name="tenant_id"
            className={`w-full ${fieldClassName}`}
            required
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          >
            <option value="" disabled>
              Select tenant
            </option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.package_name || tenant.plan})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Owner</span>
          <select
            name="assign_user_id"
            defaultValue=""
            className={`w-full ${fieldClassName}`}
          >
            <option value="">Import unassigned</option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}{" "}
                {user.tenant_name ? `(${user.tenant_name})` : "(admin)"}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Site type</span>
          <select
            name="type"
            defaultValue="node"
            className={`w-full ${fieldClassName}`}
          >
            <option value="node">Node</option>
            <option value="wordpress">WordPress</option>
            <option value="php">PHP</option>
            <option value="static">Static</option>
            <option value="python">Python</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--text-muted)]">User role</span>
          <select
            name="role"
            defaultValue="editor"
            className={`w-full ${fieldClassName}`}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
      </div>

      <label className="mt-3 space-y-1.5">
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          Dashboard name
        </span>
        <input
          name="name"
          placeholder={site.name || "Optional name override"}
          className={`w-full ${fieldClassName}`}
        />
      </label>

      <div className="mt-auto pt-4">
        <button
          type="submit"
          disabled={isImporting}
          className={primaryButtonClassName}
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Server className="h-4 w-4" />
          )}
          Import and assign
        </button>
      </div>
    </Form>
  );
}

function Banner({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "success" | "warn" | "error";
  children: React.ReactNode;
}) {
  const className =
    tone === "success"
      ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
      : tone === "warn"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-red-400/25 bg-red-400/10 text-red-100";

  return (
    <div className={`rounded-md border px-4 py-3 text-xs ${className}`}>
      <div className="flex items-center gap-2 font-semibold">
        {tone === "success" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        {title}
      </div>
      <p className="mt-1 opacity-85">{children}</p>
    </div>
  );
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
    <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <div className="text-[var(--text-soft)]">{icon}</div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          {label}
        </div>
      </div>
      <div className="mt-4 text-lg font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

function EnvFlags({
  defaults,
}: {
  defaults?: Partial<
    Pick<
      PanelEnv,
      "is_buildtime" | "is_literal" | "is_multiline" | "is_shown_once"
    >
  >;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
      <Flag
        name="is_buildtime"
        label="Build-time"
        checked={Boolean(defaults?.is_buildtime)}
      />
      <Flag
        name="is_literal"
        label="Literal"
        checked={defaults?.is_literal ?? true}
      />
      <Flag
        name="is_multiline"
        label="Multiline"
        checked={Boolean(defaults?.is_multiline)}
      />
      <Flag
        name="is_shown_once"
        label="Shown once"
        checked={Boolean(defaults?.is_shown_once)}
      />
    </div>
  );
}

function Flag({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
      <input type="hidden" name={`${name}_present`} value="1" />
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="accent-white"
      />
      {label}
    </label>
  );
}

function EnvRow({
  target,
  env,
  isBusy,
  currentIntent,
}: {
  target: "backend" | "frontend";
  env: PanelEnv;
  isBusy: boolean;
  currentIntent: string;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="font-mono text-sm font-semibold text-[var(--foreground)]">
          {env.key}
        </div>
        {env.is_buildtime ? <Badge>Build-time</Badge> : null}
        {env.has_preview ? <Badge>Preview copy</Badge> : null}
        {env.variant_count > 1 ? (
          <Badge>{env.variant_count} variants</Badge>
        ) : null}
      </div>

      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="upsert-env" />
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="key" value={env.key} />
        {env.is_multiline ? (
          <Textarea
            name="value"
            defaultValue={env.value}
            rows={4}
            className="font-mono"
          />
        ) : (
          <input
            name="value"
            defaultValue={env.value}
            className={`w-full ${fieldClassName} font-mono`}
          />
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <EnvFlags defaults={env} />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isBusy && currentIntent === "upsert-env"}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
            >
              {isBusy && currentIntent === "upsert-env" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        </div>
      </Form>

      <Form
        method="post"
        className="mt-3"
        onSubmit={(event) => {
          if (!confirm(`Delete ${env.key} from ${target}?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="intent" value="delete-env" />
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="key" value={env.key} />
        <button
          type="submit"
          disabled={isBusy && currentIntent === "delete-env"}
          className="inline-flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/10 px-3.5 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/15 disabled:opacity-60"
        >
          {isBusy && currentIntent === "delete-env" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete
        </button>
      </Form>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-none border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
      {children}
    </span>
  );
}

function UserRow({
  user,
  packages,
  tenants,
  isUpdating,
  isChangingPassword,
}: {
  user: AdminUser;
  packages: AdminPackage[];
  tenants: AdminTenant[];
  isUpdating: boolean;
  isChangingPassword: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-[var(--foreground)]">{user.name}</div>
        <Badge>{user.role}</Badge>
        <Badge>{user.is_active ? "active" : "suspended"}</Badge>
      </div>
      <div className="mt-2 text-sm text-[var(--text-muted)]">{user.email}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>Tenant: {user.tenant_name || "No tenant"}</span>
        <span>Package: {user.tenant_package_name || "none"}</span>
        <span>Sites: {user.site_memberships}</span>
        <span>Last login: {formatDate(user.last_login_at)}</span>
        <span>Created: {formatDate(user.created_at)}</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.95fr]">
        <Form
          method="post"
          className="space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <input type="hidden" name="intent" value="update-user" />
          <input type="hidden" name="user_id" value={user.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="name"
              defaultValue={user.name}
              className={fieldClassName}
            />
            <input
              type="email"
              name="email"
              defaultValue={user.email}
              className={fieldClassName}
            />
            <select
              name="role"
              defaultValue={user.role}
              className={fieldClassName}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select
              name="is_active"
              defaultValue={user.is_active ? "true" : "false"}
              className={fieldClassName}
            >
              <option value="true">Active</option>
              <option value="false">Suspended</option>
            </select>
            <select
              name="tenant_id"
              defaultValue={user.tenant_id || ""}
              className={fieldClassName}
            >
              <option value="">No tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.package_name || tenant.plan})
                </option>
              ))}
            </select>
            <select
              name="package_id"
              defaultValue={user.tenant_package_id || ""}
              className={fieldClassName}
            >
              <option value="">Keep tenant package</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.kind})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isUpdating}
            className={primaryButtonClassName}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save user
          </button>
        </Form>

        <Form
          method="post"
          className="space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <input type="hidden" name="intent" value="set-password" />
          <input type="hidden" name="user_id" value={user.id} />
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <LockKeyhole className="h-4 w-4" />
            Password reset
          </div>
          <input
            type="password"
            name="password"
            minLength={8}
            placeholder="At least 8 characters"
            className={`w-full ${fieldClassName}`}
            required
          />
          <button
            type="submit"
            disabled={isChangingPassword}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
          >
            {isChangingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Update password
          </button>
        </Form>
      </div>
    </div>
  );
}

function PackageCreateCard({
  currentIntent,
  n8nVariants,
}: {
  currentIntent: string;
  n8nVariants: N8nVariantDetail[];
}) {
  return (
    <Form
      method="post"
      className="mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <input type="hidden" name="intent" value="create-package" />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          name="name"
          placeholder="Package name"
          className={fieldClassName}
          required
        />
        <select name="kind" defaultValue="WEB" className={fieldClassName}>
          <option value="WEB">Web services</option>
          <option value="N8N">n8n services</option>
        </select>
        <select
          name="is_active"
          defaultValue="true"
          className={fieldClassName}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <input
        name="description"
        placeholder="Short description"
        className={fieldClassName}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <select
          name="n8n_variant"
          defaultValue="SIMPLE"
          className={fieldClassName}
        >
          {n8nVariants.map((variant) => (
            <option key={variant.key} value={variant.key}>
              {variant.label}
            </option>
          ))}
        </select>
        <input
          name="max_sites"
          type="number"
          min="0"
          step="1"
          placeholder="Web site limit"
          className={fieldClassName}
        />
        <input
          name="max_services"
          type="number"
          min="0"
          step="1"
          placeholder="n8n service limit"
          className={fieldClassName}
        />
        <input
          name="max_cpu_total"
          type="number"
          min="0.1"
          step="0.1"
          placeholder="CPU"
          className={fieldClassName}
        />
        <input
          name="max_memory_mb_total"
          type="number"
          min="128"
          step="128"
          placeholder="Memory MB"
          className={fieldClassName}
        />
        <input
          name="max_storage_gb_total"
          type="number"
          min="1"
          step="1"
          placeholder="Storage GB"
          className={fieldClassName}
        />
        <input
          name="max_team_members_per_site"
          type="number"
          min="1"
          step="1"
          placeholder="Team / site"
          className={fieldClassName}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {n8nVariants.map((variant) => (
          <PlanLimit
            key={variant.key}
            label={variant.label}
            value={variant.description}
          />
        ))}
      </div>
      <button
        type="submit"
        disabled={currentIntent === "create-package"}
        className={primaryButtonClassName}
      >
        {currentIntent === "create-package" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create package
      </button>
    </Form>
  );
}

function PackageCard({
  currentIntent,
  currentPackageId,
  n8nVariants,
  pkg,
}: {
  currentIntent: string;
  currentPackageId: string;
  n8nVariants: N8nVariantDetail[];
  pkg: AdminPackage;
}) {
  const isUpdating =
    currentIntent === "update-package" && currentPackageId === pkg.id;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-[var(--foreground)]">
          {pkg.name}
        </div>
        <Badge>{pkg.kind}</Badge>
        <Badge>{pkg.is_active ? "active" : "inactive"}</Badge>
        {pkg.n8n_variant ? <Badge>{pkg.n8n_variant}</Badge> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
        {pkg.variant_details?.description ||
          pkg.description ||
          "Package resources are editable below."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <PlanLimit
          label="Tenants"
          value={String(pkg.usage.tenants)}
        />
        <PlanLimit
          label={pkg.kind === "WEB" ? "Sites" : "Services"}
          value={String(
            pkg.kind === "WEB"
              ? pkg.resources.max_sites ?? 0
              : pkg.resources.max_services ?? 0,
          )}
        />
        <PlanLimit
          label="Memory"
          value={`${pkg.resources.max_memory_mb_total ?? 0} MB`}
        />
      </div>
      <Form method="post" className="mt-4 space-y-3">
        <input type="hidden" name="intent" value="update-package" />
        <input type="hidden" name="package_id" value={pkg.id} />
        <div className="grid gap-3 md:grid-cols-3">
          <input
            name="name"
            defaultValue={pkg.name}
            className={fieldClassName}
          />
          <select name="kind" defaultValue={pkg.kind} className={fieldClassName}>
            <option value="WEB">Web services</option>
            <option value="N8N">n8n services</option>
          </select>
          <select
            name="is_active"
            defaultValue={pkg.is_active ? "true" : "false"}
            className={fieldClassName}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <input
          name="description"
          defaultValue={pkg.description || ""}
          placeholder="Package description"
          className={fieldClassName}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <select
            name="n8n_variant"
            defaultValue={pkg.n8n_variant || "SIMPLE"}
            className={fieldClassName}
          >
            {n8nVariants.map((variant) => (
              <option key={variant.key} value={variant.key}>
                {variant.label}
              </option>
            ))}
          </select>
          <input
            name="max_sites"
            type="number"
            min="0"
            step="1"
            defaultValue={pkg.resources.max_sites ?? ""}
            placeholder="Web site limit"
            className={fieldClassName}
          />
          <input
            name="max_services"
            type="number"
            min="0"
            step="1"
            defaultValue={pkg.resources.max_services ?? ""}
            placeholder="n8n service limit"
            className={fieldClassName}
          />
          <input
            name="max_cpu_total"
            type="number"
            min="0.1"
            step="0.1"
            defaultValue={pkg.resources.max_cpu_total ?? ""}
            placeholder="CPU"
            className={fieldClassName}
          />
          <input
            name="max_memory_mb_total"
            type="number"
            min="128"
            step="128"
            defaultValue={pkg.resources.max_memory_mb_total ?? ""}
            placeholder="Memory MB"
            className={fieldClassName}
          />
          <input
            name="max_storage_gb_total"
            type="number"
            min="1"
            step="1"
            defaultValue={pkg.resources.max_storage_gb_total ?? ""}
            placeholder="Storage GB"
            className={fieldClassName}
          />
          <input
            name="max_team_members_per_site"
            type="number"
            min="1"
            step="1"
            defaultValue={pkg.resources.max_team_members_per_site ?? ""}
            placeholder="Team / site"
            className={fieldClassName}
          />
        </div>
        <button
          type="submit"
          disabled={isUpdating}
          className={primaryButtonClassName}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save package
        </button>
      </Form>
    </div>
  );
}

function PlanCatalogCard({ plan }: { plan: PlanCatalogItem }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--foreground)]">{plan.label}</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {plan.key}
          </div>
        </div>
        <Badge>{plan.resources.max_sites} sites</Badge>
      </div>
      <p className="mt-3 min-h-10 text-xs leading-5 text-[var(--text-muted)]">
        {plan.description}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <PlanLimit
          label="CPU pool"
          value={`${plan.resources.max_cpu_total}`}
        />
        <PlanLimit
          label="Memory pool"
          value={`${plan.resources.max_memory_mb_total} MB`}
        />
        <PlanLimit
          label="Team / site"
          value={`${plan.resources.max_team_members_per_site}`}
        />
        <PlanLimit label="Tenant overrides" value="Editable" />
      </div>
    </div>
  );
}

function PlanLimit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-semibold text-[var(--text-muted)]">{value}</div>
    </div>
  );
}

function TenantRow({
  tenant,
  packages,
  planCatalog,
  isUpdating,
}: {
  tenant: AdminTenant;
  packages: AdminPackage[];
  planCatalog: PlanCatalogItem[];
  isUpdating: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-[var(--foreground)]">{tenant.name}</div>
        <Badge>{tenant.package_name || tenant.plan}</Badge>
        <Badge>{tenant.package_kind || "legacy web"}</Badge>
        <Badge>{tenant.is_active ? "active" : "suspended"}</Badge>
        <Badge>{tenant.slug}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>Users: {tenant.usage.users}</span>
        <span>Sites: {tenant.usage.sites}</span>
        <span>Services: {tenant.usage.services}</span>
        <span>Assigned: {tenant.usage.assigned_sites}</span>
        <span>Unassigned: {tenant.usage.unassigned_sites}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <ResourceCard
          label="Max sites"
          base={tenant.resources.effective.max_sites}
          overrideValue={tenant.resources.overrides.max_sites}
        />
        <ResourceCard
          label="CPU pool"
          base={tenant.resources.effective.max_cpu_total}
          overrideValue={tenant.resources.overrides.max_cpu_total}
        />
        <ResourceCard
          label="Memory pool"
          base={tenant.resources.effective.max_memory_mb_total}
          overrideValue={tenant.resources.overrides.max_memory_mb_total}
          suffix="MB"
        />
        <ResourceCard
          label="Team / site"
          base={tenant.resources.effective.max_team_members_per_site}
          overrideValue={tenant.resources.overrides.max_team_members_per_site}
        />
      </div>
      <Form
        method="post"
        className="mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <input type="hidden" name="intent" value="update-tenant" />
        <input type="hidden" name="tenant_id" value={tenant.id} />
        <div className="grid gap-3 md:grid-cols-3">
          <input
            name="name"
            defaultValue={tenant.name}
            className={fieldClassName}
          />
          <select
            name="plan"
            defaultValue={tenant.plan}
            className={fieldClassName}
          >
            {planCatalog.map((plan) => (
              <option key={plan.key} value={plan.key}>
                {plan.label}
              </option>
            ))}
          </select>
          <select
            name="package_id"
            defaultValue={tenant.package_id || ""}
            className={fieldClassName}
          >
            <option value="">Legacy plan fallback</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} ({pkg.kind})
              </option>
            ))}
          </select>
          <select
            name="is_active"
            defaultValue={tenant.is_active ? "true" : "false"}
            className={fieldClassName}
          >
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>
          <input
            name="max_sites"
            type="number"
            min="1"
            step="1"
            defaultValue={tenant.resources.overrides.max_sites ?? ""}
            placeholder={`Base: ${tenant.resources.effective.max_sites}`}
            className={fieldClassName}
          />
          <input
            name="max_cpu_total"
            type="number"
            min="0.1"
            step="0.1"
            defaultValue={tenant.resources.overrides.max_cpu_total ?? ""}
            placeholder={`Base: ${tenant.resources.effective.max_cpu_total}`}
            className={fieldClassName}
          />
          <input
            name="max_memory_mb_total"
            type="number"
            min="128"
            step="128"
            defaultValue={tenant.resources.overrides.max_memory_mb_total ?? ""}
            placeholder={`Base: ${tenant.resources.effective.max_memory_mb_total}`}
            className={fieldClassName}
          />
          <input
            name="max_team_members_per_site"
            type="number"
            min="1"
            step="1"
            defaultValue={
              tenant.resources.overrides.max_team_members_per_site ?? ""
            }
            placeholder={`Base: ${tenant.resources.effective.max_team_members_per_site}`}
            className={fieldClassName}
          />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Package switches are blocked when the workspace already owns the
          other resource type. Blank quota fields fall back to package defaults.
        </p>
        <button
          type="submit"
          disabled={isUpdating}
          className={primaryButtonClassName}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save tenant package
        </button>
      </Form>
    </div>
  );
}

function SiteRow({
  currentIntent,
  currentSiteId,
  site,
  users,
  isAssigning,
}: {
  currentIntent: string;
  currentSiteId: string;
  site: AdminSite;
  users: AdminUser[];
  isAssigning: boolean;
}) {
  const assignableUsers = users.filter(
    (user) => user.role === "admin" || user.tenant_id === site.tenant_id,
  );

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-[var(--foreground)]">{site.name}</div>
        <Badge>{site.type}</Badge>
        <Badge>{site.tenant_name}</Badge>
        <Badge>{site.tenant_package_name || site.tenant_plan}</Badge>
        <Badge>
          {site.is_unassigned ? "unassigned" : `${site.member_count} members`}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>Status: {site.status}</span>
        <span>CPU: {site.cpu_limit}</span>
        <span>Memory: {site.memory_mb} MB</span>
        <span>Domain: {site.primary_domain || "none"}</span>
        <span>Repo: {site.repo_url || "none"}</span>
      </div>
      {site.assigned_users.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {site.assigned_users.map((assigned) => (
            <Badge key={`${site.id}:${assigned.id}`}>
              {assigned.email} ({assigned.role})
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["deploy", "restart", "start", "stop"] as const).map((action) => (
          <Form key={action} method="post">
            <input type="hidden" name="intent" value={`${action}-site`} />
            <input type="hidden" name="site_id" value={site.id} />
            <button
              type="submit"
              disabled={
                currentIntent === `${action}-site` && currentSiteId === site.id
              }
              className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-60"
            >
              {currentIntent === `${action}-site` &&
              currentSiteId === site.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {action}
            </button>
          </Form>
        ))}
        <Form
          method="post"
          onSubmit={(event) => {
            if (!confirm(`Delete ${site.name}?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete-site" />
          <input type="hidden" name="site_id" value={site.id} />
          <button
            type="submit"
            disabled={currentIntent === "delete-site" && currentSiteId === site.id}
            className="inline-flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-400/15 disabled:opacity-60"
          >
            {currentIntent === "delete-site" && currentSiteId === site.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </button>
        </Form>
      </div>
      <Form
        method="post"
        className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <input type="hidden" name="intent" value="assign-site" />
        <input type="hidden" name="site_id" value={site.id} />
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto]">
          <select
            name="user_id"
            className={fieldClassName}
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select user
            </option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email} {user.role === "admin" ? "(admin)" : ""}
              </option>
            ))}
          </select>
          <select name="role" defaultValue="editor" className={fieldClassName}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={isAssigning}
            className={primaryButtonClassName}
          >
            {isAssigning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Assign
          </button>
        </div>
      </Form>
    </div>
  );
}

function ResourceCard({
  label,
  base,
  overrideValue,
  suffix,
}: {
  label: string;
  base: number;
  overrideValue: number | null;
  suffix?: string;
}) {
  const resolved = overrideValue ?? base;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">
        {resolved}
        {suffix ? ` ${suffix}` : ""}
      </div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">
        {overrideValue === null
          ? "Using plan default"
          : `Override on top of ${base}${suffix ? ` ${suffix}` : ""}`}
      </div>
    </div>
  );
}
