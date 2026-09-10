import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { label: "Overview", to: "/" },
  { label: "Workspaces", to: "/workspaces" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-paper-raised md:flex md:flex-col">
        <div className="px-5 py-5">
          <span className="font-display text-lg text-ink">Store Builder</span>
          <div className="mt-0.5 text-xs font-medium text-ink-soft">Platform Admin</div>
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
        <header className="flex h-16 items-center justify-end border-b border-line bg-paper-raised px-6">
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
