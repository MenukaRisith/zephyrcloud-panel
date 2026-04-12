import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Github,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
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
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
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

  return redirect("/settings?github=disconnected");
}

function statusCopy(status: string | null, message: string | null) {
  switch (status) {
    case "connected":
      return {
        tone: "emerald",
        title: "GitHub connected",
        body: "You can now choose eligible private repositories during site setup.",
      };
    case "disconnected":
      return {
        tone: "amber",
        title: "GitHub disconnected",
        body: "Private repositories will need to be connected manually until GitHub is linked again.",
      };
    case "not-configured":
      return {
        tone: "red",
        title: "GitHub is not available yet",
        body: "GitHub sign-in has not been enabled for this workspace yet.",
      };
    case "invalid-state":
      return {
        tone: "red",
        title: "GitHub sign-in expired",
        body: "Please start the GitHub connection flow again.",
      };
    case "error":
      return {
        tone: "red",
        title: "GitHub connection failed",
        body:
          message ||
          "GitHub could not be connected right now. Please try again.",
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
      <Card className="panel-grid overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Connections
              </div>
              <CardTitle className="mt-2 text-3xl">GitHub</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Connect GitHub to choose repositories faster when creating a new site.
              </CardDescription>
            </div>
            <Link to="/sites?new=1">
              <Button variant="dark">
                New site
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {githubStatus ? (
        <div
          className={`rounded-md border px-5 py-4 text-sm ${toneClass(githubStatus.tone)}`}
        >
          <div className="font-semibold">{githubStatus.title}</div>
          <p className="mt-1 text-sm/6 opacity-85">{githubStatus.body}</p>
        </div>
      ) : null}

      {actionData?.ok === false ? (
        <div className="rounded-md border border-red-400/25 bg-red-400/10 px-5 py-4 text-sm text-red-100">
          <div className="font-semibold">Action failed</div>
          <p className="mt-1 opacity-85">{actionData.error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0"
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid size-14 place-items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] text-white">
                    <Github className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>GitHub account</CardTitle>
                    <CardDescription>
                      Used to browse repositories and connect private projects during site setup.
                    </CardDescription>
                  </div>
                </div>

                {github.connected ? (
                  <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </Badge>
                ) : (
                  <Badge className="bg-white/[0.05] text-white/74">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Not connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!github.configured ? (
                <div className="rounded-md border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-100">
                  <div className="font-semibold">GitHub sign-in is not enabled</div>
                  <p className="mt-2 leading-6 opacity-85">
                    Ask an administrator to enable GitHub sign-in for this workspace.
                  </p>
                </div>
              ) : github.connected ? (
                <>
                  <div className="rounded-md border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      {github.avatar_url ? (
                        <img
                          src={github.avatar_url}
                          alt={github.login || "GitHub avatar"}
                          className="h-14 w-14 rounded-md border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-14 place-items-center rounded-md border border-white/10 bg-white/[0.05] text-white/70">
                          <Github className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-white">
                          {github.name || github.login || "GitHub account"}
                        </div>
                        {github.login ? (
                          <div className="text-sm text-white/55">@{github.login}</div>
                        ) : null}
                      </div>
                    </div>
                    <Separator className="my-5" />
                    <div className="flex flex-wrap gap-2">
                      {github.scopes.length > 0 ? (
                        github.scopes.map((scope) => <Badge key={scope}>{scope}</Badge>)
                      ) : (
                        <Badge>OAuth scopes unavailable</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a href="/api/github/oauth/start?returnTo=/settings">
                      <Button variant="dark">
                        Reconnect
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </a>
                    <Form method="post">
                      <input type="hidden" name="intent" value="disconnect-github" />
                      <Button type="submit" variant="secondary">
                        <Unplug className="h-4 w-4" />
                        Disconnect
                      </Button>
                    </Form>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4 rounded-md border border-white/10 bg-white/[0.04] p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">
                      Connect GitHub for private repositories
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                      Once connected, you can choose from eligible repositories while creating a site.
                    </p>
                  </div>
                  <a href="/api/github/oauth/start?returnTo=/settings">
                    <Button variant="dark">
                      <Github className="h-4 w-4" />
                      Connect GitHub
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>What this enables</CardTitle>
                  <CardDescription>Private repository setup after GitHub is connected.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                1. Choose a connected private repository.
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                2. A secure repository key is prepared automatically.
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                3. Your site is created with the selected repository.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] text-white">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Prefer manual setup?</CardTitle>
                  <CardDescription>
                    You can still use a public repository or a manual deploy key.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link to="/sites?new=1">
                <Button variant="secondary">
                  Open site setup
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
