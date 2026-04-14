import { Form, useOutletContext } from "react-router";
import { ExternalLink, Globe, RefreshCw, Rocket, Terminal } from "lucide-react";

import {
  ActionRow,
  DeploymentStatusIcon,
  SiteSectionCard,
  type SiteRouteContext,
} from "./site-detail.shared";

export default function SiteOverviewPage() {
  const { site, deployments, domains, canManageTeam, actionPath } =
    useOutletContext<SiteRouteContext>();

  const latestDeployment = deployments[0];
  const primaryDomain = (site.primaryDomain || domains[0]?.domain || "").trim();
  const liveSiteUrl = primaryDomain
    ? primaryDomain.startsWith("http://") || primaryDomain.startsWith("https://")
      ? primaryDomain
      : `https://${primaryDomain}`
    : "";

  return (
    <div className="space-y-6">
      <SiteSectionCard title="Quick actions" subtitle="Common publishing and operational tasks.">
        {canManageTeam ? (
          <div className="space-y-3">
            <Form method="post" action={actionPath}>
              <input type="hidden" name="intent" value="deploy" />
              <ActionRow label="Publish changes" icon={<Rocket className="h-4 w-4" />} />
            </Form>
            <Form method="post" action={actionPath}>
              <input type="hidden" name="intent" value="deploy_force" />
              <ActionRow label="Rebuild and publish" icon={<RefreshCw className="h-4 w-4" />} />
            </Form>
            <Form method="post" action={actionPath}>
              <input type="hidden" name="intent" value="restart" />
              <ActionRow label="Restart service" icon={<RefreshCw className="h-4 w-4" />} />
            </Form>
          </div>
        ) : (
          <div className="text-xs leading-5 text-[var(--text-muted)]">
            Editing actions are available to editors and workspace owners.
          </div>
        )}
      </SiteSectionCard>

      <SiteSectionCard
        title="Latest deployment"
        subtitle={
          latestDeployment?.created_at
            ? new Date(latestDeployment.created_at).toLocaleString()
            : "No history yet"
        }
      >
        {latestDeployment ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
              <DeploymentStatusIcon status={latestDeployment.status} />
              {latestDeployment.status.replace(/_/g, " ")}
            </div>
            <div className="text-xs leading-5 text-[var(--text-muted)]">
              {latestDeployment.commit_message || "Published from the dashboard"}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              <span>{latestDeployment.commit_hash?.substring(0, 7) || "---"}</span>
              <span>{latestDeployment.triggered_by || "User"}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">No updates yet.</div>
        )}
      </SiteSectionCard>

      <SiteSectionCard title="Details" subtitle="Core connection and service context.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <Globe className="h-3.5 w-3.5" />
              Primary domain
            </div>
            <div className="mt-2 text-xs text-[var(--foreground)]">
              {primaryDomain ? (
                <a
                  href={liveSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[var(--accent)]"
                >
                  {primaryDomain}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                "Not connected"
              )}
            </div>
          </div>

          <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
              <Terminal className="h-3.5 w-3.5" />
              Internal host
            </div>
            <div className="mt-2 font-mono text-xs text-[var(--foreground)]">
              {site.id.split("-")[0]}-app
            </div>
          </div>
        </div>
      </SiteSectionCard>
    </div>
  );
}
