import { Form, useFetcher, useOutletContext, useSearchParams } from "react-router";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";

import { Textarea } from "~/components/ui/textarea";
import {
  EnvRow,
  SiteSectionCard,
  type SiteRouteContext,
  type SiteSettingsSection,
} from "./site-detail.shared";

type EnvUploadFetcherData =
  | { ok: true; imported: number }
  | { ok: false; error: string };

function getSettingsSection(value: string | null): SiteSettingsSection {
  if (value === "access" || value === "danger") return value;
  return "configuration";
}

export default function SiteSettingsPage() {
  const [searchParams] = useSearchParams();
  const { site, envs, team, storages, canManageTeam, actionPath, currentIntent, isSubmitting } =
    useOutletContext<SiteRouteContext>();
  const envUploadFetcher = useFetcher<EnvUploadFetcherData>();
  const currentSection = getSettingsSection(searchParams.get("section"));

  const teamMembers = Array.isArray(team.members) ? team.members : [];
  const teamInvites = Array.isArray(team.invites) ? team.invites : [];
  const isUploadingEnvFile =
    envUploadFetcher.state === "loading" || envUploadFetcher.state === "submitting";

  return (
    <div className="space-y-8">
      {currentSection === "configuration" ? (
        <SiteSectionCard title="Configuration" subtitle="Manage secure keys and runtime values for this site.">
          <div className="space-y-4">
            {site.type === "node" || site.type === "python" ? (
              <Form
                method="post"
                action={actionPath}
                className="space-y-4 border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <input type="hidden" name="intent" value="updateBuildSettings" />
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Install Command
                    </label>
                    <input
                      name="install_command"
                      placeholder="npm ci"
                      defaultValue={site.install_command ?? ""}
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Build Command
                    </label>
                    <input
                      name="build_command"
                      placeholder="npm run build"
                      defaultValue={site.build_command ?? ""}
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Start Command
                    </label>
                    <input
                      name="start_command"
                      placeholder="npm start"
                      defaultValue={site.start_command ?? ""}
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                    />
                  </div>
                  <div className="self-end">
                    <button
                      disabled={!canManageTeam || isSubmitting}
                      className="inline-flex min-h-9 items-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)] disabled:opacity-60"
                    >
                      {isSubmitting && currentIntent === "updateBuildSettings" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Save
                    </button>
                  </div>
                </div>
              </Form>
            ) : null}

            <div className="space-y-4 border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    Persistent storage
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    Each mount gets its own named Docker volume in Coolify. The assigned size is tracked against your workspace storage pool.
                  </p>
                </div>
                {storages ? (
                  <div className="border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-right">
                    <div className="text-xs font-semibold text-[var(--foreground)]">
                      {storages.usage.assigned_gb} GB assigned
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {storages.usage.remaining_gb} GB left of {storages.limits.max_storage_gb_total} GB
                    </div>
                  </div>
                ) : null}
              </div>

              {canManageTeam ? (
                <Form method="post" action={actionPath} className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
                  <input type="hidden" name="intent" value="createStorage" />
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Mount path
                    </label>
                    <input
                      name="mount_path"
                      placeholder={site.type === "wordpress" ? "/var/www/html/uploads" : "/app/uploads"}
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Size (GB)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      name="size_gb"
                      defaultValue={1}
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                    />
                  </div>
                  <div className="self-end">
                    <button className="inline-flex min-h-9 items-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)]">
                      {isSubmitting && currentIntent === "createStorage" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add volume
                    </button>
                  </div>
                </Form>
              ) : (
                <div className="text-xs leading-5 text-[var(--text-muted)]">
                  Volume changes are only available to editors and workspace owners.
                </div>
              )}

              <div className="space-y-3">
                {storages?.items.length ? (
                  storages.items.map((storage) => (
                    <article
                      key={storage.id}
                      className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-[var(--foreground)]">{storage.mount_path}</div>
                        <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                          {storage.volume_name} · {storage.size_gb} GB
                          {storage.is_default ? " · default" : ""}
                        </div>
                      </div>
                      {canManageTeam && !storage.is_default ? (
                        <Form
                          method="post"
                          action={actionPath}
                          onSubmit={(event) => {
                            if (!confirm("Remove this persistent volume?")) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="intent" value="deleteStorage" />
                          <input type="hidden" name="storage_id" value={storage.id} />
                          <button className="inline-flex min-h-9 items-center gap-2 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 text-xs text-[var(--danger)]">
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </Form>
                      ) : (
                        <span className="border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {storage.is_default ? "Required" : "Managed"}
                        </span>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-muted)]">
                    No persistent folders configured yet.
                  </div>
                )}
              </div>
            </div>

            {canManageTeam ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <envUploadFetcher.Form
                  method="post"
                  action={actionPath}
                  encType="multipart/form-data"
                  className="space-y-4 border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
                >
                  <input type="hidden" name="intent" value="importEnvFile" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Upload env file
                    </div>
                    <input
                      type="file"
                      name="env_file"
                      accept=".env,text/plain"
                      required
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] file:mr-3 file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--foreground)]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_literal" defaultChecked />
                      Literal
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_preview" />
                      Preview
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_shown_once" />
                      Shown once
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_buildtime" />
                      Build-time
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      disabled={isUploadingEnvFile}
                      className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--foreground)] disabled:opacity-60"
                    >
                      {isUploadingEnvFile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Import
                    </button>
                    {envUploadFetcher.data?.ok ? (
                      <span className="text-xs text-[var(--success)]">
                        Imported {envUploadFetcher.data.imported} variables.
                      </span>
                    ) : null}
                    {envUploadFetcher.data && !envUploadFetcher.data.ok ? (
                      <span className="text-xs text-[var(--danger)]">
                        {envUploadFetcher.data.error}
                      </span>
                    ) : null}
                  </div>
                </envUploadFetcher.Form>

                <Form
                  method="post"
                  action={actionPath}
                  className="space-y-4 border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
                >
                  <input type="hidden" name="intent" value="createEnv" />
                  <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Key
                      </label>
                      <input
                        name="key"
                        placeholder="API_KEY"
                        className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Value
                      </label>
                      <Textarea
                        name="value"
                        placeholder="secret_value_123"
                        rows={2}
                        className="mt-2 min-h-10 bg-[var(--surface)] font-mono"
                      />
                    </div>
                    <div className="self-end">
                      <button className="inline-flex min-h-9 items-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)]">
                        {isSubmitting && currentIntent === "createEnv" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_literal" defaultChecked />
                      Literal
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_preview" />
                      Preview
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_multiline" />
                      Multiline
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_shown_once" />
                      Shown once
                    </label>
                    <label className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                      <input type="checkbox" name="is_buildtime" />
                      Build-time
                    </label>
                  </div>
                </Form>
              </div>
            ) : (
              <div className="text-xs leading-5 text-[var(--text-muted)]">
                Configuration is only visible to editors and workspace owners.
              </div>
            )}

            <div className="space-y-3">
              {envs.length > 0 ? (
                envs.map((env, index) => <EnvRow key={`${env.key}-${index}`} env={env} actionPath={actionPath} />)
              ) : (
                <div className="text-xs text-[var(--text-muted)]">No configuration added yet.</div>
              )}
            </div>
          </div>
        </SiteSectionCard>
      ) : null}

      {currentSection === "access" ? (
        <SiteSectionCard title="Access" subtitle="Invite collaborators and adjust per-site roles.">
          <div className="space-y-6">
            {canManageTeam ? (
              <Form
                method="post"
                action={actionPath}
                className="border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <input type="hidden" name="intent" value="addTeamMember" />
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Member email
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="user@example.com"
                      className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      Role
                    </label>
                    <select
                      name="role"
                      defaultValue="viewer"
                      className="mt-2 min-h-9 w-full border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)]"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                  </div>
                  <div className="self-end">
                    <button className="inline-flex min-h-9 items-center gap-2 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-foreground)]">
                      {isSubmitting && currentIntent === "addTeamMember" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add member
                    </button>
                  </div>
                </div>
              </Form>
            ) : (
              <div className="text-xs leading-5 text-[var(--text-muted)]">
                You currently have view-only access to team settings.
              </div>
            )}

            <div className="space-y-6">
              <section>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  Members
                </div>
                <div className="mt-3 space-y-3">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member) => (
                      <article
                        key={member.id}
                        className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-[var(--foreground)]">
                            {member.name || member.email}
                          </div>
                          <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{member.email}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            {member.role}
                          </span>
                          {canManageTeam ? (
                            <Form
                              method="post"
                              action={actionPath}
                              onSubmit={(event) => {
                                if (!confirm("Remove this member from the site?")) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="intent" value="removeTeamMember" />
                              <input type="hidden" name="member_id" value={member.id} />
                              <button className="inline-flex min-h-9 items-center gap-2 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 text-xs text-[var(--danger)]">
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            </Form>
                          ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">No members added yet.</div>
                  )}
                </div>
              </section>

              <section>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  Pending access
                </div>
                <div className="mt-3 space-y-3">
                  {teamInvites.length > 0 ? (
                    teamInvites.map((invite) => (
                      <article
                        key={invite.id}
                        className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-[var(--foreground)]">
                            {invite.email}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">Role: {invite.role}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            {invite.status}
                          </span>
                          {canManageTeam ? (
                            <Form
                              method="post"
                              action={actionPath}
                              onSubmit={(event) => {
                                if (!confirm("Revoke this invite?")) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="intent" value="revokeTeamInvite" />
                              <input type="hidden" name="invite_id" value={invite.id} />
                              <button className="inline-flex min-h-9 items-center gap-2 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 text-xs text-[var(--danger)]">
                                <Trash2 className="h-4 w-4" />
                                Revoke
                              </button>
                            </Form>
                          ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">No pending invitations.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </SiteSectionCard>
      ) : null}

      {currentSection === "danger" ? (
        <SiteSectionCard title="Danger zone" subtitle="High-risk actions stay isolated from routine site management.">
          <div className="flex flex-col gap-4 border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--danger)]">Delete site</div>
              <p className="mt-2 text-xs leading-5 text-[var(--danger)]">
                Permanently remove this site and its domains. This cannot be undone.
              </p>
            </div>
            <Form
              method="post"
              action={actionPath}
              onSubmit={(event) => {
                if (!confirm("Delete this site permanently?")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="deleteSite" />
              <button
                disabled={!canManageTeam || isSubmitting}
                className="inline-flex min-h-9 items-center justify-center border border-[var(--danger)] bg-[var(--danger)] px-3 text-xs font-medium text-white disabled:opacity-50"
              >
                {isSubmitting && currentIntent === "deleteSite" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </Form>
          </div>
        </SiteSectionCard>
      ) : null}
    </div>
  );
}
