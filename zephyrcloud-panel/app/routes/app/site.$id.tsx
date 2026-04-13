import * as React from "react";
import {
  Form,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import {
  Boxes,
  ExternalLink,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Rocket,
  Square,
  Terminal,
} from "lucide-react";

import { resolveDnsTarget } from "~/lib/brand";
import { apiFetchAuthed } from "~/services/api.authed.server";
import {
  extractGithubRepoRef,
  normalizeStatus,
  StatusBadge,
  type DBInfo,
  type Deployment,
  type Domain,
  type EnvVar,
  type Site,
  type SiteRouteContext,
  type StatusPayload,
  type TeamInfo,
} from "./site-detail.shared";

type LoaderData = Omit<SiteRouteContext, "displayStatus" | "canManageTeam" | "currentIntent" | "isSubmitting" | "actionPath">;

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id?: string };
}): Promise<LoaderData> {
  const id = String(params.id);

  try {
    const [siteRes, depRes, domRes, dbRes, envRes, teamRes] = await Promise.all([
      apiFetchAuthed(request, `/api/sites/${id}`),
      apiFetchAuthed(request, `/api/sites/${id}/deployments`),
      apiFetchAuthed(request, `/api/sites/${id}/domains`),
      apiFetchAuthed(request, `/api/sites/${id}/database`),
      apiFetchAuthed(request, `/api/sites/${id}/envs`),
      apiFetchAuthed(request, `/api/sites/${id}/team`),
    ]);

    if (!siteRes.ok) throw new Error("Site not found");

    let db: DBInfo | null = null;
    if (dbRes.ok) {
      try {
        db = await dbRes.json();
      } catch {
        db = null;
      }
    }

    let envs: EnvVar[] = [];
    if (envRes.ok) {
      try {
        envs = await envRes.json();
      } catch {
        envs = [];
      }
    }

    let team: TeamInfo = { can_write: false, members: [], invites: [] };
    if (teamRes.ok) {
      try {
        const payload = (await teamRes.json()) as TeamInfo;
        team = {
          can_write: Boolean(payload.can_write),
          members: Array.isArray(payload.members) ? payload.members : [],
          invites: Array.isArray(payload.invites) ? payload.invites : [],
        };
      } catch {
        team = { can_write: false, members: [], invites: [] };
      }
    }

    const site = await siteRes.json();
    const deployments = await depRes.json();
    const domains = await domRes.json();

    return {
      site: (site.data || site) as Site,
      deployments: Array.isArray(deployments) ? (deployments as Deployment[]) : [],
      domains: Array.isArray(domains) ? (domains as Domain[]) : [],
      db,
      envs: Array.isArray(envs) ? envs : [],
      team,
      dnsTarget: resolveDnsTarget(request),
    };
  } catch (error) {
    console.error("Loader Error:", error);
    throw new Response("Failed to load site data", { status: 500 });
  }
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id?: string };
}) {
  const id = String(params.id);
  const fd = await request.formData();
  const intent = String(fd.get("intent") || "");

  try {
    if (intent === "deploy") {
      await apiFetchAuthed(request, `/api/sites/${id}/deploy`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "deploy_force") {
      await apiFetchAuthed(request, `/api/sites/${id}/deploy?force=true`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "restart") {
      await apiFetchAuthed(request, `/api/sites/${id}/restart`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "start") {
      await apiFetchAuthed(request, `/api/sites/${id}/start`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "stop") {
      await apiFetchAuthed(request, `/api/sites/${id}/stop`, {
        method: "POST",
      });
      return null;
    }

    if (intent === "addDomain") {
      const domain = String(fd.get("fqdn") || "")
        .trim()
        .toLowerCase();
      if (!domain) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      return null;
    }

    if (intent === "createEnv") {
      const key = String(fd.get("key") || "").trim();
      const value = String(fd.get("value") || "");
      const is_preview = fd.get("is_preview") === "on";
      const is_multiline = fd.get("is_multiline") === "on";
      const is_shown_once = fd.get("is_shown_once") === "on";
      const is_buildtime = fd.get("is_buildtime") === "on";
      const is_literal = fd.get("is_literal") === "on";
      if (!key) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/envs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          value,
          is_preview,
          is_multiline,
          is_shown_once,
          is_buildtime,
          is_literal,
        }),
      });
      return null;
    }

    if (intent === "deleteEnv") {
      const key = String(fd.get("key") || "").trim();
      if (!key) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/envs/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      return null;
    }

    if (intent === "addTeamMember") {
      const email = String(fd.get("email") || "")
        .trim()
        .toLowerCase();
      const role = String(fd.get("role") || "viewer");
      if (!email) return null;

      await apiFetchAuthed(request, `/api/sites/${id}/team/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: role === "editor" ? "editor" : "viewer",
        }),
      });
      return null;
    }

    if (intent === "removeTeamMember") {
      const memberId = String(fd.get("member_id") || "").trim();
      if (!memberId) return null;

      await apiFetchAuthed(
        request,
        `/api/sites/${id}/team/members/${encodeURIComponent(memberId)}`,
        {
          method: "DELETE",
        },
      );
      return null;
    }

    if (intent === "revokeTeamInvite") {
      const inviteId = String(fd.get("invite_id") || "").trim();
      if (!inviteId) return null;

      await apiFetchAuthed(
        request,
        `/api/sites/${id}/team/invites/${encodeURIComponent(inviteId)}`,
        {
          method: "DELETE",
        },
      );
      return null;
    }
  } catch (error) {
    console.error("Action Error:", error);
    return null;
  }

  return null;
}

export default function SiteLayoutRoute() {
  const { site, deployments, domains, db, envs, team, dnsTarget } = useLoaderData() as LoaderData;
  const nav = useNavigation();
  const location = useLocation();
  const statusFetcher = useFetcher<StatusPayload>();
  const isSubmitting = nav.state === "submitting";
  const currentIntent = String(nav.formData?.get("intent") || "");
  const [liveStatus, setLiveStatus] = React.useState<string>(site.status);
  const canManageTeam = Boolean(team.can_write);
  const actionPath = `/sites/${site.id}`;

  const isRestarting =
    isSubmitting &&
    (currentIntent === "restart" ||
      currentIntent === "deploy" ||
      currentIntent === "deploy_force" ||
      currentIntent === "start");

  React.useEffect(() => {
    if (statusFetcher.data?.ok) {
      setLiveStatus(statusFetcher.data.status);
    }
  }, [statusFetcher.data]);

  React.useEffect(() => {
    if (!isSubmitting) return;
    if (
      currentIntent === "deploy" ||
      currentIntent === "deploy_force" ||
      currentIntent === "restart" ||
      currentIntent === "start"
    ) {
      setLiveStatus("PROVISIONING");
    }
  }, [currentIntent, isSubmitting]);

  React.useEffect(() => {
    if (statusFetcher.state === "idle" && !statusFetcher.data) {
      statusFetcher.load(`/sites/${site.id}/status`);
    }

    const pollInterval =
      liveStatus === "PROVISIONING" || liveStatus === "BUILDING" || isRestarting ? 3000 : 10000;

    const interval = window.setInterval(() => {
      if (document.hidden || statusFetcher.state !== "idle") return;
      statusFetcher.load(`/sites/${site.id}/status`);
    }, pollInterval);

    return () => window.clearInterval(interval);
  }, [site.id, liveStatus, isRestarting, statusFetcher]);

  const displayStatus = isRestarting ? "PROVISIONING" : liveStatus;
  const repoRef = site.repo_url ? extractGithubRepoRef(site.repo_url) : null;
  const repoHref = repoRef ? `https://github.com/${repoRef}` : null;
  const primaryDomain = (site.primaryDomain || domains[0]?.domain || "").trim();
  const liveSiteUrl = primaryDomain
    ? primaryDomain.startsWith("http://") || primaryDomain.startsWith("https://")
      ? primaryDomain
      : `https://${primaryDomain}`
    : "";
  const wpAdminUrl =
    site.type === "wordpress" && liveSiteUrl ? `${liveSiteUrl.replace(/\/$/, "")}/wp-admin` : "";

  const context: SiteRouteContext = {
    site,
    deployments,
    domains,
    db,
    envs,
    team,
    dnsTarget,
    displayStatus,
    canManageTeam,
    currentIntent,
    isSubmitting,
    actionPath,
  };

  return (
    <div className="pb-10">
      <section className="-mx-4 sticky top-14 z-20 mb-6 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-4 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-xl font-semibold tracking-tight text-[var(--foreground)]">
                {site.name}
              </h2>
              <StatusBadge status={displayStatus} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                <span className="uppercase tracking-[0.18em] text-[11px]">{site.type}</span>
              </span>
              {primaryDomain ? (
                <a
                  href={liveSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[var(--foreground)]"
                >
                  <Globe className="h-4 w-4" />
                  {primaryDomain}
                </a>
              ) : null}
              {site.repo_url ? (
                <a
                  href={repoHref || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[var(--foreground)]"
                >
                  <Terminal className="h-4 w-4" />
                  <span>{repoRef || site.repo_url}</span>
                  <span className="text-[var(--text-soft)]">({site.repo_branch || "main"})</span>
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {wpAdminUrl ? (
              <a
                href={wpAdminUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--line-strong)]"
              >
                <ExternalLink className="h-4 w-4" />
                WP Admin
              </a>
            ) : null}

            {canManageTeam ? (
              <>
                {normalizeStatus(displayStatus) === "STOPPED" ? (
                  <Form method="post" action={actionPath}>
                    <input type="hidden" name="intent" value="start" />
                    <button
                      disabled={isSubmitting}
                      className="inline-flex min-h-9 items-center gap-2 border border-[var(--success)] bg-[var(--success-soft)] px-3 text-xs font-medium text-[var(--success)]"
                    >
                      <Play className="h-4 w-4" />
                      Start
                    </button>
                  </Form>
                ) : (
                  <Form method="post" action={actionPath}>
                    <input type="hidden" name="intent" value="stop" />
                    <button
                      disabled={isSubmitting}
                      className="inline-flex min-h-9 items-center gap-2 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 text-xs font-medium text-[var(--danger)]"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </button>
                  </Form>
                )}

                <Form method="post" action={actionPath}>
                  <input type="hidden" name="intent" value="deploy" />
                  <button className="inline-flex min-h-9 items-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)]">
                    {isSubmitting && currentIntent === "deploy" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Publish
                  </button>
                </Form>

                <Form method="post" action={actionPath}>
                  <input type="hidden" name="intent" value="deploy_force" />
                  <button className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--foreground)]">
                    {isSubmitting && currentIntent === "deploy_force" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Rebuild
                  </button>
                </Form>

                <Form method="post" action={actionPath}>
                  <input type="hidden" name="intent" value="restart" />
                  <button className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--foreground)]">
                    {isSubmitting && currentIntent === "restart" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Restart
                  </button>
                </Form>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <Outlet context={context} key={location.pathname} />
    </div>
  );
}
