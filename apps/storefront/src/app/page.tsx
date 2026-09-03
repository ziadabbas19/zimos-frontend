export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-medium text-ink">Store Builder</h1>
      <p className="mt-3 max-w-md text-sm text-ink-soft">
        In production each store is served on its own subdomain or custom
        domain. For local development, open a specific store directly at{" "}
        <code className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-dark">
          /store/&lt;workspaceId&gt;
        </code>
        .
      </p>
    </main>
  );
}
