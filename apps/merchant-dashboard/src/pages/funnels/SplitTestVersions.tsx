import { IconDelete, IconPlus, IconShuffle } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import { formatPercentValue } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The versions of a funnel split test and each one's share of the visitors
 * (SPEC §9.6: "2 or more variations, each with a distribution percentage
 * totaling 100%"). Used when a test is started and, on a running test, to
 * add a version or move the shares.
 *
 * A is always the page itself. Every other version is a page of its own,
 * starting as a copy of the original. The backend takes up to five, keyed by
 * one letter (backend funnels/splitTests.js).
 *
 * A version a running test already has is `locked`: it cannot be taken out —
 * its visitors are pinned to it and its numbers would be lost — but its share
 * can go down to 0, which stops sending new visitors to it.
 *
 * The shares always add up to 100: moving one hands the difference to the
 * others, in proportion to what they had (`rebalanceShares`).
 */

export const MAX_VERSIONS = 5;
export const CONTROL_KEY = "A";

export interface VersionDraft {
  key: string;
  name: string;
  weight: number;
  /** The version's own page; absent for A. */
  builderData?: unknown;
  locked?: boolean;
}

const STRINGS = {
  en: {
    versions: "Versions and each one's share of visitors",
    original: "The page as it is now",
    copyHint: "A new version starts as a copy of the original page; edit it once the test is saved.",
    name: "Name (optional)",
    share: "Share of visitors for {key} (%)",
    shareSlider: "Share of visitors for {key}",
    remove: "Remove version {key}",
    add: "Add a version",
    even: "Split evenly",
    total: "Total: {total}",
    totalWrong: "Total: {total} — the shares must add up to 100%.",
    autoHint: "Move one share and the others make room: the total stays 100%.",
    lockedHint: "A version visitors have already seen stays in the test; set its share to 0 to stop showing it to new visitors.",
    barLabel: "Shares: {list}",
  },
  ar: {
    versions: "النسخ وحصة كل نسخة من الزوار",
    original: "الصفحة كما هي الآن",
    copyHint: "كل نسخة جديدة تبدأ نسخةً من الصفحة الأصلية؛ عدّلها بعد حفظ الاختبار.",
    name: "الاسم (اختياري)",
    share: "نسبة الزوار للنسخة {key} (%)",
    shareSlider: "نسبة الزوار للنسخة {key}",
    remove: "إزالة النسخة {key}",
    add: "إضافة نسخة",
    even: "تقسيم بالتساوي",
    total: "المجموع: {total}",
    totalWrong: "المجموع: {total} — يجب أن يكون مجموع النسب 100%.",
    autoHint: "غيّر نسبة فتُضبط البقية تلقائيًا: المجموع دائمًا 100%.",
    lockedHint: "النسخة التي رآها زوار تبقى في الاختبار؛ اجعل نسبتها 0 حتى لا تظهر لزوار جدد.",
    barLabel: "النسب: {list}",
  },
} satisfies Messages;

/** Shares that add up to 100, the remainder going to the first versions. */
export function evenShares(count: number): number[] {
  const base = Math.floor(100 / count);
  return Array.from({ length: count }, (_, i) => base + (i < 100 - base * count ? 1 : 0));
}

/**
 * Sets one version's share and hands the rest of the 100 to the others, in
 * proportion to what each had (evenly when they all had nothing). Whole
 * numbers; the last of the others takes what rounding leaves.
 */
export function rebalanceShares(versions: VersionDraft[], key: string, weight: number): VersionDraft[] {
  const target = Math.min(100, Math.max(0, Math.round(Number.isFinite(weight) ? weight : 0)));
  const others = versions.filter((v) => v.key !== key);
  if (others.length === 0) return versions.map((v) => (v.key === key ? { ...v, weight: 100 } : v));
  const rest = 100 - target;
  const had = others.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  let left = rest;
  const shares = new Map<string, number>();
  others.forEach((v, i) => {
    const wanted = had > 0 ? (Math.max(0, v.weight) / had) * rest : rest / others.length;
    const share = i === others.length - 1 ? left : Math.min(left, Math.round(wanted));
    left -= share;
    shares.set(v.key, share);
  });
  return versions.map((v) => ({ ...v, weight: v.key === key ? target : (shares.get(v.key) ?? 0) }));
}

function nextKey(taken: string[]): string {
  for (let code = 65; code <= 90; code += 1) {
    const key = String.fromCharCode(code);
    if (!taken.includes(key)) return key;
  }
  return "Z";
}

export const sharesTotal = (versions: VersionDraft[]) => versions.reduce((sum, v) => sum + v.weight, 0);

/** "50%" in the viewer's digits. */
const shareText = (weight: number) => formatPercentValue(weight / 100, 0);

/** The ink of each version on a shares bar, in order; the letter beside it carries the meaning. */
const SHARE_FILL = ["bg-primary", "bg-accent", "bg-success", "bg-ink-soft", "bg-danger"] as const;

/**
 * The shares as one split bar with its legend («A ٥٠٪ · B ٥٠٪»). A version at
 * 0 keeps its place in the legend and takes none of the bar. The bar always
 * runs in the reading direction, A first.
 */
export function SharesBar({
  versions,
  markKey,
  className,
}: {
  versions: ReadonlyArray<{ key: string; weight: number }>;
  /** The version drawn in bold in the legend: the winner or the leader. */
  markKey?: string | null;
  className?: string;
}) {
  const t = useT(STRINGS);
  const list = versions.map((v) => `${v.key} ${shareText(v.weight)}`).join(" · ");
  return (
    <div data-slot="funnel-shares" className={cn("min-w-0", className)}>
      <div
        role="img"
        aria-label={fmt(t.barLabel, { list })}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-paper-sunken ring-1 ring-line ring-inset"
      >
        {versions.map((v, i) =>
          v.weight > 0 ? (
            <span
              key={v.key}
              data-slot="funnel-share"
              data-i={i % SHARE_FILL.length}
              style={{ flexGrow: v.weight, flexBasis: 0 }}
              className={cn("h-full min-w-1", SHARE_FILL[i % SHARE_FILL.length])}
            />
          ) : null
        )}
      </div>
      <ul aria-hidden className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-ink-soft">
        {versions.map((v, i) => (
          <li key={v.key} className={cn("inline-flex items-center gap-1.5", markKey === v.key && "font-semibold text-ink")}>
            <span className={cn("size-2 shrink-0 rounded-full", SHARE_FILL[i % SHARE_FILL.length])} />
            <bdi>{v.key}</bdi>
            <bdi className="tabular-nums">{shareText(v.weight)}</bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VersionSharesEditor({
  versions,
  onChange,
  newPage,
  idPrefix,
}: {
  versions: VersionDraft[];
  onChange: (next: VersionDraft[]) => void;
  /** The page a new version starts from: the original page as it is now. */
  newPage: unknown;
  idPrefix: string;
}) {
  const t = useT(STRINGS);
  const total = sharesTotal(versions);
  const evenly = (list: VersionDraft[]) => {
    const shares = evenShares(list.length);
    return list.map((v, i) => ({ ...v, weight: shares[i] }));
  };
  const set = (key: string, patch: Partial<VersionDraft>) => onChange(versions.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const setShare = (key: string, raw: string) => onChange(rebalanceShares(versions, key, Number(raw) || 0));

  return (
    <fieldset data-slot="funnel-versions" className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-ink">{t.versions}</legend>
      <SharesBar versions={versions} />
      <ul className="space-y-2">
        {versions.map((v) => (
          <li key={v.key} className="rounded-2xl bg-paper-raised p-3 ring-1 ring-line">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark dark:text-primary">
                {v.key}
              </span>
              {v.key === CONTROL_KEY ? (
                <span className="min-w-0 flex-1 text-sm text-ink-soft">{t.original}</span>
              ) : (
                <Input
                  className="h-11 min-w-0 flex-1"
                  maxLength={80}
                  value={v.name}
                  placeholder={t.name}
                  aria-label={`${v.key} — ${t.name}`}
                  onChange={(e) => set(v.key, { name: e.target.value })}
                />
              )}
              {v.key !== CONTROL_KEY && !v.locked && versions.length > 2 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-11 shrink-0 rounded-full"
                  aria-label={fmt(t.remove, { key: v.key })}
                  title={fmt(t.remove, { key: v.key })}
                  onClick={() => onChange(evenly(versions.filter((x) => x.key !== v.key)))}
                >
                  <IconDelete className="size-4 text-danger" aria-hidden />
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={v.weight}
                aria-label={fmt(t.shareSlider, { key: v.key })}
                onChange={(e) => setShare(v.key, e.target.value)}
                className="h-11 min-w-0 flex-1 cursor-pointer accent-primary"
              />
              <div className="flex shrink-0 items-center gap-1">
                <Input
                  id={`${idPrefix}-share-${v.key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  className="h-11 w-20 text-end tabular-nums"
                  aria-label={fmt(t.share, { key: v.key })}
                  value={v.weight}
                  onChange={(e) => setShare(v.key, e.target.value)}
                />
                <span className="text-sm text-ink-soft" aria-hidden>
                  %
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {total !== 100 && (
        <p className="text-sm text-danger" role="alert">
          {fmt(t.totalWrong, { total: shareText(total) })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-full px-4"
          disabled={versions.length >= MAX_VERSIONS}
          onClick={() => onChange(evenly([...versions, { key: nextKey(versions.map((v) => v.key)), name: "", weight: 0, builderData: newPage }]))}
        >
          <IconPlus className="size-4" aria-hidden />
          {t.add}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4" onClick={() => onChange(evenly(versions))}>
          <IconShuffle className="size-4" aria-hidden />
          {t.even}
        </Button>
        {total === 100 && <span className="ms-auto text-xs tabular-nums text-ink-soft">{fmt(t.total, { total: shareText(total) })}</span>}
      </div>
      <p className="text-xs leading-5 text-ink-soft">
        {t.autoHint} {versions.some((v) => v.locked) ? t.lockedHint : t.copyHint}
      </p>
    </fieldset>
  );
}

/** "B" or "B · Short headline". */
export function versionLabel(v: { key: string; name?: string }, control: string): string {
  if (v.key === CONTROL_KEY) return control;
  return v.name && v.name !== v.key ? `${v.key} · ${v.name}` : v.key;
}

/** The variants as the API takes them: every version but A carries its page. */
export function toPayload(versions: VersionDraft[]) {
  return versions.map((v) => ({
    key: v.key,
    name: v.name.trim() || v.key,
    weight: v.weight,
    ...(v.key === CONTROL_KEY ? {} : { builderData: v.builderData }),
  }));
}
