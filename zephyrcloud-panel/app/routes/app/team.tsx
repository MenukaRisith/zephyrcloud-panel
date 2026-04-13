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
import { Badge } from "~/components/ui/badge";
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
    return "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]";
  }
  if (normalized.includes("build") || normalized.includes("queue")) {
    return "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]";
  }
  return "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
}

export default function TeamPage() {
  const { sites } = useLoaderData() as LoaderData;

  return (
    <div className="space-y-4 pb-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-[var(--text-soft)]" />
              <div className="space-y-2">
                <CardTitle>Site access directory</CardTitle>
                <CardDescription>
                  Access is managed separately for each site. Open one to add members, adjust roles, or remove access.
                </CardDescription>
              </div>
            </div>
            <Badge>{sites.length} site{sites.length === 1 ? "" : "s"}</Badge>
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
                    <TableCell className="min-w-0 truncate font-medium text-[var(--foreground)]">
                      {site.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${statusClass(site.status)}`}
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
            <div className="border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-6 text-xs text-[var(--text-muted)]">
              No sites are available yet. Create a site before inviting collaborators.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
