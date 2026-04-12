import * as React from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Shield } from "lucide-react";

import type { ApiError, LoginRequest, LoginResponse } from "../services/api.client";
import { apiUrl } from "../services/api.base";
import { PANEL_DESCRIPTION, PANEL_HOST, PANEL_NAME, pageTitle } from "../lib/brand";
import { createUserSession } from "../services/session.server";
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
  const redirectTo = String(formData.get("redirectTo") || "/app");

  const fieldErrors: ActionData extends infer T ? any : never = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email))
    fieldErrors.email = "Enter a valid email address.";
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
    <div className="min-h-screen bg-[#070A12] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="grid w-full max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2"
        >
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
            className="hidden lg:block"
          >
            <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold tracking-tight">{PANEL_NAME}</div>
                  <div className="text-sm text-white/60">{PANEL_HOST}</div>
                </div>
              </div>

              <div className="mt-10 space-y-5 text-white/80">
                <Feature
                  title="One-click operations"
                  desc="Trigger deploys, restarts, and recovery workflows without leaving the control plane."
                />
                <Feature
                  title="Domains and routing"
                  desc="Connect custom domains, keep ingress aligned, and inspect rollout state quickly."
                />
                <Feature
                  title="Logs and configuration"
                  desc="Inspect runtime logs, manage environment variables, and debug customer apps faster."
                />
              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-sm font-medium text-white/80">Security note</div>
                <div className="mt-1 text-sm text-white/60">
                  Use strong passwords and keep editor access limited to operators who actually deploy.
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="flex items-center justify-center"
          >
            <div className="w-full max-w-md">
              <div className="mb-6 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold tracking-tight">{PANEL_NAME}</div>
                    <div className="text-sm text-white/60">Sign in to continue</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_12px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur">
                <div className="mb-5">
                  <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
                  <p className="mt-1 text-sm text-white/60">
                    Log in to manage applications, domains, and deployments across GetAeon.
                  </p>
                </div>

                {actionData?.ok === false && actionData.formError ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                    role="alert"
                  >
                    {actionData.formError}
                  </motion.div>
                ) : null}

                <Form method="post" className="space-y-4">
                  <input type="hidden" name="redirectTo" value="/app" />

                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    icon={<Mail className="h-4 w-4" />}
                    error={
                      actionData?.ok === false ? actionData.fieldErrors?.email : undefined
                    }
                    autoComplete="email"
                    autoFocus
                  />

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Password
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/60">
                        <Lock className="h-4 w-4" />
                      </div>

                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="********"
                        autoComplete="current-password"
                        className={[
                          "w-full rounded-2xl border bg-black/25 px-10 py-3 text-sm text-white placeholder:text-white/30 outline-none",
                          "border-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/10",
                          actionData?.ok === false && actionData.fieldErrors?.password
                            ? "border-red-500/30 focus:border-red-500/40 focus:ring-red-500/10"
                            : "",
                        ].join(" ")}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute inset-y-0 right-0 grid place-items-center px-3 text-white/60 hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {actionData?.ok === false && actionData.fieldErrors?.password ? (
                      <p className="mt-2 text-xs text-red-200">
                        {actionData.fieldErrors.password}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        name="remember"
                        className="h-4 w-4 rounded border-white/20 bg-black/30 text-white"
                      />
                      Remember me
                    </label>

                    <Link
                      to="/forgot-password"
                      className="text-sm text-white/70 hover:text-white"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    whileHover={{ y: -1 }}
                    type="submit"
                    disabled={isSubmitting}
                    className={[
                      "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                      "bg-white text-black hover:bg-white/90",
                      "disabled:cursor-not-allowed disabled:opacity-70",
                    ].join(" ")}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>

                  <p className="text-center text-sm text-white/55">
                    Need a workspace?{" "}
                    <Link
                      to="/register"
                      className="font-medium text-white hover:text-white/80"
                    >
                      Create an account
                    </Link>
                  </p>
                </Form>
              </div>

              <div className="mt-6 text-center text-xs text-white/45">
                (c) {new Date().getFullYear()} {PANEL_NAME}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-white/60">{desc}</div>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  icon: React.ReactNode;
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const { label, name, type, placeholder, icon, error, autoComplete, autoFocus } =
    props;

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/80" htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/60">
          {icon}
        </div>
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={[
            "w-full rounded-2xl border bg-black/25 px-10 py-3 text-sm text-white placeholder:text-white/30 outline-none",
            "border-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/10",
            error
              ? "border-red-500/30 focus:border-red-500/40 focus:ring-red-500/10"
              : "",
          ].join(" ")}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
