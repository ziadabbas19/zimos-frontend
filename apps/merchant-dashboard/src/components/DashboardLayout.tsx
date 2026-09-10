import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@store-builder/ui";
import { NAV_ITEMS } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-paper-raised md:flex md:flex-col">
        <div className="px-5 py-5">
          <Link
            to="/"
            className="font-display text-lg text-ink transition-opacity hover:opacity-80"
          >
            Zimos
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "block rounded-[0.5rem] px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary-dark",
                  isActive && "bg-primary-soft text-primary-dark"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-line px-3 py-4">
          <button
            onClick={() => logout()}
            className="cursor-pointer flex-1 rounded-[0.5rem] px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-paper-raised px-6">
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="cursor-pointer flex items-center gap-2 rounded-[0.5rem] px-2 py-1.5 text-sm font-medium text-ink hover:bg-paper"
            >
              {currentWorkspace?.name ?? "Select a store"}
              <span className="text-ink-soft">▾</span>
            </button>
            {switcherOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-[0.5rem] border border-line bg-paper-raised py-1 shadow-lg">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => {
                      selectWorkspace(workspace.id);
                      setSwitcherOpen(false);
                    }}
                    className={cn(
                      "block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-primary-soft",
                      workspace.id === currentWorkspace?.id && "font-medium text-primary-dark"
                    )}
                  >
                    {workspace.name}
                  </button>
                ))}
                <div className="my-1 border-t border-line" />
                <button
                  onClick={() => {
                    setSwitcherOpen(false);
                    navigate("/workspaces");
                  }}
                  className="cursor-pointer block w-full px-3 py-2 text-left text-sm text-primary hover:bg-primary-soft"
                >
                  + New store
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-ink-soft">
            <span>{user?.fullName ?? user?.email}</span>
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-medium text-primary-dark">
              {(user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
