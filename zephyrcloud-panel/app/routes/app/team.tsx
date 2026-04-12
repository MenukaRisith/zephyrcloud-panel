import { Link, useLoaderData } from "react-router";
import { ArrowRight, Users } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { apiFetchAuthed } from "~/services/api.authed.server";

type TeamSite = {
  id: string;
  name: string;
  status: string;
};

type LoaderData = {
  sites: TeamSite[];
};

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const res = await apiFetchAuthed(request, "/api/sites");
  if (!res.ok) {
    return { sites: [] };
  }

  const payload = (await res.json()) as TeamSite[];
  return {
    sites: Array.isArray(payload) ? payload : [],
  };
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("run")) return "Running";
  if (normalized.includes("build") || normalized.includes("queue")) return "Processing";
  if (normalized.includes("error") || normalized.includes("fail")) return "Needs attention";
  if (normalized.includes("stop")) return "Stopped";
  return status || "Unknown";
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("run")) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }
  if (normalized.includes("build") || normalized.includes("queue")) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "border-red-400/20 bg-red-400/10 text-red-100";
  }
  return "border-white/10 bg-white/[0.05] text-white/74";
}

export default function TeamPage() {
  const { sites } = useLoaderData() as LoaderData;

  return (
    <div className="space-y-6 pb-10">
      <Card className="panel-grid overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                Team
              </div>
              <CardTitle className="mt-2 text-3xl">Site access</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Access is managed separately for each site. Open any site to add members, adjust roles, or remove access.
              </CardDescription>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60">
              {sites.length} site{sites.length === 1 ? "" : "s"} ready to manage
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Your sites</CardTitle>
              <CardDescription>Open a site to manage members and invitations.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sites.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="min-w-0">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">{site.name}</div>
                        <div className="mt-1 text-xs text-white/46">Site details</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${statusClass(site.status)}`}
                      >
                        {statusLabel(site.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/sites/${site.id}`}>
                        <Button variant="secondary" className="justify-center">
                          Manage team
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-white/52">
              No sites are available yet. Create a site before inviting collaborators.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
