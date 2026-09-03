import { Card, CardHeader, CardTitle, CardDescription } from "@store-builder/ui";

export function OverviewPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-medium text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Platform-wide metrics (active subscriptions, trial expirations, MRR) will surface here.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>Trial, active, and canceled workspace counts.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trial expirations</CardTitle>
            <CardDescription>Stores approaching the end of their 14-day trial.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
