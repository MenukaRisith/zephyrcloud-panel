import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useSearchParams,
} from "react-router";
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
import { softInsetClass } from "~/lib/ui";

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
        tone: "success",
        title: "GitHub connected",
        body: "You can now choose eligible private repositories during site setup.",
      };
    case "disconnected":
      return {
        tone: "warn",
        title: "GitHub disconnected",
        body: "Private repositories will need to be connected manually until GitHub is linked again.",
      };
    case "not-configured":
      return {
        tone: "error",
        title: "GitHub is not available yet",
        body: "GitHub sign-in has not been enabled for this workspace yet.",
      };
    case "invalid-state":
      return {
        tone: "error",
        title: "GitHub sign-in expired",
        body: "Please start the GitHub connection flow again.",
      };
    case "error":
      return {
        tone: "error",
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
    case "success":
      return "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]";
    case "warn":
      return "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]";
    case "error":
      return "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]";
    default:
      return "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
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
    <div className="space-y-4 pb-8">
      {githubStatus ? (
        <div className={`border px-4 py-3 text-xs ${toneClass(githubStatus.tone)}`}>
          <div className="font-semibold">{githubStatus.title}</div>
          <p className="mt-1 text-xs/5 opacity-85">{githubStatus.body}</p>
        </div>
      ) : null}

      {actionData?.ok === false ? (
        <div className="border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger)]">
          <div className="font-semibold">Action failed</div>
          <p className="mt-1 opacity-85">{actionData.error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="h-full">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <Github className="mt-0.5 h-5 w-5 text-[var(--text-soft)]" />
                <div className="space-y-2">
                  <CardTitle>GitHub identity</CardTitle>
                  <CardDescription>
                    Used to browse repositories and connect private projects during site setup.
                  </CardDescription>
                </div>
              </div>

              {github.connected ? (
                <Badge className="border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected
                </Badge>
              ) : (
                <Badge className="border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!github.configured ? (
              <div className="border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-xs text-[var(--danger)]">
                <div className="font-semibold">GitHub sign-in is not enabled</div>
                <p className="mt-2 leading-6 opacity-85">
                  Ask an administrator to enable GitHub sign-in for this workspace.
                </p>
              </div>
            ) : github.connected ? (
              <>
                <div className={`${softInsetClass} space-y-4 px-4 py-4`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {github.avatar_url ? (
                      <img
                        src={github.avatar_url}
                        alt={github.login || "GitHub avatar"}
                        className="h-12 w-12 border border-[var(--line)] object-cover"
                      />
                    ) : (
                      <Github className="h-5 w-5 text-[var(--text-soft)]" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {github.name || github.login || "GitHub account"}
                      </div>
                      {github.login ? (
                        <div className="text-xs text-[var(--text-muted)]">@{github.login}</div>
                      ) : null}
                    </div>
                  </div>
                  <Separator />
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
                    <Button>
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
              <div className={`${softInsetClass} flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between`}>
                <div className="max-w-2xl space-y-2">
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Connect GitHub for private repositories
                  </div>
                  <p className="text-xs leading-5 text-[var(--text-muted)]">
                    Once connected, you can choose from eligible repositories while creating a site.
                  </p>
                </div>
                <a href="/api/github/oauth/start?returnTo=/settings">
                  <Button>
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--text-soft)]" />
                <div className="space-y-2">
                  <CardTitle>What this enables</CardTitle>
                  <CardDescription>Private repository setup after GitHub is connected.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-xs text-[var(--text-muted)]">
                <li className={`${softInsetClass} flex gap-3 px-4 py-4`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    01
                  </span>
                  <span>Choose a connected private repository.</span>
                </li>
                <li className={`${softInsetClass} flex gap-3 px-4 py-4`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    02
                  </span>
                  <span>A secure repository key is prepared automatically.</span>
                </li>
                <li className={`${softInsetClass} flex gap-3 px-4 py-4`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    03
                  </span>
                  <span>Your site is created with the selected repository.</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 text-[var(--text-soft)]" />
                <div className="space-y-2">
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
        </div>
      </div>
    </div>
  );
}
