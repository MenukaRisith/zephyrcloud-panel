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
  tenant_name: string | null;
  tenant_slug: string | null;
  site_memberships: number;
  last_login_at: string | null;
  created_at: string;
};

type LoaderData = {
  panelApps: PanelApp[];
  users: AdminUser[];
  adminEmails: string[];
  stats: {
    total_users: number;
    active_users: number;
    admin_users: number;
  };
  coolifyHealth: {
    ok: boolean;
    tried: string[];
    error?: string;
  } | null;
  errors: string[];
};

type ActionData =
  | { ok: true; message: string }
  | { ok: false; error: string };

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
        (value): value is string => typeof value === "string" && value.trim().length > 0,
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
  if (status.includes("healthy")) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }
  if (status.includes("error") || status.includes("failed")) {
    return "border-red-400/20 bg-red-400/10 text-red-100";
  }
  return "border-amber-400/20 bg-amber-400/10 text-amber-100";
}

function parseLoader(
  panelAppsPayload: unknown,
  usersPayload: unknown,
): Pick<LoaderData, "panelApps" | "users" | "adminEmails" | "stats"> {
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
          role: (user.role === "admin" ? "admin" : "user") as
            | "admin"
            | "user",
          is_active: Boolean(user.is_active),
          tenant_name:
            typeof user.tenant_name === "string" ? user.tenant_name : null,
          tenant_slug:
            typeof user.tenant_slug === "string" ? user.tenant_slug : null,
          site_memberships:
            typeof user.site_memberships === "number" ? user.site_memberships : 0,
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
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [];

  return {
    panelApps: panelApps.filter((app) => app.uuid.length > 0),
    users: users.filter((user) => user.id.length > 0),
    adminEmails,
    stats: {
      total_users:
        typeof statsRecord.total_users === "number" ? statsRecord.total_users : 0,
      active_users:
        typeof statsRecord.active_users === "number"
          ? statsRecord.active_users
          : 0,
      admin_users:
        typeof statsRecord.admin_users === "number" ? statsRecord.admin_users : 0,
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
  const [appsRes, usersRes, healthRes] = await Promise.all([
    apiFetchAuthed(request, "/api/admin/panel-apps"),
    apiFetchAuthed(request, "/api/admin/users"),
    apiFetchAuthed(request, "/api/admin/coolify/health"),
  ]);

  const appsPayload = await safeJson(appsRes);
  const usersPayload = await safeJson(usersRes);
  const healthPayload = await safeJson(healthRes);

  if (!appsRes.ok) {
    errors.push(messageFrom(appsPayload, "Could not load panel app data."));
  }
  if (!usersRes.ok) {
    errors.push(messageFrom(usersPayload, "Could not load users."));
  }
  if (!healthRes.ok) {
    errors.push(messageFrom(healthPayload, "Could not load Coolify health."));
  }

  return {
    ...parseLoader(appsPayload, usersPayload),
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
        error: messageFrom(payload, "Could not save that environment variable."),
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
        error: messageFrom(payload, "Could not delete that environment variable."),
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
        }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return { ok: false, error: messageFrom(payload, "Could not update that user.") };
    }
    return { ok: true, message: "User updated." };
  }

  if (intent === "set-password") {
    const userId = String(formData.get("user_id") || "");
    const res = await apiFetchAuthed(
      request,
      `/api/admin/users/${encodeURIComponent(userId)}/password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: String(formData.get("password") || "") }),
      },
    );
    const payload = await safeJson(res);
    if (!res.ok) {
      return { ok: false, error: messageFrom(payload, "Could not change that password.") };
    }
    return { ok: true, message: "Password updated." };
  }

  return { ok: false, error: "Unknown action." };
}

export default function AdminPage() {
  const { panelApps, users, adminEmails, stats, coolifyHealth, errors } =
    useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const navigation = useNavigation();
  const [query, setQuery] = React.useState("");

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

  const search = query.trim().toLowerCase();
  const filteredUsers = search
    ? users.filter((user) =>
        [user.email, user.name, user.role, user.tenant_name || "", user.tenant_slug || ""]
          .join(" ")
          .toLowerCase()
          .includes(search),
      )
    : users;

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
            Edit live frontend and backend configuration, then manage panel
            users and password recovery from one place.
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

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard icon={<Server className="h-5 w-5" />} label="Panel apps" value={String(panelApps.length)} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={String(stats.total_users)} />
        <StatCard icon={<KeyRound className="h-5 w-5" />} label="Admins" value={String(stats.admin_users)} />
      </div>

      {coolifyHealth ? (
        <Banner
          tone={coolifyHealth.ok ? "success" : "warn"}
          title={coolifyHealth.ok ? "Coolify API reachable" : "Coolify API needs attention"}
        >
          {coolifyHealth.ok
            ? `Checked ${coolifyHealth.tried.join(", ")} successfully.`
            : `${coolifyHealth.error || "The Coolify API check failed."} Tried: ${coolifyHealth.tried.join(", ")}`}
        </Banner>
      ) : null}

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
                <h2 className="mt-2 text-xl font-semibold text-white">{app.label}</h2>
                <p className="mt-2 text-sm text-white/55">
                  {app.name}
                  {app.base_directory ? ` · ${app.base_directory}` : ""}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(app.status)}`}>
                {app.status || "unknown"}
              </span>
            </div>

            {app.fqdn ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/40">
                  <Globe className="h-4 w-4" />
                  Public endpoints
                </div>
                <div className="break-all text-xs font-mono text-white/70">{app.fqdn}</div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <Form method="post">
                <input type="hidden" name="intent" value="restart-panel-app" />
                <input type="hidden" name="target" value={app.target} />
                <button
                  type="submit"
                  disabled={currentIntent === "restart-panel-app" && currentTarget === app.target}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                >
                  {currentIntent === "restart-panel-app" && currentTarget === app.target ? (
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
                  disabled={currentIntent === "redeploy-panel-app" && currentTarget === app.target}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
                >
                  {currentIntent === "redeploy-panel-app" && currentTarget === app.target ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Force redeploy
                </button>
              </Form>
            </div>

            <Form method="post" className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input type="hidden" name="intent" value="upsert-env" />
              <input type="hidden" name="target" value={app.target} />
              <div className="text-sm font-semibold text-white">Add env var</div>
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
                disabled={navigation.state !== "idle" && currentIntent === "upsert-env" && currentTarget === app.target && !currentKey}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {navigation.state !== "idle" && currentIntent === "upsert-env" && currentTarget === app.target && !currentKey ? (
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
                    isBusy={currentTarget === app.target && currentKey === env.key}
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
              User directory
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Manage users</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Existing admin emails: {adminEmails.length ? adminEmails.join(", ") : "none"}
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/60">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email, name, tenant"
              className="w-64 bg-transparent text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>

        <div className="mt-6 space-y-4">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isUpdating={currentIntent === "update-user" && currentUserId === user.id}
                isChangingPassword={currentIntent === "set-password" && currentUserId === user.id}
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
      <div className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

function EnvFlags({
  defaults,
}: {
  defaults?: Partial<Pick<PanelEnv, "is_buildtime" | "is_literal" | "is_multiline" | "is_shown_once">>;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-white/70">
      <Flag name="is_buildtime" label="Build-time" checked={Boolean(defaults?.is_buildtime)} />
      <Flag name="is_literal" label="Literal" checked={defaults?.is_literal ?? true} />
      <Flag name="is_multiline" label="Multiline" checked={Boolean(defaults?.is_multiline)} />
      <Flag name="is_shown_once" label="Shown once" checked={Boolean(defaults?.is_shown_once)} />
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
      <input type="checkbox" name={name} defaultChecked={checked} className="accent-white" />
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
        <div className="font-mono text-sm font-semibold text-white">{env.key}</div>
        {env.is_buildtime ? <Badge>Build-time</Badge> : null}
        {env.has_preview ? <Badge>Preview copy</Badge> : null}
        {env.variant_count > 1 ? <Badge>{env.variant_count} variants</Badge> : null}
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
  isUpdating,
  isChangingPassword,
}: {
  user: AdminUser;
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
        <Form method="post" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/25"
            />
            <select
              name="role"
              defaultValue={user.role}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/25"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select
              name="is_active"
              defaultValue={user.is_active ? "true" : "false"}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/25"
            >
              <option value="true">Active</option>
              <option value="false">Suspended</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isUpdating}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save user
          </button>
        </Form>

        <Form method="post" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/25"
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
