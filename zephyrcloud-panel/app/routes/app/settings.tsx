import { Form, Link, redirect, useActionData, useLoaderData, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Github, KeyRound, ShieldAlert, ShieldCheck, Unplug } from "lucide-react";

import { apiFetchAuthed } from "~/services/api.authed.server";
import { PANEL_NAME } from "~/lib/brand";

type GithubConnectionData = {
  configured: boolean;
  connected: boolean;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
  scopes: string[];
};

type LoaderData = {
  github: GithubConnectionData;
};

type ActionData = {
  ok: false;
  error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseConnection(payload: unknown): GithubConnectionData {
  if (!isRecord(payload)) {
    return { configured: false, connected: false, scopes: [] };
  }

  return {
    configured: Boolean(payload.configured),
    connected: Boolean(payload.connected),
    login: typeof payload.login === "string" ? payload.login : undefined,
    name: typeof payload.name === "string" ? payload.name : null,
    avatar_url:
      typeof payload.avatar_url === "string" ? payload.avatar_url : null,
    scopes: Array.isArray(payload.scopes)
      ? payload.scopes.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

export async function loader({ request }: { request: Request }): Promise<LoaderData> {
  try {
    const res = await apiFetchAuthed(request, "/api/github/connection", {
      method: "GET",
    });
    const payload = await res.json().catch(() => null);
    return { github: parseConnection(payload) };
  } catch {
    return { github: { configured: false, connected: false, scopes: [] } };
  }
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<ActionData | Response> {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "disconnect-github") {
    return { ok: false, error: "Unknown action." };
  }

  const res = await apiFetchAuthed(request, "/api/github/connection", {
    method: "DELETE",
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      payload && typeof payload.message === "string"
        ? payload.message
        : "Could not disconnect GitHub.";

    return { ok: false, error: message };
  }

  return redirect("/app/settings?github=disconnected");
}

function statusCopy(status: string | null, message: string | null) {
  switch (status) {
    case "connected":
      return {
        tone: "emerald",
        title: "GitHub connected",
        body: "Private repository automation is ready. You can now deploy private Node.js repos without pasting deploy keys manually.",
      };
    case "disconnected":
      return {
        tone: "amber",
        title: "GitHub disconnected",
        body: "The platform no longer has GitHub access for future private-repo automation from this account.",
      };
    case "not-configured":
      return {
        tone: "red",
        title: "GitHub automation is not configured",
        body: "Set the GitHub OAuth client credentials on the panel before using one-click private repository onboarding.",
      };
    case "invalid-state":
      return {
        tone: "red",
        title: "GitHub sign-in expired",
        body: "The GitHub callback state did not match. Start the connection flow again.",
      };
    case "error":
      return {
        tone: "red",
        title: "GitHub connection failed",
        body: message || "GitHub could not be connected. Check the app configuration and repository permissions, then try again.",
      };
    default:
      return null;
  }
}

function toneClass(tone: string) {
  switch (tone) {
    case "emerald":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "amber":
      return "border-amber-400/25 bg-amber-400/10 text-amber-100";
    case "red":
      return "border-red-400/25 bg-red-400/10 text-red-100";
  }
}

export default function SettingsPage() {
  const { github } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const [searchParams] = useSearchParams();

  const githubStatus = statusCopy(
    searchParams.get("github"),
    searchParams.get("github_message"),
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
            Integrations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Personal automation
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Connect GitHub once and let {PANEL_NAME} add private-repository deploy
            keys for you during Git-backed app creation.
          </p>
        </div>

        <Link
          to="/app/sites?new=1"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Open Site Creator
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {githubStatus ? (
        <div
          className={`rounded-[28px] border px-5 py-4 text-sm ${toneClass(githubStatus.tone)}`}
        >
          <div className="font-semibold">{githubStatus.title}</div>
          <p className="mt-1 text-sm/6 opacity-85">{githubStatus.body}</p>
        </div>
      ) : null}

      {actionData?.ok === false ? (
        <div className="rounded-[28px] border border-red-400/25 bg-red-400/10 px-5 py-4 text-sm text-red-100">
          <div className="font-semibold">Action failed</div>
          <p className="mt-1 opacity-85">{actionData.error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-3xl bg-white/10 text-white ring-1 ring-white/10">
                <Github className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  GitHub account
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/55">
                  Used for private repository discovery and automatic deploy-key
                  registration.
                </p>
              </div>
            </div>

            {github.connected ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                <ShieldAlert className="h-3.5 w-3.5" />
                Not connected
              </div>
            )}
          </div>

          {!github.configured ? (
            <div className="mt-6 rounded-[24px] border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-100">
              <div className="font-semibold">Panel-side setup still required</div>
              <p className="mt-2 leading-6 opacity-85">
                Add `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`
                to the panel before one-click private repo onboarding can work.
              </p>
            </div>
          ) : github.connected ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center gap-4">
                  {github.avatar_url ? (
                    <img
                      src={github.avatar_url}
                      alt={github.login || "GitHub avatar"}
                      className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
                      <Github className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {github.name || github.login || "GitHub account"}
                    </div>
                    {github.login ? (
                      <div className="text-sm text-white/55">@{github.login}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {github.scopes.length > 0 ? (
                    github.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
                      >
                        {scope}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                      OAuth scopes unavailable
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href="/api/github/oauth/start?returnTo=/app/settings"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Reconnect GitHub
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Form method="post">
                  <input type="hidden" name="intent" value="disconnect-github" />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <Unplug className="h-4 w-4" />
                    Disconnect
                  </button>
                </Form>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/20 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-base font-semibold text-white">
                  Connect GitHub to automate private repos
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                  After you connect, the panel can list your repos, generate the
                  SSH deploy key, add it to GitHub, and provision the site in one
                  flow.
                </p>
              </div>
              <a
                href="/api/github/oauth/start?returnTo=/app/settings"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <Github className="h-4 w-4" />
                Connect GitHub
              </a>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6"
        >
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  What happens automatically
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  Private repo onboarding after GitHub is connected.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                1. You choose a private repository you administer.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                2. The panel generates a read-only Coolify deploy key.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                3. The panel adds that key to GitHub and provisions the app.
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Fallback remains available
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  Manual deploy-key mode still works if you do not want to
                  connect GitHub.
                </p>
              </div>
            </div>

            <Link
              to="/app/sites?new=1"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Open site creation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
