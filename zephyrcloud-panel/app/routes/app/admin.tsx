import * as React from "react";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { motion } from "framer-motion";
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
} from "lucide-react";

import { apiFetchAuthed } from "~/services/api.authed.server";
import { requireUser } from "~/services/session.server";

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
  site_memberships: number;
  last_login_at: string | null;
  created_at: string;
};

type PlanCatalogItem = {
  key:
    | "FREE"
    | "PRO"
    | "DRIFT_START"
    | "DRIFT_CORE"
    | "DRIFT_PLUS"
    | "DRIFT_GLOBAL";
  label: string;
  description: string;
  resources: {
    max_sites: number;
    max_cpu_per_site: number;
    max_memory_mb_per_site: number;
    max_team_members_per_site: number;
  };
};

type AdminTenant = {
  id: string;
  name: string;
  slug: string;
  plan: PlanCatalogItem["key"];
  is_active: boolean;
  suspended_at: string | null;
  usage: {
    users: number;
    sites: number;
    assigned_sites: number;
    unassigned_sites: number;
  };
  resources: {
    overrides: {
      max_sites: number | null;
      max_cpu_per_site: number | null;
      max_memory_mb_per_site: number | null;
      max_team_members_per_site: number | null;
    };
    effective: {
      max_sites: number;
      max_cpu_per_site: number;
      max_memory_mb_per_site: number;
      max_team_members_per_site: number;
    };
  };
};

type AdminSite = {
  id: string;
  name: string;
  type: "wordpress" | "node" | "php" | "static";
  status: string;
  tenant_id: string;
  tenant_name: string;
  tenant_plan: PlanCatalogItem["key"];
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

type LoaderData = {
  panelApps: PanelApp[];
  users: AdminUser[];
  tenants: AdminTenant[];
  sites: AdminSite[];
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
  };
  coolifyHealth: {
    ok: boolean;
    tried: string[];
    error?: string;
  } | null;
  errors: string[];
};

type ActionData = { ok: true; message: string } | { ok: false; error: string };

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

function statusTone(status?: string) {
  if (!status) return "border-white/10 bg-white/5 text-white/60";
  const normalized = status.toLowerCase();
  if (
    normalized.includes("healthy") ||
    normalized.includes("running") ||
    normalized === "up"
  ) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }
  if (normalized.includes("error") || normalized.includes("failed")) {
    return "border-red-400/20 bg-red-400/10 text-red-100";
  }
  return "border-amber-400/20 bg-amber-400/10 text-amber-100";
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
                max_cpu_per_site:
                  typeof plan.resources.max_cpu_per_site === "number"
                    ? plan.resources.max_cpu_per_site
                    : 0,
                max_memory_mb_per_site:
                  typeof plan.resources.max_memory_mb_per_site === "number"
                    ? plan.resources.max_memory_mb_per_site
                    : 0,
                max_team_members_per_site:
                  typeof plan.resources.max_team_members_per_site === "number"
                    ? plan.resources.max_team_members_per_site
                    : 0,
              }
            : {
                max_sites: 0,
                max_cpu_per_site: 0,
                max_memory_mb_per_site: 0,
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
                assigned_sites:
                  typeof tenant.usage.assigned_sites === "number"
                    ? tenant.usage.assigned_sites
                    : 0,
                unassigned_sites:
                  typeof tenant.usage.unassigned_sites === "number"
                    ? tenant.usage.unassigned_sites
                    : 0,
              }
            : { users: 0, sites: 0, assigned_sites: 0, unassigned_sites: 0 },
          resources: isRecord(tenant.resources)
            ? {
                overrides: isRecord(tenant.resources.overrides)
                  ? {
                      max_sites:
                        typeof tenant.resources.overrides.max_sites === "number"
                          ? tenant.resources.overrides.max_sites
                          : null,
                      max_cpu_per_site:
                        typeof tenant.resources.overrides.max_cpu_per_site ===
                        "number"
                          ? tenant.resources.overrides.max_cpu_per_site
                          : null,
                      max_memory_mb_per_site:
                        typeof tenant.resources.overrides
                          .max_memory_mb_per_site === "number"
                          ? tenant.resources.overrides.max_memory_mb_per_site
                          : null,
                      max_team_members_per_site:
                        typeof tenant.resources.overrides
                          .max_team_members_per_site === "number"
                          ? tenant.resources.overrides.max_team_members_per_site
                          : null,
                    }
                  : {
                      max_sites: null,
                      max_cpu_per_site: null,
                      max_memory_mb_per_site: null,
                      max_team_members_per_site: null,
                    },
                effective: isRecord(tenant.resources.effective)
                  ? {
                      max_sites:
                        typeof tenant.resources.effective.max_sites === "number"
                          ? tenant.resources.effective.max_sites
                          : 0,
                      max_cpu_per_site:
                        typeof tenant.resources.effective.max_cpu_per_site ===
                        "number"
                          ? tenant.resources.effective.max_cpu_per_site
                          : 0,
                      max_memory_mb_per_site:
                        typeof tenant.resources.effective
                          .max_memory_mb_per_site === "number"
                          ? tenant.resources.effective.max_memory_mb_per_site
                          : 0,
                      max_team_members_per_site:
                        typeof tenant.resources.effective
                          .max_team_members_per_site === "number"
                          ? tenant.resources.effective.max_team_members_per_site
                          : 0,
                    }
                  : {
                      max_sites: 0,
                      max_cpu_per_site: 0,
                      max_memory_mb_per_site: 0,
                      max_team_members_per_site: 0,
                    },
              }
            : {
                overrides: {
                  max_sites: null,
                  max_cpu_per_site: null,
                  max_memory_mb_per_site: null,
                  max_team_members_per_site: null,
                },
                effective: {
                  max_sites: 0,
                  max_cpu_per_site: 0,
                  max_memory_mb_per_site: 0,
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
            site.type === "static"
              ? site.type
              : "node",
          status: typeof site.status === "string" ? site.status : "UNKNOWN",
          tenant_id: typeof site.tenant_id === "string" ? site.tenant_id : "",
          tenant_name:
            typeof site.tenant_name === "string" ? site.tenant_name : "",
          tenant_plan:
            typeof site.tenant_plan === "string" ? site.tenant_plan : "FREE",
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
    },
  };
}

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData | Response> {
  const { user } = await requireUser(request);
  if (user.role !== "admin") return redirect("/app");

  const errors: string[] = [];
  const [appsRes, usersRes, tenantsRes, sitesRes, healthRes] =
    await Promise.all([
      apiFetchAuthed(request, "/api/admin/panel-apps"),
      apiFetchAuthed(request, "/api/admin/users"),
      apiFetchAuthed(request, "/api/admin/tenants"),
      apiFetchAuthed(request, "/api/admin/sites"),
      apiFetchAuthed(request, "/api/admin/coolify/health"),
    ]);

  const appsPayload = await safeJson(appsRes);
  const usersPayload = await safeJson(usersRes);
  const tenantsPayload = await safeJson(tenantsRes);
  const sitesPayload = await safeJson(sitesRes);
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
  if (!sitesRes.ok) {
    errors.push(messageFrom(sitesPayload, "Could not load sites."));
  }
  if (!healthRes.ok) {
    errors.push(messageFrom(healthPayload, "Could not load Coolify health."));
  }

  const usersData = parseUsers(usersPayload);
  const tenantsData = parseTenants(tenantsPayload);
  const sitesData = parseSites(sitesPayload);

  return {
    panelApps: parsePanelApps(appsPayload),
    users: usersData.users,
    tenants: tenantsData.tenants,
    sites: sitesData.sites,
    planCatalog: tenantsData.planCatalog,
    adminEmails: usersData.adminEmails,
    stats: {
      ...usersData.stats,
      total_tenants: tenantsData.stats.total_tenants,
      active_tenants: tenantsData.stats.active_tenants,
      total_sites: sitesData.stats.total_sites,
      unassigned_sites: sitesData.stats.unassigned_sites,
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
  if (user.role !== "admin") return redirect("/app");

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
          is_active: String(formData.get("is_active") || "true") === "true",
          max_sites: nullableNumberField(formData, "max_sites"),
          max_cpu_per_site: nullableNumberField(formData, "max_cpu_per_site"),
          max_memory_mb_per_site: nullableNumberField(
            formData,
            "max_memory_mb_per_site",
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
    return { ok: true, message: "Tenant plan updated." };
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
        cpu_limit: optionalNumberField(formData, "cpu_limit"),
        memory_mb: optionalNumberField(formData, "memory_mb"),
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

  return { ok: false, error: "Unknown action." };
}

export default function AdminPage() {
  const {
    panelApps,
    users,
    tenants,
    sites,
    planCatalog,
    adminEmails,
    stats,
    coolifyHealth,
    errors,
  } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const navigation = useNavigation();
  const [query, setQuery] = React.useState("");
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
  const currentSiteId =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("site_id") || "")
      : "";

  const search = query.trim().toLowerCase();
  const filteredUsers = search
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
          .includes(search),
      )
    : users;
  const filteredTenants = search
    ? tenants.filter((tenant) =>
        [tenant.name, tenant.slug, tenant.plan]
          .join(" ")
          .toLowerCase()
          .includes(search),
      )
    : tenants;
  const filteredSites = search
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
          .includes(search),
      )
    : sites;
  const createSiteAssignableUsers = users.filter(
    (user) =>
      !createSiteTenantId ||
      user.role === "admin" ||
      user.tenant_id === createSiteTenantId,
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
            Admin Console
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Platform control
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Control live runtime config, bootstrap customers, manage plans and
            resource limits, and create or assign sites from one place.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              ? "Coolify API reachable"
              : "Coolify API needs attention"
          }
        >
          {coolifyHealth.ok
            ? `Checked ${coolifyHealth.tried.join(", ")} successfully.`
            : `${coolifyHealth.error || "The Coolify API check failed."} Tried: ${coolifyHealth.tried.join(", ")}`}
        </Banner>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              User bootstrap
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Create users
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Provision admins directly, or create customer users with a new or
              existing workspace.
            </p>
          </div>
          <Form
            method="post"
            className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"
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
                    {tenant.name} ({tenant.plan})
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
              Create user
            </button>
          </Form>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.04 }}
          className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Site provisioning
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Create sites
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Spin up a site under any tenant, cap its resources, and optionally
              assign an owner immediately.
            </p>
          </div>
          <Form
            method="post"
            className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <input type="hidden" name="intent" value="create-site" />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                name="tenant_id"
                className={fieldClassName}
                required
                value={createSiteTenantId}
                onChange={(event) => setCreateSiteTenantId(event.target.value)}
              >
                <option value="" disabled>
                  Select tenant
                </option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.plan})
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
                placeholder="Repository URL"
                className={fieldClassName}
              />
              <input
                name="repo_branch"
                placeholder="Branch"
                className={fieldClassName}
              />
              <input
                name="cpu_limit"
                type="number"
                min="0.1"
                step="0.1"
                placeholder="CPU limit"
                className={fieldClassName}
              />
              <input
                name="memory_mb"
                type="number"
                min="128"
                step="128"
                placeholder="Memory (MB)"
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
            <p className="text-xs text-white/45">
              Owner choices are filtered to admins plus users already inside
              the selected tenant.
            </p>
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
        </motion.section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {panelApps.map((app, index) => (
          <motion.section
            key={app.uuid}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: index * 0.04 }}
            className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
                  {app.target}
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {app.label}
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  {app.name}
                  {app.base_directory ? ` · ${app.base_directory}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(app.status)}`}
              >
                {app.status || "unknown"}
              </span>
            </div>

            {app.fqdn ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/40">
                  <Globe className="h-4 w-4" />
                  Public endpoints
                </div>
                <div className="break-all text-xs font-mono text-white/70">
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
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                >
                  {currentIntent === "restart-panel-app" &&
                  currentTarget === app.target ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Restart app
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
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
                >
                  {currentIntent === "redeploy-panel-app" &&
                  currentTarget === app.target ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Force redeploy
                </button>
              </Form>
            </div>

            <Form
              method="post"
              className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <input type="hidden" name="intent" value="upsert-env" />
              <input type="hidden" name="target" value={app.target} />
              <div className="text-sm font-semibold text-white">
                Add env var
              </div>
              <input
                name="key"
                placeholder="GITHUB_OAUTH_CLIENT_ID"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-white/25"
                required
              />
              <textarea
                name="value"
                rows={3}
                placeholder="Value"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-white/25"
                required
              />
              <EnvFlags />
              <button
                type="submit"
                disabled={
                  navigation.state !== "idle" &&
                  currentIntent === "upsert-env" &&
                  currentTarget === app.target &&
                  !currentKey
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {navigation.state !== "idle" &&
                currentIntent === "upsert-env" &&
                currentTarget === app.target &&
                !currentKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add variable
              </button>
            </Form>

            <div className="mt-5 space-y-3">
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
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/45">
                  No environment variables found.
                </div>
              )}
            </div>
          </motion.section>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.08 }}
        className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Tenants and plans
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Manage plans and resource caps
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Adjust customer plans, suspend workspaces, and override quotas
              without touching the database.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/60">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users, tenants, sites"
              className="w-64 bg-transparent text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>

        <div className="mt-6 space-y-4">
          {filteredTenants.length > 0 ? (
            filteredTenants.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                planCatalog={planCatalog}
                isUpdating={
                  currentIntent === "update-tenant" &&
                  currentTenantId === tenant.id
                }
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/45">
              No tenants matched that search.
            </div>
          )}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.1 }}
        className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Site inventory
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Assign existing sites
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Claim orphaned sites, add collaborators, and inspect tenant
            allocation at a glance.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {filteredSites.length > 0 ? (
            filteredSites.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                users={users}
                isAssigning={
                  currentIntent === "assign-site" && currentSiteId === site.id
                }
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/45">
              No sites matched that search.
            </div>
          )}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.12 }}
        className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              User directory
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Manage users
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Existing admin emails:{" "}
              {adminEmails.length ? adminEmails.join(", ") : "none"}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
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
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/45">
              No users matched that search.
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

const fieldClassName =
  "rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/25";

const primaryButtonClassName =
  "inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60";

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
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : tone === "warn"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-red-400/25 bg-red-400/10 text-red-100";

  return (
    <div className={`rounded-[28px] border px-5 py-4 text-sm ${className}`}>
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
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/75">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
          {icon}
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
          {label}
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-white">
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
    <div className="flex flex-wrap gap-2 text-xs text-white/70">
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
    <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="font-mono text-sm font-semibold text-white">
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
          <textarea
            name="value"
            defaultValue={env.value}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-white/25"
          />
        ) : (
          <input
            name="value"
            defaultValue={env.value}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-white/25"
          />
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <EnvFlags defaults={env} />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isBusy && currentIntent === "upsert-env"}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
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
          className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-3.5 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/15 disabled:opacity-60"
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
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/65">
      {children}
    </span>
  );
}

function UserRow({
  user,
  tenants,
  isUpdating,
  isChangingPassword,
}: {
  user: AdminUser;
  tenants: AdminTenant[];
  isUpdating: boolean;
  isChangingPassword: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-white">{user.name}</div>
        <Badge>{user.role}</Badge>
        <Badge>{user.is_active ? "active" : "suspended"}</Badge>
      </div>
      <div className="mt-2 text-sm text-white/60">{user.email}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
        <span>Tenant: {user.tenant_name || "No tenant"}</span>
        <span>Sites: {user.site_memberships}</span>
        <span>Last login: {formatDate(user.last_login_at)}</span>
        <span>Created: {formatDate(user.created_at)}</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.95fr]">
        <Form
          method="post"
          className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <input type="hidden" name="intent" value="update-user" />
          <input type="hidden" name="user_id" value={user.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="name"
              defaultValue={user.name}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/25"
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
                  {tenant.name} ({tenant.plan})
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
          className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <input type="hidden" name="intent" value="set-password" />
          <input type="hidden" name="user_id" value={user.id} />
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
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
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
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

function TenantRow({
  tenant,
  planCatalog,
  isUpdating,
}: {
  tenant: AdminTenant;
  planCatalog: PlanCatalogItem[];
  isUpdating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-white">{tenant.name}</div>
        <Badge>{tenant.plan}</Badge>
        <Badge>{tenant.is_active ? "active" : "suspended"}</Badge>
        <Badge>{tenant.slug}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
        <span>Users: {tenant.usage.users}</span>
        <span>Sites: {tenant.usage.sites}</span>
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
          label="CPU / site"
          base={tenant.resources.effective.max_cpu_per_site}
          overrideValue={tenant.resources.overrides.max_cpu_per_site}
        />
        <ResourceCard
          label="Memory / site"
          base={tenant.resources.effective.max_memory_mb_per_site}
          overrideValue={tenant.resources.overrides.max_memory_mb_per_site}
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
        className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
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
            name="max_cpu_per_site"
            type="number"
            min="0.1"
            step="0.1"
            defaultValue={tenant.resources.overrides.max_cpu_per_site ?? ""}
            placeholder={`Base: ${tenant.resources.effective.max_cpu_per_site}`}
            className={fieldClassName}
          />
          <input
            name="max_memory_mb_per_site"
            type="number"
            min="128"
            step="128"
            defaultValue={
              tenant.resources.overrides.max_memory_mb_per_site ?? ""
            }
            placeholder={`Base: ${tenant.resources.effective.max_memory_mb_per_site}`}
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
        <p className="text-xs text-white/45">
          Leave a quota field blank to remove the override and fall back to the
          plan default.
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
          Save tenant plan
        </button>
      </Form>
    </div>
  );
}

function SiteRow({
  site,
  users,
  isAssigning,
}: {
  site: AdminSite;
  users: AdminUser[];
  isAssigning: boolean;
}) {
  const assignableUsers = users.filter(
    (user) => user.role === "admin" || user.tenant_id === site.tenant_id,
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-white">{site.name}</div>
        <Badge>{site.type}</Badge>
        <Badge>{site.tenant_name}</Badge>
        <Badge>{site.tenant_plan}</Badge>
        <Badge>
          {site.is_unassigned ? "unassigned" : `${site.member_count} members`}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
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
      <Form
        method="post"
        className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">
        {resolved}
        {suffix ? ` ${suffix}` : ""}
      </div>
      <div className="mt-1 text-xs text-white/45">
        {overrideValue === null
          ? "Using plan default"
          : `Override on top of ${base}${suffix ? ` ${suffix}` : ""}`}
      </div>
    </div>
  );
}
