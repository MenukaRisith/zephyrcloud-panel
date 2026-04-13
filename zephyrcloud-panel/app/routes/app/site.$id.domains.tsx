import { Form, useOutletContext } from "react-router";
import { Copy, Globe, Loader2 } from "lucide-react";

import {
  SiteSectionCard,
  copyToClipboard,
  domainStatusMeta,
  type SiteRouteContext,
} from "./site-detail.shared";

export default function SiteDomainsPage() {
  const { domains, dnsTarget, actionPath, isSubmitting } = useOutletContext<SiteRouteContext>();

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <SiteSectionCard title="Domains" subtitle="Connected domains and SSL status.">
        {domains.length > 0 ? (
          <div className="space-y-3">
            {domains.map((domain) => {
              const meta = domainStatusMeta(domain);
              return (
                <article
                  key={domain.id}
                  className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] px-3 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="inline-flex items-center gap-3">
                    <Globe className="h-4 w-4 text-[var(--text-soft)]" />
                    <div>
                      <div className="text-xs font-medium text-[var(--foreground)]">{domain.domain}</div>
                      {domain.status ? (
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                          {domain.status.replace(/_/g, " ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${meta.className}`}>
                    {meta.label}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">No domains connected yet.</div>
        )}
      </SiteSectionCard>

      <SiteSectionCard title="Connect domain" subtitle="Add a new domain and point DNS to the panel target.">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                DNS target
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                {dnsTarget.recordType}
              </div>
              <div className="mt-1 break-all font-mono text-xs text-[var(--foreground)]">
                {dnsTarget.value}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copyToClipboard(dnsTarget.value)}
              className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            {dnsTarget.isConfigured
              ? "Use this target when pointing your domain to this site."
              : "Use the panel host as the DNS target for this site."}
          </p>

          <Form method="post" action={actionPath} className="space-y-3">
            <input type="hidden" name="intent" value="addDomain" />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                Domain name
              </label>
              <input
                name="fqdn"
                placeholder="app.example.com"
                className="mt-2 w-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs text-[var(--foreground)]"
              />
            </div>
            <button className="inline-flex min-h-9 w-full items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)]">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add domain
            </button>
          </Form>
        </div>
      </SiteSectionCard>
    </div>
  );
}
