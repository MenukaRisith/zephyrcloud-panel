import { Link, useLoaderData } from "react-router";

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

export default function TeamPage() {
  const { sites } = useLoaderData() as LoaderData;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl">
        <h2 className="text-xl font-bold text-white">Team Access</h2>
        <p className="mt-1 text-sm text-white/50">
          Team sharing is managed per site. Open a site, then go to{" "}
          <span className="text-white/80">Settings - Team Access</span>.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
          Your Sites
        </h3>
        {sites.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {sites.map((site) => (
              <Link
                key={site.id}
                to={`/app/sites/${site.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/90">
                    {site.name}
                  </div>
                  <div className="text-xs text-white/50">{site.status}</div>
                </div>
                <span className="text-xs font-semibold text-white/70">
                  Manage Team
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            No sites available yet.
          </div>
        )}
      </section>
    </div>
  );
}
