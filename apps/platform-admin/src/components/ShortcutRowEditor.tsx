import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, EyeOff, GripVertical, Plus, Search, Undo2 } from "lucide-react";
import { ApiError } from "@store-builder/api-client";
import { Button, Input, cn } from "@store-builder/ui";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useNavLabel } from "@/components/shell/SidebarNav";
import { useAuth } from "@/context/AuthContext";
import { fmt, useLocale, useT, type Locale } from "@/i18n/LocaleContext";
import { commonText } from "@/lib/commonStrings";
import { getErrorMessage } from "@/lib/errors";
import { CONSOLE_SHORTCUTS, readRow, resetRow, saveRow, seedRow, shortcutsOf, type ConsoleRow, type ConsoleShortcut, type RowAnswer } from "@/lib/consoleShortcuts";

// The merchant dashboard's row editor (its pages/home/CustomizeShortcutsDialog.tsx), in the console's words. MSA, as there.
const STRINGS = {
  en: {
    title: "Customize shortcuts",
    description: "Choose what shows on your first page and in what order. Only you see this.",
    current: "Your shortcuts",
    count: "{n} of {max}",
    none: "Nothing here yet. Add a shortcut from the list.",
    add: "Add a shortcut",
    search: "Search pages",
    all: "All",
    categories: "Filter by section",
    general: "General",
    noMatch: "No page matches your search.",
    full: "You've reached the limit of {max} shortcuts. Hide one to add another.",
    reorder: "Reorder {title}",
    moveUp: "Move {title} up",
    moveDown: "Move {title} down",
    hide: "Hide {title}",
    restore: "Restore defaults",
    done: "Done",
    saved: "Shortcuts updated.",
    notAllowed: "One of these pages is no longer available to you. The list has been updated, so check it and try again.",
    movedTo: "{title} moved to position {n} of {m}.",
    added: "{title} added.",
    hidden: "{title} hidden.",
    restored: "Default shortcuts restored. Press Done to save.",
    dragHelp: "To reorder, press Space or Enter, move with the up and down arrow keys, then press Space or Enter again. Press Escape to cancel.",
    dragStart: "Picked up {title}.",
    dragOver: "{title} is over position {n} of {m}.",
    dragEnd: "{title} dropped at position {n} of {m}.",
    dragCancel: "Reordering cancelled. {title} stays where it was.",
  },
  ar: {
    title: "تخصيص الاختصارات",
    description: "اختر ما يظهر في صفحتك الأولى وترتيبه. هذا الترتيب لك وحدك.",
    current: "اختصاراتك",
    count: "{n} من {max}",
    none: "لا يوجد شيء هنا بعد. أضف اختصارًا من القائمة.",
    add: "إضافة اختصار",
    search: "ابحث في الصفحات",
    all: "الكل",
    categories: "تصفية حسب القسم",
    general: "عام",
    noMatch: "لا توجد صفحة تطابق بحثك.",
    full: "وصلت إلى الحد الأقصى وهو {max} اختصارًا. أخفِ أحدها لإضافة غيره.",
    reorder: "إعادة ترتيب {title}",
    moveUp: "تحريك {title} لأعلى",
    moveDown: "تحريك {title} لأسفل",
    hide: "إخفاء {title}",
    restore: "استعادة الافتراضي",
    done: "تم",
    saved: "تم تحديث الاختصارات.",
    notAllowed: "إحدى هذه الصفحات لم تعد متاحة لك. حدّثنا القائمة، فراجعها وحاول مرة أخرى.",
    movedTo: "نُقل {title} إلى الموضع {n} من {m}.",
    added: "أُضيف {title}.",
    hidden: "أُخفي {title}.",
    restored: "استُعيدت الاختصارات الافتراضية. اضغط «تم» للحفظ.",
    dragHelp: "لإعادة الترتيب اضغط المسافة أو Enter، ثم حرّك بسهمي أعلى وأسفل، ثم اضغط المسافة أو Enter مرة أخرى. اضغط Escape للإلغاء.",
    dragStart: "تم التقاط {title}.",
    dragOver: "{title} فوق الموضع {n} من {m}.",
    dragEnd: "وُضع {title} في الموضع {n} من {m}.",
    dragCancel: "أُلغيت إعادة الترتيب. بقي {title} في مكانه.",
  },
};

export type EditorStrings = (typeof STRINGS)["en"];

/** The bottom bar's words where they differ from the shortcuts row's. */
export const DOCK_WORDS: Record<Locale, Partial<EditorStrings>> = {
  en: {
    title: "Customize the bottom bar",
    description: "Choose the pages on the bar at the bottom of your phone, and their order. “More” always stays at the end. Only you see this.",
    current: "Your bar",
    none: "Nothing on the bar yet: only “More” shows. Add a page from the list.",
    add: "Add a page",
    full: "The bar holds {max} pages. Hide one to add another.",
    saved: "Bottom bar updated.",
    restored: "The default bar is back. Press Done to save.",
  },
  ar: {
    title: "تخصيص الشريط السفلي",
    description: "اختر الصفحات التي تظهر في الشريط أسفل شاشة هاتفك وترتيبها. يبقى «المزيد» دائمًا في آخره. هذا الترتيب لك وحدك.",
    current: "شريطك",
    none: "لا توجد صفحات في الشريط بعد: يظهر «المزيد» وحده. أضف صفحة من القائمة.",
    add: "إضافة صفحة",
    full: "يتسع الشريط لـ {max} صفحات. أخفِ إحداها لإضافة غيرها.",
    saved: "تم تحديث الشريط السفلي.",
    restored: "استُعيد الشريط الافتراضي. اضغط «تم» للحفظ.",
  },
};

const ICON_BUTTON =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-35 aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink-soft pointer-coarse:size-11";

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const normal = (text: string) => text.toLocaleLowerCase().trim();

interface RowProps {
  entry: ConsoleShortcut;
  title: string;
  index: number;
  total: number;
  onMove: (id: string, delta: -1 | 1) => void;
  onHide: (id: string) => void;
  t: EditorStrings;
}

function ShortcutRow({ entry, title, index, total, onMove, onHide, t }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const Icon = entry.icon;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-1 rounded-xl bg-paper-raised py-0.5 pe-1 ring-1 ring-line", isDragging && "relative z-10 shadow-[var(--shadow-raised)]")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={fmt(t.reorder, { title })}
        title={fmt(t.reorder, { title })}
        className={cn(ICON_BUTTON, "cursor-grab touch-none active:cursor-grabbing")}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 ps-1.5 text-sm leading-tight text-ink">{title}</span>
      <button
        type="button"
        aria-label={fmt(t.moveUp, { title })}
        title={fmt(t.moveUp, { title })}
        aria-disabled={index === 0}
        onClick={() => index > 0 && onMove(entry.id, -1)}
        className={ICON_BUTTON}
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={fmt(t.moveDown, { title })}
        title={fmt(t.moveDown, { title })}
        aria-disabled={index === total - 1}
        onClick={() => index < total - 1 && onMove(entry.id, 1)}
        className={ICON_BUTTON}
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
      <button type="button" data-shortcut-hide={entry.id} aria-label={fmt(t.hide, { title })} title={fmt(t.hide, { title })} onClick={() => onHide(entry.id)} className={ICON_BUTTON}>
        <EyeOff className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function CatalogRow({ entry, title, on, full, onToggle }: { entry: ConsoleShortcut; title: string; on: boolean; full: boolean; onToggle: (id: string) => void }) {
  const Icon = entry.icon;
  const locked = full && !on;
  const State = on ? Check : Plus;
  return (
    <li>
      <button
        type="button"
        aria-pressed={on}
        aria-disabled={locked}
        onClick={() => !locked && onToggle(entry.id)}
        className={cn(
          "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm text-ink transition-colors hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11",
          locked && "cursor-not-allowed opacity-50 hover:bg-transparent"
        )}
      >
        <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 leading-tight">{title}</span>
        <State className={cn("size-4 shrink-0", on ? "text-primary" : "text-ink-soft")} aria-hidden />
      </button>
    </li>
  );
}

function AddSection({
  entries,
  chosen,
  full,
  max,
  onToggle,
  idPrefix,
  t,
}: {
  entries: readonly ConsoleShortcut[];
  chosen: ReadonlySet<string>;
  full: boolean;
  max: number;
  onToggle: (id: string) => void;
  idPrefix: string;
  t: EditorStrings;
}) {
  const label = useNavLabel();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const groupOf = (entry: ConsoleShortcut) => entry.group ?? "";
  const categories = useMemo(() => [...new Set(entries.map(groupOf))], [entries]);
  const groupLabel = (group: string) => (group ? label(group) : t.general);

  const words = normal(query);
  const shown = entries.filter(
    (entry) => (category === null || groupOf(entry) === category) && (!words || normal(entry.label).includes(words) || normal(label(entry.label)).includes(words))
  );

  return (
    <section aria-labelledby={`${idPrefix}-add`} className="min-w-0">
      <h3 id={`${idPrefix}-add`} tabIndex={-1} className="text-sm font-semibold text-ink outline-none">
        {t.add}
      </h3>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.search} placeholder={t.search} className="ps-8" />
      </div>
      <div role="group" aria-label={t.categories} className="mt-2 flex flex-wrap gap-1.5">
        {[null, ...categories].map((value) => (
          <button
            key={value ?? "all"}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
            className={cn(
              "min-h-7 cursor-pointer rounded-full px-2.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-9",
              category === value ? "bg-primary-soft text-primary-dark ring-primary/40 dark:text-primary" : "text-ink-soft ring-line hover:bg-paper-sunken hover:text-ink"
            )}
          >
            {value === null ? t.all : groupLabel(value)}
          </button>
        ))}
      </div>
      {full && <p className="mt-2 text-xs text-ink-soft">{fmt(t.full, { max })}</p>}
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t.noMatch}</p>
      ) : (
        <div className="mt-2 space-y-3">
          {categories
            .filter((value) => shown.some((entry) => groupOf(entry) === value))
            .map((value) => (
              <div key={value || "general"}>
                <h4 className="px-2 text-xs font-semibold text-ink-soft">{groupLabel(value)}</h4>
                <ul className="mt-0.5">
                  {shown
                    .filter((entry) => groupOf(entry) === value)
                    .map((entry) => (
                      <CatalogRow key={entry.id} entry={entry} title={label(entry.label)} on={chosen.has(entry.id)} full={full} onToggle={onToggle} />
                    ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function useFocusAfterChange(root: RefObject<HTMLElement | null>) {
  const next = useRef<string | null>(null);
  // After a row left, its button with it: where the keyboard goes on.
  useLayoutEffect(() => {
    if (!next.current) return;
    root.current?.querySelector<HTMLElement>(next.current)?.focus();
    next.current = null;
  });
  return (selector: string) => {
    next.current = selector;
  };
}

export interface ShortcutRowEditorProps {
  open: boolean;
  onClose: () => void;
  row: ConsoleRow;
  answer: RowAnswer;
  /** The words that differ from the shortcuts row's; the bar's own (DOCK_WORDS) by default for it. */
  words?: Record<Locale, Partial<EditorStrings>>;
}

/**
 * A row's editor (the first page's shortcuts, the phone's bottom bar): the
 * entries this account has, in order, to reorder (drag by the grip, or the up
 * and down buttons on a phone or with a keyboard) and hide, and the pages to
 * add from. Nothing is saved until Done, as one replacement of the whole row;
 * closing any other way leaves the row as it was.
 */
export function ShortcutRowEditor({ open, onClose, row, answer, words }: ShortcutRowEditorProps) {
  const base = useT(STRINGS);
  const { locale } = useLocale();
  const own = words ?? (row === "mobileNav" ? DOCK_WORDS : undefined);
  const t: EditorStrings = { ...base, ...(own?.[locale] ?? {}) };
  const label = useNavLabel();
  const toast = useToast();
  const { user, can } = useAuth();
  const userId = user?.id ?? "";
  const idPrefix = `console-${row}`;

  const [draft, setDraft] = useState<string[]>(answer.shortcuts);
  const [touched, setTouched] = useState(false);
  // Pressed "Restore defaults" and changed nothing since: Done forgets the list instead of saving one.
  const [restoring, setRestoring] = useState(false);
  const [seen, setSeen] = useState(answer);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusAfter = useFocusAfterChange(bodyRef);
  // Escape while a row is being carried cancels the move, not the whole editor.
  const dragging = useRef(false);

  // The newest row: another device may have changed it since this page loaded.
  useEffect(() => {
    if (userId) void readRow(row, userId);
  }, [row, userId]);
  if (answer !== seen) {
    setSeen(answer);
    if (!touched) setDraft(answer.shortcuts);
  }

  const entries = shortcutsOf(
    CONSOLE_SHORTCUTS.map((entry) => entry.id),
    can,
    answer.available
  );
  const rows = shortcutsOf(draft, can, answer.available);
  const ids = rows.map((entry) => entry.id);
  const chosen = new Set(ids);
  const full = rows.length >= answer.max;
  const titleOf = (id: unknown) => {
    const entry = rows.find((candidate) => candidate.id === id);
    return entry ? label(entry.label) : "";
  };
  const positionOf = (id: unknown) => ids.indexOf(String(id)) + 1;

  function change(next: string[], message: string) {
    setDraft(next);
    setTouched(true);
    setRestoring(false);
    setStatus(message);
    setError(null);
  }

  function move(id: string, delta: -1 | 1) {
    const from = ids.indexOf(id);
    const to = from + delta;
    change(arrayMove(ids, from, to), fmt(t.movedTo, { title: titleOf(id), n: to + 1, m: ids.length }));
  }

  function hide(id: string) {
    const from = ids.indexOf(id);
    const next = ids.filter((other) => other !== id);
    change(next, fmt(t.hidden, { title: titleOf(id) }));
    const neighbour = next[from] ?? next[from - 1];
    focusAfter(neighbour ? `[data-shortcut-hide="${neighbour}"]` : `#${idPrefix}-current`);
  }

  function toggle(id: string) {
    const entry = entries.find((candidate) => candidate.id === id);
    const title = entry ? label(entry.label) : "";
    if (chosen.has(id)) change(ids.filter((other) => other !== id), fmt(t.hidden, { title }));
    else if (!full) change([...ids, id], fmt(t.added, { title }));
  }

  function restore() {
    setDraft(answer.defaults);
    setTouched(true);
    setRestoring(true);
    setStatus(t.restored);
    setError(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    releaseDrag();
    if (!over || active.id === over.id) return;
    const to = ids.indexOf(String(over.id));
    change(arrayMove(ids, ids.indexOf(String(active.id)), to), fmt(t.movedTo, { title: titleOf(active.id), n: to + 1, m: ids.length }));
  }

  // On a phone the row fills the dialog: this is the way to know the list to add from is under it.
  function goToAdd() {
    const heading = document.getElementById(`${idPrefix}-add`);
    heading?.scrollIntoView({ block: "start", behavior: "smooth" });
    heading?.focus({ preventScroll: true });
  }

  // A tick later: the Escape that cancels a move also reaches the dialog's own listener on the window.
  function releaseDrag() {
    window.setTimeout(() => {
      dragging.current = false;
    });
  }

  async function done() {
    // The same row, and no arranged list to forget: nothing to tell the server.
    if (sameList(ids, answer.shortcuts) && !(restoring && answer.customized)) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = restoring && sameList(ids, answer.defaults) ? await resetRow(row) : await saveRow(row, ids);
      seedRow(row, userId, saved);
      toast.success(t.saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "HOME_SHORTCUT_NOT_ALLOWED" ? t.notAllowed : getErrorMessage(err));
      // What this account may have lost under it: the lists above narrow to it.
      void readRow(row, userId);
    } finally {
      setSaving(false);
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const announcements: Announcements = {
    onDragStart: ({ active }) => fmt(t.dragStart, { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? fmt(t.dragOver, { title: titleOf(active.id), n: positionOf(over.id), m: ids.length }) : undefined),
    onDragEnd: ({ active, over }) => (over ? fmt(t.dragEnd, { title: titleOf(active.id), n: positionOf(over.id), m: ids.length }) : undefined),
    onDragCancel: ({ active }) => fmt(t.dragCancel, { title: titleOf(active.id) }),
  };

  const atDefault = !answer.customized && sameList(ids, answer.defaults);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!dragging.current) onClose();
      }}
      title={t.title}
      description={t.description}
      className="max-w-3xl"
      footer={
        <>
          {error && (
            <p role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="button" variant="ghost" aria-disabled={atDefault} onClick={() => !atDefault && restore()} className={cn("sm:me-auto", atDefault && "cursor-not-allowed opacity-50")}>
            <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
            {t.restore}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {commonText().cancel}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void done()}>
            {t.done}
          </Button>
        </>
      }
    >
      <div ref={bodyRef} className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby={`${idPrefix}-current`} className="min-w-0 sm:sticky sm:top-0 sm:self-start">
          <div className="flex items-center gap-2">
            <h3 id={`${idPrefix}-current`} tabIndex={-1} className="text-sm font-semibold text-ink outline-none">
              {t.current}
            </h3>
            <span className="me-auto text-xs tabular-nums text-ink-soft">{fmt(t.count, { n: rows.length, max: answer.max })}</span>
            <button
              type="button"
              onClick={goToAdd}
              className="flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary sm:hidden"
            >
              <Plus className="size-3.5" aria-hidden />
              {t.add}
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-4 text-sm text-ink-soft">{t.none}</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              accessibility={{ announcements, screenReaderInstructions: { draggable: t.dragHelp } }}
              onDragStart={() => {
                dragging.current = true;
              }}
              onDragEnd={onDragEnd}
              onDragCancel={releaseDrag}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ol className="mt-2 space-y-1">
                  {rows.map((entry, index) => (
                    <ShortcutRow key={entry.id} entry={entry} title={label(entry.label)} index={index} total={rows.length} onMove={move} onHide={hide} t={t} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>
        <AddSection entries={entries} chosen={chosen} full={full} max={answer.max} onToggle={toggle} idPrefix={idPrefix} t={t} />
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </Modal>
  );
}
