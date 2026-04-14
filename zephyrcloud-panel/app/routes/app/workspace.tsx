import { Link, useLoaderData } from "react-router";
import { ArrowRight, Boxes, Database, Layers3 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CardDescription, CardTitle } from "~/components/ui/card";
import { softInsetClass } from "~/lib/ui";
import {
  parseWorkspaceUsage,
  safeJson,
  type WorkspaceUsage,
  WorkspaceUsageSection,
} from "~/lib/workspace-usage";
import { apiFetchAuthed } from "~/services/api.authed.server";
import { requireUser } from "~/services/session.server";

type LoaderData = {
  workspaceUsage: WorkspaceUsage | null;
};

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  await requireUser(request);

  try {
    const workspaceUsageRes = await apiFetchAuthed(request, "/api/sites/workspace/usage", {
      method: "GET",
    });

    const workspaceUsagePayload = workspaceUsageRes.ok
      ? await safeJson(workspaceUsageRes)
      : null;

    return {
      workspaceUsage: parseWorkspaceUsage(workspaceUsagePayload),
    };
  } catch (error) {
    console.error("Workspace usage loader error:", error);
    return { workspaceUsage: null };
  }
}

export default function WorkspaceRoute() {
  const { workspaceUsage } = useLoaderData() as LoaderData;

  return (
    <div className="space-y-4 pb-8 text-sm">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg">Usage</CardTitle>
            <CardDescription className="text-xs leading-5">
              Shared limits and current resource usage for this workspace.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/sites">
              <Button variant="secondary" size="sm">
                <Boxes className="h-3.5 w-3.5" />
                Manage sites
              </Button>
            </Link>
            <Link to="/">
              <Button size="sm">
                Overview
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {workspaceUsage ? (
          <div className="grid gap-3 md:grid-cols-3">
            <article className={`${softInsetClass} space-y-2 px-4 py-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  <Layers3 className="h-4 w-4 text-[var(--text-soft)]" />
                  Plan
                </div>
                <Badge>{workspaceUsage.plan.replaceAll("_", " ")}</Badge>
              </div>
              <div className="text-xs leading-5 text-[var(--text-muted)]">
                Resource pools are shared across every site in this workspace.
              </div>
            </article>
            <article className={`${softInsetClass} space-y-2 px-4 py-4`}>
              <div className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <Boxes className="h-4 w-4 text-[var(--text-soft)]" />
                Site capacity
              </div>
              <div className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {workspaceUsage.usage.sites_used} / {workspaceUsage.limits.max_sites}
              </div>
              <div className="text-xs leading-5 text-[var(--text-muted)]">
                {workspaceUsage.usage.sites_remaining} site
                {workspaceUsage.usage.sites_remaining === 1 ? "" : "s"} still available.
              </div>
            </article>
            <article className={`${softInsetClass} space-y-2 px-4 py-4`}>
              <div className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <Database className="h-4 w-4 text-[var(--text-soft)]" />
                Team allocation
              </div>
              <div className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {workspaceUsage.limits.max_team_members_per_site} / site
              </div>
              <div className="text-xs leading-5 text-[var(--text-muted)]">
                Maximum collaborators available on each individual site.
              </div>
            </article>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <WorkspaceUsageSection
          workspaceUsage={workspaceUsage}
          description="These pools are shared across the entire workspace, not reserved per site."
        />
        {!workspaceUsage ? (
          <div className={`${softInsetClass} px-4 py-4 text-xs leading-5 text-[var(--text-muted)]`}>
            Workspace usage is currently unavailable.
          </div>
        ) : null}
      </section>
    </div>
  );
}
