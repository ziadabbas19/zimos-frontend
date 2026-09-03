import { Card, CardHeader, CardTitle, CardDescription } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";

export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium text-ink">
        Welcome back{currentWorkspace ? `, ${currentWorkspace.name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        This is where store-wide metrics (orders, revenue, confirmation queue) will live.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Orders", desc: "Track and fulfill customer orders." },
          { title: "Catalog", desc: "Manage products, variants, and offers." },
          { title: "Customers", desc: "See who's buying and manage their details." },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
