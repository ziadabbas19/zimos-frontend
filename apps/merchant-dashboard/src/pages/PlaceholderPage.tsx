export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line text-center">
      <h1 className="font-display text-xl font-medium text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        This section isn't built yet — it's next up on the roadmap.
      </p>
    </div>
  );
}
