import * as React from "react";
import {
  Form,
  Link,
  NavLink,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import {
  Boxes,
  ChevronRight,
  Command,
  Github,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { PANEL_HOST, PANEL_NAME } from "~/lib/brand";
import { cn } from "~/lib/utils";
import { badgeClass, shellInsetClass, shellPanelClass } from "~/lib/ui";
import { requireUser } from "../../services/session.server";

type LoaderData = {
  user: {
    email: string;
    name?: string;
    role?: string;
    tenant_name?: string;
  };
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: string;
};

type PageMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const { user } = await requireUser(request);
  return { user };
}

function initialsFromEmail(email: string) {
  const local = (email || "").split("@")[0] || "user";
  const parts = local.split(/[._-]+/g).filter(Boolean);
  const first = (parts[0]?.[0] || "U").toUpperCase();
  const second = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return `${first}${second}`.slice(0, 2);
}

function pageMetaFromPath(pathname: string): PageMeta {
  if (pathname === "/") {
    return {
      eyebrow: "Workspace",
      title: "Overview",
      description: "Operational health, GitHub access, and managed database state for this workspace.",
    };
  }

  if (pathname === "/sites") {
    return {
      eyebrow: "Sites",
      title: "Application inventory",
      description: "Create, filter, and manage live applications from the same control plane.",
    };
  }

  if (pathname.startsWith("/sites/")) {
    return {
      eyebrow: "Sites",
      title: "Site workspace",
      description: "Runtime controls, domains, database access, logs, and deployment history for one application.",
    };
  }

  if (pathname.startsWith("/team")) {
    return {
      eyebrow: "Workspace",
      title: "Team access",
      description: "See which sites can be shared and jump directly into collaborator management.",
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      eyebrow: "Integrations",
      title: "GitHub automation",
      description: "Control repository access and private deployment onboarding for this workspace.",
    };
  }

  if (pathname.startsWith("/admin")) {
    return {
      eyebrow: "Admin",
      title: "Platform control",
      description: "Manage panel runtime, users, tenants, quotas, and imported Coolify applications.",
    };
  }

  return {
    eyebrow: "Control plane",
    title: "Dashboard",
    description: "Monitor workspace operations and keep delivery flows moving.",
  };
}

function NavigationItem({
  item,
  onSelect,
}: {
  item: NavItem;
  onSelect?: () => void;
}) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onSelect}>
      {({ isActive }) => (
        <span
          className={cn(
            "flex items-center gap-3 rounded-md border px-3 py-3 text-sm transition",
            isActive
              ? "border-white/14 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              : "border-transparent text-white/68 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
          )}
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md border",
              isActive
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                : "border-white/10 bg-white/[0.04] text-white/60",
            )}
          >
            {item.icon}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
          {item.badge ? <span className={badgeClass}>{item.badge}</span> : null}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({
  user,
  navItems,
  onSelect,
}: {
  user: LoaderData["user"];
  navItems: NavItem[];
  onSelect?: () => void;
}) {
  return (
    <div className={cn(shellPanelClass, "panel-grid flex h-full flex-col overflow-hidden")}>
      <div className="px-5 pb-5 pt-5">
        <Link to="/" onClick={onSelect} className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-[0.08em] text-white">
              {PANEL_NAME}
            </div>
            <div className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-white/38">
              {PANEL_HOST}
            </div>
          </div>
        </Link>
      </div>

      <div className="px-5">
        <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/38">
          Workspace
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <NavigationItem key={item.to} item={item} onSelect={onSelect} />
          ))}
        </nav>
      </div>

      <div className="px-5 pt-6">
        <div className={cn(shellInsetClass, "space-y-4 p-4")}>
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/38">
              Operating mode
            </div>
            <div className="mt-2 text-sm leading-6 text-white/62">
              Build sites, wire GitHub, and manage runtime resources without leaving the panel.
            </div>
          </div>
          <Separator />
          <div className="grid gap-2 text-xs text-white/56">
            <div className="flex items-center justify-between gap-3">
              <span>Tenant</span>
              <span className="truncate text-white/78">
                {user.tenant_name || "Workspace"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Access</span>
              <span className="uppercase tracking-[0.18em] text-white/78">
                {user.role || "member"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto px-5 pb-5 pt-6">
        <div className={cn(shellInsetClass, "space-y-4 p-4")}>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
              {initialsFromEmail(user.email || "user@local")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {user.name || user.email}
              </div>
              <div className="truncate text-xs text-white/44">{user.email}</div>
            </div>
          </div>
          <Form method="post" action="/logout">
            <Button type="submit" variant="dark-secondary" className="w-full justify-center">
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user } = useLoaderData() as LoaderData;
  const location = useLocation();
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";
  const meta = pageMetaFromPath(location.pathname);

  const navItems: NavItem[] = [
    {
      to: "/",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      end: true,
    },
    {
      to: "/sites",
      label: "Sites",
      icon: <Boxes className="h-4 w-4" />,
    },
    {
      to: "/team",
      label: "Team",
      icon: <Users className="h-4 w-4" />,
    },
    {
      to: "/settings",
      label: "Integrations",
      icon: <Github className="h-4 w-4" />,
    },
  ];

  if (user.role === "admin") {
    navItems.push({
      to: "/admin",
      label: "Admin",
      icon: <ShieldCheck className="h-4 w-4" />,
      badge: "Core",
    });
  }

  return (
    <div className="min-h-screen bg-[var(--ink)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[300px] shrink-0 lg:block">
          <Sidebar user={user} navItems={navItems} />
        </aside>

        <div className="min-w-0 flex-1 space-y-5 pb-8">
          <header className={cn(shellPanelClass, "sticky top-4 z-30 px-5 py-5")}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Sheet>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/76 lg:hidden"
                        aria-label="Open navigation"
                      >
                        <Menu className="h-4 w-4" />
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-[92vw] max-w-[340px] border-r border-white/10 p-0"
                    >
                      <SheetHeader className="sr-only">
                        <SheetTitle>Navigation</SheetTitle>
                        <SheetDescription>Open workspace routes and account actions.</SheetDescription>
                      </SheetHeader>
                      <Sidebar user={user} navItems={navItems} />
                    </SheetContent>
                  </Sheet>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/34">
                      <span>{meta.eyebrow}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span className="truncate">Control plane</span>
                    </div>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
                        {meta.title}
                      </h1>
                      {isNavigating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white/46" />
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/56">
                  {meta.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/62 sm:flex">
                  <Command className="h-4 w-4 text-[var(--accent)]" />
                  <span>{user.role === "admin" ? "Admin workspace" : "Workspace user"}</span>
                </div>
                <Link to="/sites?new=1">
                  <Button variant="dark">Create site</Button>
                </Link>
                {user.role === "admin" ? (
                  <Link to="/admin">
                    <Button variant="dark-secondary">Admin console</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </header>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
