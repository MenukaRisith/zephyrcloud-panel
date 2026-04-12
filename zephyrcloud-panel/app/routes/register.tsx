import * as React from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  User,
} from "lucide-react";

import { apiUrl } from "../services/api.base";
import {
  PANEL_DESCRIPTION,
  PANEL_HOST,
  PANEL_NAME,
  pageTitle,
} from "../lib/brand";
import { createUserSession } from "../services/session.server";
import type { Route } from "./+types/register";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Create Workspace") },
    {
      name: "description",
      content: PANEL_DESCRIPTION,
    },
  ];
}

type ActionData =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: {
        name?: string;
        email?: string;
        password?: string;
        tenantName?: string;
      };
      formError?: string;
    };

type RegisterResponse = {
  accessToken: string;
  user: {
    id: string | number;
    email: string;
    name?: string;
    role?: string;
    tenant_id?: string | number | null;
  };
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
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const tenantName = String(formData.get("tenantName") || "").trim();

  const fieldErrors: NonNullable<ActionData & { ok: false }>["fieldErrors"] =
    {};

  if (!name) fieldErrors.name = "Name is required.";
  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email))
    fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters.";
  if (!tenantName) fieldErrors.tenantName = "Workspace name is required.";

  if (
    fieldErrors.name ||
    fieldErrors.email ||
    fieldErrors.password ||
    fieldErrors.tenantName
  ) {
    return { ok: false, fieldErrors };
  }

  try {
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        tenantName,
      }),
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        formError: payload?.message || `Request failed (${res.status})`,
      };
    }

    const result = payload as RegisterResponse;
    return createUserSession({
      request,
      accessToken: result.accessToken,
      user: {
        ...result.user,
        tenant_id: result.user.tenant_id ?? undefined,
      },
      redirectTo: "/",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Registration failed. Please try again.";
    return { ok: false, formError: message };
  }
}

export default function RegisterRoute() {
  const actionData = useActionData<ActionData>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#070A12] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute -bottom-40 left-[-8rem] h-[28rem] w-[28rem] rounded-full bg-indigo-600/12 blur-3xl" />
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
                  <div className="text-lg font-semibold tracking-tight">
                    {PANEL_NAME}
                  </div>
                  <div className="text-sm text-white/60">{PANEL_HOST}</div>
                </div>
              </div>

              <div className="mt-10 space-y-5 text-white/80">
                <Feature
                  title="Workspace-first onboarding"
                  desc="Create a tenant during signup so your deployment space is ready immediately."
                />
                <Feature
                  title="Coolify-backed operations"
                  desc="Provision WordPress, static apps, PHP, Python, and Node workloads from one panel."
                />
                <Feature
                  title="Secure sessions"
                  desc="Authentication is stored server-side in an httpOnly session cookie."
                />
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
                    <div className="text-base font-semibold tracking-tight">
                      Create workspace
                    </div>
                    <div className="text-sm text-white/60">
                      Set up your GetAeon workspace
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_12px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur">
                <div className="mb-5">
                  <h1 className="text-xl font-semibold tracking-tight">
                    Create your account
                  </h1>
                  <p className="mt-1 text-sm text-white/60">
                    Register once, create a workspace, and start managing
                    deployments.
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
                  <Field
                    label="Full Name"
                    name="name"
                    type="text"
                    placeholder="Menuka Risith"
                    icon={<User className="h-4 w-4" />}
                    error={
                      actionData?.ok === false
                        ? actionData.fieldErrors?.name
                        : undefined
                    }
                    autoComplete="name"
                    autoFocus
                  />

                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    icon={<Mail className="h-4 w-4" />}
                    error={
                      actionData?.ok === false
                        ? actionData.fieldErrors?.email
                        : undefined
                    }
                    autoComplete="email"
                  />

                  <Field
                    label="Workspace Name"
                    name="tenantName"
                    type="text"
                    placeholder="GetAeon Core"
                    icon={<Building2 className="h-4 w-4" />}
                    error={
                      actionData?.ok === false
                        ? actionData.fieldErrors?.tenantName
                        : undefined
                    }
                    autoComplete="organization"
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
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className={[
                          "w-full rounded-2xl border bg-black/25 px-10 py-3 text-sm text-white placeholder:text-white/30 outline-none",
                          "border-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/10",
                          actionData?.ok === false &&
                          actionData.fieldErrors?.password
                            ? "border-red-500/30 focus:border-red-500/40 focus:ring-red-500/10"
                            : "",
                        ].join(" ")}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute inset-y-0 right-0 grid place-items-center px-3 text-white/60 hover:text-white"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {actionData?.ok === false &&
                    actionData.fieldErrors?.password ? (
                      <p className="mt-2 text-xs text-red-200">
                        {actionData.fieldErrors.password}
                      </p>
                    ) : null}
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
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create workspace <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>

                  <p className="text-center text-sm text-white/55">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="font-medium text-white hover:text-white/80"
                    >
                      Sign in
                    </Link>
                  </p>
                </Form>
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
  const {
    label,
    name,
    type,
    placeholder,
    icon,
    error,
    autoComplete,
    autoFocus,
  } = props;

  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium text-white/80"
        htmlFor={name}
      >
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
