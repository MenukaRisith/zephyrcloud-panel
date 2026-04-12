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
  Github,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { PANEL_HOST, PANEL_NAME } from "~/lib/brand";
import { cn } from "~/lib/utils";
import { badgeClass, shellInsetClass } from "~/lib/ui";
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

function pageTitleFromPath(pathname: string) {
  if (pathname === "/") return "Overview";
  if (pathname === "/sites") return "Sites";
  if (pathname.startsWith("/sites/")) return "Site";
  if (pathname.startsWith("/team")) return "Team";
  if (pathname.startsWith("/settings")) return "Integrations";
  if (pathname.startsWith("/admin")) return "Admin";
  return "Dashboard";
}

function NavigationItem({ item, onSelect }: { item: NavItem; onSelect?: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onSelect}>
      {({ isActive }) => (
        <span
          className={cn(
            "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition",
            isActive
              ? "border-white/16 bg-white/10 text-white"
              : "border-transparent text-white/68 hover:border-white/10 hover:bg-white/6 hover:text-white",
          )}
        >
          <span className="shrink-0">{item.icon}</span>
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
    <div className="flex h-full flex-col">
      <div className="px-4 pb-5 pt-4">
        <Link to="/" onClick={onSelect} className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md border border-white/14 bg-white/8 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{PANEL_NAME}</div>
            <div className="truncate text-xs text-white/45">{PANEL_HOST}</div>
          </div>
        </Link>
      </div>

      <div className="px-4">
        <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/34">
          Workspace
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <NavigationItem key={item.to} item={item} onSelect={onSelect} />
          ))}
        </nav>
      </div>

      <div className="mt-auto px-4 pb-4 pt-6">
        <div className={cn(shellInsetClass, "p-4")}>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md border border-white/14 bg-white/8 text-sm font-semibold">
              {initialsFromEmail(user.email || "user@local")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {user.name || user.email}
              </div>
              <div className="truncate text-xs text-white/45">
                {user.role || "member"}
                {user.tenant_name ? ` · ${user.tenant_name}` : ""}
              </div>
            </div>
          </div>
          <Form method="post" action="/logout" className="mt-4">
            <Button
              type="submit"
              variant="dark-secondary"
              className="w-full justify-center"
            >
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isNavigating = navigation.state !== "idle";
  const title = pageTitleFromPath(location.pathname);

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

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--ink)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-black/12 lg:block">
          <Sidebar user={user} navItems={navItems} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-black/55 lg:hidden">
            <div className="absolute inset-y-0 left-0 w-[280px] border-r border-white/10 bg-[var(--ink)]">
              <div className="flex items-center justify-end px-4 pt-4">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-white/14 bg-white/8 p-2 text-white/72"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Sidebar
                user={user}
                navItems={navItems}
                onSelect={() => setMobileOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(6,8,13,0.88)] backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-md border border-white/14 bg-white/8 p-2 text-white/72 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/34">
                  <span>Control Plane</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="truncate">{title}</span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-xl font-semibold text-white">{title}</h1>
                  {isNavigating ? <Loader2 className="h-4 w-4 animate-spin text-white/45" /> : null}
                </div>
              </div>

              <div className="ml-auto hidden items-center gap-3 sm:flex">
                <Link to="/sites?new=1">
                  <Button variant="dark">Create site</Button>
                </Link>
                {user.role === "admin" ? (
                  <Link to="/admin">
                    <Button variant="dark-secondary">Admin</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <div className="px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
