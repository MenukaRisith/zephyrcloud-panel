import { useOutletContext } from "react-router";

import {
  DeploymentStatusIcon,
  SiteSectionCard,
  type SiteRouteContext,
} from "./site-detail.shared";

export default function SiteDeploymentsPage() {
  const { deployments } = useOutletContext<SiteRouteContext>();

  return (
    <SiteSectionCard
      title="Deployment history"
      subtitle="Recent publishes, rebuilds, and background updates."
    >
      {deployments.length > 0 ? (
        <div className="space-y-3">
          {deployments.map((deployment) => (
            <article
              key={deployment.id}
              className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] px-3 py-3 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
                  <DeploymentStatusIcon status={deployment.status} />
                  {deployment.commit_message || "Published from the dashboard"}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  <span>{deployment.commit_hash?.substring(0, 7) || "---"}</span>
                  <span>{new Date(deployment.created_at || "").toLocaleString()}</span>
                  <span>{deployment.triggered_by || "User"}</span>
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {deployment.status.replace(/_/g, " ")}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--text-muted)]">No updates yet.</div>
      )}
    </SiteSectionCard>
  );
}
