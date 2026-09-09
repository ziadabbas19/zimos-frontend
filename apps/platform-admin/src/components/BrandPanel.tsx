const FILLED_CELLS = new Set([
  "0-0", "1-2", "2-4", "3-1", "4-3", "5-0", "5-5", "6-2", "1-5", "3-4",
]);

export function BrandPanel() {
  const cols = 6;
  const rows = 7;
  const cellSize = 34;
  const gap = 8;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;
      const filled = FILLED_CELLS.has(key);
      cells.push(
        <rect
          key={key}
          x={c * (cellSize + gap)}
          y={r * (cellSize + gap)}
          width={cellSize}
          height={cellSize}
          rx={6}
          className={filled ? "fill-accent" : "fill-white/10"}
        />
      );
    }
  }

  return (
    <div className="relative hidden overflow-hidden bg-ink px-12 py-16 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between dark:bg-primary-dark">
      <div className="relative z-10">
        <span className="font-display text-lg tracking-tight">Store Builder</span>
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
          Platform Admin
        </span>
      </div>

      <div className="relative z-10 max-w-sm">
        <h1 className="font-display text-4xl font-medium leading-[1.15]">
          A clear view across every store on the platform.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-white/70">
          Internal tooling for the Store Builder team — not a merchant-facing surface.
        </p>
      </div>

      <svg
        className="pointer-events-none absolute -bottom-16 -right-16 opacity-90"
        width={cols * (34 + 8)}
        height={rows * (34 + 8)}
        viewBox={`0 0 ${cols * (34 + 8)} ${rows * (34 + 8)}`}
        aria-hidden="true"
      >
        {cells}
      </svg>
    </div>
  );
}
