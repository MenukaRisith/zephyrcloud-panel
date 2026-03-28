// app/routes/app/layout.tsx
import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigation, useLoaderData, Form } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Globe,
  Database,
  Boxes,
  Users,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Search,
  Bell,
  Shield,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { requireUser } from "../../services/session.server";

type LoaderData = {
  user: {
    email: string;
    name?: string;
    role?: string;
    tenant_name?: string;
  };
};

export async function loader({ request }: { request: Request }): Promise<LoaderData> {
  const { user } = await requireUser(request);

  // DEV: log user data
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[app layout loader] user:", user);
  }

  return { user };
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: string;
};

const NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: "/app/sites", label: "Sites", icon: <Boxes className="h-4 w-4" /> },
  { to: "/app/domains", label: "Domains", icon: <Globe className="h-4 w-4" /> },
  { to: "/app/databases", label: "Databases", icon: <Database className="h-4 w-4" /> },
  { to: "/app/team", label: "Team", icon: <Users className="h-4 w-4" />, badge: "Optional" },
  { to: "/app/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromEmail(email: string) {
  const name = (email || "").split("@")[0] || "U";
  const parts = name.split(/[._-]+/g).filter(Boolean);
  const first = (parts[0]?.[0] || "U").toUpperCase();
  const second = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return `${first}${second}`.slice(0, 2);
}

function pageTitleFromPath(pathname: string) {
  if (pathname === "/app") return "Overview";
  if (pathname.startsWith("/app/sites")) return "Sites";
  if (pathname.startsWith("/app/domains")) return "Domains";
  if (pathname.startsWith("/app/databases")) return "Databases";
  if (pathname.startsWith("/app/team")) return "Team";
  if (pathname.startsWith("/app/settings")) return "Settings";
  return "Dashboard";
}

export default function AppLayout() {
  const { user } = useLoaderData() as LoaderData;

  const location = useLocation();
  const nav = useNavigation();
  const isNavigating = nav.state !== "idle";
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const title = pageTitleFromPath(location.pathname);

  return (
    <div className="min-h-screen bg-[#070A12] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-indigo-600/18 blur-3xl" />
        <div className="absolute -bottom-40 right-[-10rem] h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarOpen ? (
            <motion.aside
              key="sidebar"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-white/10 bg-white/5 backdrop-blur lg:block"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between px-5 py-5">
                  <Link to="/app" className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight">ZephyrCloud</div>
                      <div className="text-xs text-white/55">Tenant Dashboard</div>
                    </div>
                  </Link>

                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="rounded-xl p-2 text-white/60 hover:bg-white/5 hover:text-white"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>

                <nav className="px-3">
                  <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Workspace
                  </div>
                  <div className="space-y-1">
                    {NAV.map((item) => (
                      <NavItemLink key={item.to} item={item} />
                    ))}
                  </div>
                </nav>

                <div className="mt-auto border-t border-white/10 p-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-sm font-semibold">
                      {initialsFromEmail(user?.email || "user@local")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white/90">
                        {user?.name || user?.email || "User"}
                      </div>
                      <div className="truncate text-xs text-white/55">{user?.role || "member"}</div>
                    </div>

                    <Form method="post" action="/logout">
                      <button
                        type="submit"
                        className="rounded-xl p-2 text-white/60 hover:bg-white/5 hover:text-white"
                        aria-label="Log out"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </Form>
                  </div>

                  <div className="mt-3 flex items-center justify-between px-1 text-xs text-white/45">
                    <span>Need help?</span>
                    <Link
                      to="/app/support"
                      className="inline-flex items-center gap-1 text-white/70 hover:text-white"
                    >
                      <LifeBuoy className="h-3.5 w-3.5" /> Support
                    </Link>
                  </div>
                </div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070A12]/60 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:px-6">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 text-white/75 hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>

              {!sidebarOpen ? (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white lg:inline-flex"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                  Menu
                </button>
              ) : null}

              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-sm font-semibold tracking-tight">{title}</div>
                <ChevronRight className="h-4 w-4 text-white/25" />
                <div className="truncate text-sm text-white/60">{user?.tenant_name ?? "Workspace"}</div>
              </div>

              <div className="ml-auto hidden w-full max-w-sm lg:block">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/45">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    placeholder="Search sites, domains…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:ring-4 focus:ring-white/10"
                  />
                </div>
              </div>

              <button
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>

            <AnimatePresence>
              {isNavigating ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-[2px] w-full bg-white/15"
                >
                  <motion.div
                    initial={{ x: "-30%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
                    className="h-full w-1/3 bg-white/60"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="min-w-0"
            >
              <Outlet />
            </motion.div>
          </main>

          <footer className="border-t border-white/10 bg-white/5">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-white/45 lg:px-6">
              <span>© {new Date().getFullYear()} ZephyrCloud</span>
              <div className="flex items-center gap-4">
                <Link to="/app/status" className="hover:text-white">
                  Status
                </Link>
                <Link to="/app/docs" className="hover:text-white">
                  Docs
                </Link>
                <Link to="/app/support" className="hover:text-white">
                  Support
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#070A12]/70 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-4 gap-1 px-2 py-2">
          <MobileNav to="/app" label="Home" icon={<LayoutDashboard className="h-4 w-4" />} end />
          <MobileNav to="/app/sites" label="Sites" icon={<Boxes className="h-4 w-4" />} />
          <MobileNav to="/app/domains" label="Domains" icon={<Globe className="h-4 w-4" />} />
          <MobileNav to="/app/databases" label="DB" icon={<Database className="h-4 w-4" />} />
        </div>
      </div>

      <AnimatePresence>
        {isNavigating ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-20 right-4 z-40 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 backdrop-blur md:inline-flex"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
          isActive
            ? "border border-white/12 bg-white/10 text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        )
      }
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10 group-hover:bg-white/10">
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
          {item.badge}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 text-white/25 opacity-0 transition group-hover:opacity-100" />
    </NavLink>
  );
}

function MobileNav({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs transition",
          isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
        )
      }
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
