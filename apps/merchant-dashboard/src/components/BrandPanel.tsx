const FILLED_CELLS = new Set([
  "2-1", "2-2", "3-4", "4-1", "4-5", "5-3", "6-0", "6-4", "1-3", "0-5",
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
    <div className="relative hidden overflow-hidden bg-primary-dark px-12 py-16 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
      <div className="relative z-10">
        <span className="font-display text-lg tracking-tight">Store Builder</span>
      </div>

      <div className="relative z-10 max-w-sm">
        <h1 className="font-display text-4xl font-medium leading-[1.15]">
          Every shelf, every price, every order — one workspace.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-white/70">
          Build your catalog, take orders by COD or online payment, and give
          your customers a store worth bookmarking.
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
