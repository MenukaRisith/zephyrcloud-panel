import * as React from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import type { ApiError, LoginRequest, LoginResponse } from "../services/api.client";
import { apiUrl } from "../services/api.base";
import { PANEL_DESCRIPTION, pageTitle } from "../lib/brand";
import { createUserSession } from "../services/session.server";
import { primaryCtaClass, softCardClass } from "~/lib/ui";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/login";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Login") },
    { name: "description", content: PANEL_DESCRIPTION },
  ];
}

type ActionData =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      fieldErrors?: { email?: string; password?: string };
      formError?: string;
    };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<ActionData | Response> {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirectTo") || "/");

  const fieldErrors: ActionData extends infer T ? any : never = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!password) fieldErrors.password = "Password is required.";

  if (fieldErrors.email || fieldErrors.password) {
    return { ok: false, fieldErrors };
  }

  try {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password } as LoginRequest),
    });

    if (!res.ok) {
      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      const errorPayload: ApiError = {
        status: res.status,
        message:
          payload?.message || payload?.detail || `Request failed (${res.status})`,
        code: payload?.code,
        details: payload?.details,
      };

      throw errorPayload;
    }

    const result = (await res.json()) as LoginResponse;

    if (process.env.NODE_ENV !== "production") {
      console.debug("[login] response keys:", Object.keys(result));
      console.debug("[login] result:", result);
    }

    return createUserSession({
      request,
      accessToken: result.accessToken,
      user: {
        ...result.user,
        tenant_id: result.user.tenant_id ?? undefined,
      },
      redirectTo,
    });
  } catch (err) {
    const errorPayload = err as ApiError;

    if (errorPayload?.code === "VALIDATION_ERROR" && errorPayload?.details) {
      return {
        ok: false,
        fieldErrors: errorPayload.details,
        formError: errorPayload.message || "Fix the errors and try again.",
      };
    }

    return {
      ok: false,
      formError: errorPayload?.message || "Invalid email or password.",
    };
  }
}

export default function LoginRoute() {
  const actionData = useActionData<ActionData>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <section className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className={cn(softCardClass, "w-full max-w-[440px] p-8 sm:p-10")}>
        <div className="mb-6 flex h-9 items-center">
          <img
            src="/logo-b.png"
            alt=""
            aria-hidden="true"
            className="theme-logo-light h-9 w-auto object-contain"
          />
          <img
            src="/logo-w.png"
            alt=""
            aria-hidden="true"
            className="theme-logo-dark h-9 w-auto object-contain"
          />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
          Use your workspace account to open the dashboard.
        </p>

        {actionData?.ok === false && actionData.formError ? (
          <div
            className="mt-6 border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
            role="alert"
          >
            {actionData.formError}
          </div>
        ) : null}

        <Form method="post" className="mt-8 space-y-5">
          <input type="hidden" name="redirectTo" value="/" />

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
                <Mail className="h-4 w-4" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                className={cn(
                  "w-full border border-[var(--line)] bg-[var(--surface)] px-10 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  actionData?.ok === false && actionData.fieldErrors?.email
                    ? "border-[var(--danger)] focus-visible:ring-[var(--danger)]"
                    : "",
                )}
              />
            </div>
            {actionData?.ok === false && actionData.fieldErrors?.email ? (
              <p className="text-xs text-[var(--danger)]">{actionData.fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                className={cn(
                  "w-full border border-[var(--line)] bg-[var(--surface)] px-10 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  actionData?.ok === false && actionData.fieldErrors?.password
                    ? "border-[var(--danger)] focus-visible:ring-[var(--danger)]"
                    : "",
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--foreground)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {actionData?.ok === false && actionData.fieldErrors?.password ? (
              <p className="text-xs text-[var(--danger)]">{actionData.fieldErrors.password}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(primaryCtaClass, "min-h-12 w-full py-3 text-base")}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Open dashboard <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </Form>
      </div>
    </section>
  );
}
