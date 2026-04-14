import { Form, useOutletContext } from "react-router";
import { Copy, Globe, Loader2 } from "lucide-react";

import {
  SiteSectionCard,
  copyToClipboard,
  domainRecordType,
  domainStatusMeta,
  type SiteRouteContext,
} from "./site-detail.shared";

export default function SiteDomainsPage() {
  const { domains, dnsTarget, actionPath, isSubmitting, currentIntent } = useOutletContext<SiteRouteContext>();

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
                  <div className="min-w-0 space-y-2">
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
                    {domain.target_hostname ? (
                      <div className="space-y-1 text-[11px] text-[var(--text-muted)]">
                        <div>
                          Expected {domainRecordType(domain)} target:{" "}
                          <span className="font-mono text-[var(--foreground)]">{domain.target_hostname}</span>
                        </div>
                        {domain.verification_checked_at ? (
                          <div>
                            Last checked:{" "}
                            <span className="text-[var(--foreground)]">
                              {new Date(domain.verification_checked_at).toLocaleString()}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {domain.diagnostic_message ? (
                      <div className="text-[11px] leading-5 text-[var(--text-muted)]">
                        {domain.diagnostic_message}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${meta.className}`}>
                      {meta.label}
                    </span>
                    {String(domain.status || "").toLowerCase().includes("pending") ? (
                      <Form method="post" action={actionPath}>
                        <input type="hidden" name="intent" value="verifyDomain" />
                        <input type="hidden" name="domain_id" value={domain.id} />
                        <button
                          className="inline-flex min-h-8 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] text-[var(--foreground)]"
                          disabled={isSubmitting}
                        >
                          {isSubmitting && currentIntent === "verifyDomain" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Verify
                        </button>
                      </Form>
                    ) : null}
                    {String(domain.status || "").toLowerCase().includes("timeout") ||
                    String(domain.status || "").toLowerCase().includes("error") ? (
                      <Form method="post" action={actionPath}>
                        <input type="hidden" name="intent" value="retryDomain" />
                        <input type="hidden" name="domain_id" value={domain.id} />
                        <button
                          className="inline-flex min-h-8 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] text-[var(--foreground)]"
                          disabled={isSubmitting}
                        >
                          {isSubmitting && currentIntent === "retryDomain" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Retry
                        </button>
                      </Form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">No domains connected yet.</div>
        )}
      </SiteSectionCard>

      <SiteSectionCard title="Connect domain" subtitle="Add a new domain and point DNS to the shared target below.">
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
              ? "Point the domain here, wait for DNS to propagate, then click Verify. We will keep checking every 10 minutes for up to 2 hours."
              : "This site does not have a default hostname yet."}
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
            <button className="inline-flex min-h-9 w-full items-center justify-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)]">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add domain
            </button>
          </Form>
        </div>
      </SiteSectionCard>
    </div>
  );
}
