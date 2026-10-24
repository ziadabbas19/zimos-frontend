import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Input, cn } from "@store-builder/ui";
import { IconClose, IconDragHandle, IconPlus } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { valueOnDevice, withDeviceValue } from "@/lib/deviceValue";
import { useEditorLocale } from "./editorLocale";
import { useEditorScreen, useShellPartFocus } from "./editorScreen";
import { LookBlock, lookIconButtonClass } from "./theme/parts";
import {
  HEADER_ZONES,
  TEMPLATE_BOTTOM,
  addPart,
  findPart,
  hasOwnZones,
  missingParts,
  movePart,
  partId,
  readBottom,
  readColumns,
  removePart,
  templateColumns,
  withZonesOn,
  zonesOn,
  type FooterBottomPart,
  type FooterColumn,
  type FooterColumnType,
  type HeaderPart,
  type HeaderPartType,
  type HeaderZone,
  type HeaderZones,
} from "./xsShellLayout";

/**
 * The arrangement of an imported template's header and footer
 * (xsShellLayout.ts, drawn by the storefront's components/xs): which parts
 * stand in which of the template's boxes and in what order, and the footer's
 * columns and bottom line. Shown only on a store wearing a template's shell.
 *
 * Every list sorts by its grip — drag it, or pick it up with Space and move
 * it with the arrow keys — and a part goes to another box by dragging it there
 * or with its "Move to" choice. The header is arranged for the screen the
 * preview shows (a tablet and a phone take the larger screen's until arranged
 * on their own); the footer's column widths likewise.
 */

const ar = (locale: string) => locale === "ar";

const ZONE_NAMES: Record<HeaderZone, [string, string]> = {
  notice: ["Top strip — start", "الشريط العلوي — البداية"],
  links: ["Top strip — end", "الشريط العلوي — النهاية"],
  brand: ["Main bar — start", "الشريط الرئيسي — البداية"],
  menu: ["Main bar — menu", "الشريط الرئيسي — القائمة"],
  icons: ["Main bar — icons", "الشريط الرئيسي — الأيقونات"],
};

const PART_NAMES: Record<HeaderPartType, [string, string]> = {
  logo: ["Logo", "اللوجو"],
  menu: ["Menu", "القائمة"],
  search: ["Search", "البحث"],
  account: ["Account", "الحساب"],
  wishlist: ["Wish list", "المفضلة"],
  cart: ["Cart", "السلة"],
  phone: ["Phone menu button", "زر القائمة على الموبايل"],
  notice: ["Announcement", "الإعلان"],
  link: ["Link", "رابط"],
  text: ["Words", "كلام"],
  social: ["Social accounts", "حسابات التواصل"],
  track: ["Track order", "تتبع الطلب"],
  language: ["Language switch", "تبديل اللغة"],
};

const SCREEN_NAMES = { base: ["computer", "الكمبيوتر"], tablet: ["tablet", "التابلت"], mobile: ["phone", "الموبايل"] } as const;

function useXsLook(): string | null {
  const { currentWorkspace } = useWorkspace();
  const look = currentWorkspace?.themeSettings?.xsLook;
  return typeof look === "string" && look !== "" ? look : null;
}

function useListSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
}

/** A row with a grip at the start, its content, and a remove button at the end (none for what cannot go). */
function SortableRow({
  id,
  grip,
  onRemove,
  removeLabel,
  flash,
  children,
}: {
  id: string;
  grip: string;
  onRemove?: () => void;
  removeLabel: string;
  /** Just clicked on the canvas: lit for a moment. */
  flash?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      data-part-row={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1 rounded-[0.875rem] bg-paper-raised py-1.5 pe-1 ring-1 ring-line transition-shadow",
        flash && "ring-2 ring-primary",
        isDragging && "relative z-10 shadow-[var(--shadow-raised)]"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={grip}
        title={grip}
        className="flex min-h-9 w-9 cursor-grab touch-none items-center justify-center self-stretch rounded-[0.75rem] text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:w-11"
      >
        <IconDragHandle className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 space-y-1.5">{children}</div>
      {onRemove ? (
        <button type="button" aria-label={removeLabel} title={removeLabel} onClick={onRemove} className={lookIconButtonClass}>
          <IconClose className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="w-9" />
      )}
    </li>
  );
}

const selectClass = "h-9 rounded-[0.75rem] bg-paper-sunken px-2 text-xs ring-1 ring-line focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:h-11";

/** A box of the header that takes drops even when it is empty. */
function ZoneBox({ zone, children }: { zone: HeaderZone; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${zone}` });
  return (
    <div ref={setNodeRef} className={cn("min-h-11 rounded-[0.875rem] p-1 ring-1 ring-dashed ring-line", isOver && "ring-primary")}>
      {children}
    </div>
  );
}

export function HeaderLayoutBlock({ saved, onChange }: { saved: unknown; onChange: (zones: unknown, historyKey?: string) => void }) {
  const locale = useEditorLocale();
  const isAr = ar(locale);
  const look = useXsLook();
  const screen = useEditorScreen();
  const sensors = useListSensors();
  const zones = useMemo(() => zonesOn(saved, screen, look), [saved, screen, look]);
  // A part clicked on the canvas: its row into view, its words (or its grip) focused, lit for a moment.
  const focus = useShellPartFocus();
  const listRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!focus) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-part-row="${globalThis.CSS.escape(focus.id)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    (row.querySelector<HTMLElement>("input") ?? row.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
    setFlash(focus.id);
    const timer = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(timer);
  }, [focus]);
  if (!look) return null;

  const own = hasOwnZones(saved, screen);
  const set = (next: HeaderZones, key?: string) => onChange(withZonesOn(saved, screen, next, look), key);
  const name = (type: HeaderPartType) => PART_NAMES[type][isAr ? 1 : 0];
  const screenName = SCREEN_NAMES[screen][isAr ? 1 : 0];

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const overId = String(over.id);
    if (overId.startsWith("zone:")) {
      const zone = overId.slice(5) as HeaderZone;
      set(movePart(zones, String(active.id), zone, zones[zone].length));
      return;
    }
    const target = findPart(zones, overId);
    const from = findPart(zones, String(active.id));
    if (!target || !from) return;
    // Within one box, a drop takes the place of the part it lands on, either way.
    if (from.zone === target.zone) set({ ...zones, [from.zone]: arrayMove(zones[from.zone], from.index, target.index) });
    else set(movePart(zones, String(active.id), target.zone, target.index));
  }

  const patchPart = (id: string, patch: Partial<HeaderPart>, key: string) => {
    const at = findPart(zones, id);
    if (!at) return;
    set({ ...zones, [at.zone]: zones[at.zone].map((p) => (p.id === id ? { ...p, ...patch } : p)) }, `shell:header:zones:${id}:${key}`);
  };

  return (
    <LookBlock
      title={isAr ? "ترتيب الهيدر" : "Header layout"}
      hint={
        isAr
          ? `اسحب أي جزء لمكان تاني أو صندوق تاني، أو احذفه أو ضيف جديد. الترتيب ده لشاشة ${screenName}.`
          : `Drag any part to another place or box, remove it or add one. This is the layout for the ${screenName}.`
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {screen !== "base" && own && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(withZonesOn(saved, screen, null, look))}>
            {isAr ? "زي ترتيب الكمبيوتر" : "Use the computer's layout"}
          </Button>
        )}
        {saved !== undefined && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(undefined)}>
            {isAr ? "ترتيب القالب الأصلي" : "Back to the template's layout"}
          </Button>
        )}
      </div>
      <div ref={listRef} className="contents">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {HEADER_ZONES.map((zone) => (
          <section key={zone} className="space-y-1.5" aria-label={ZONE_NAMES[zone][isAr ? 1 : 0]}>
            <h4 className="text-xs font-semibold text-ink-soft">{ZONE_NAMES[zone][isAr ? 1 : 0]}</h4>
            <ZoneBox zone={zone}>
              <SortableContext items={zones[zone].map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5">
                  {zones[zone].map((part) => (
                    <SortableRow
                      key={part.id}
                      id={part.id}
                      flash={flash === part.id}
                      grip={isAr ? `اسحب: ${name(part.type)}` : `Drag: ${name(part.type)}`}
                      removeLabel={isAr ? `احذف: ${name(part.type)}` : `Remove: ${name(part.type)}`}
                      onRemove={part.type === "phone" ? undefined : () => set(removePart(zones, part.id))}
                    >
                      {part.type === "link" || part.type === "text" ? (
                        <>
                          <Input
                            value={part.label ?? ""}
                            dir="auto"
                            maxLength={80}
                            aria-label={isAr ? "الكلام" : "Words"}
                            placeholder={name(part.type)}
                            className="h-9 text-sm"
                            onChange={(e) => patchPart(part.id, { label: e.target.value }, "label")}
                          />
                          {part.type === "link" && (
                            <Input
                              value={part.href ?? ""}
                              dir="ltr"
                              maxLength={500}
                              aria-label={isAr ? "الرابط" : "Link"}
                              placeholder="/products"
                              className="h-9 text-xs"
                              onChange={(e) => patchPart(part.id, { href: e.target.value }, "href")}
                            />
                          )}
                        </>
                      ) : (
                        <p className="py-2 text-sm">{name(part.type)}</p>
                      )}
                      <select
                        aria-label={isAr ? "انقله إلى" : "Move to"}
                        className={selectClass}
                        value={zone}
                        onChange={(e) => set(movePart(zones, part.id, e.target.value as HeaderZone, zones[e.target.value as HeaderZone].length))}
                      >
                        {HEADER_ZONES.map((z) => (
                          <option key={z} value={z}>
                            {(isAr ? "في: " : "In: ") + ZONE_NAMES[z][isAr ? 1 : 0]}
                          </option>
                        ))}
                      </select>
                    </SortableRow>
                  ))}
                </ul>
              </SortableContext>
              <select
                aria-label={isAr ? "ضيف جزء هنا" : "Add a part here"}
                className={cn(selectClass, "mt-1.5 w-full")}
                value=""
                onChange={(e) => {
                  const type = e.target.value as HeaderPartType;
                  if (!type) return;
                  const part: HeaderPart =
                    type === "link"
                      ? { id: partId("link"), type, label: isAr ? "رابط جديد" : "New link", href: "/" }
                      : type === "text"
                        ? { id: partId("text"), type, label: isAr ? "كلام جديد" : "New words" }
                        : { id: type, type };
                  set(addPart(zones, zone, part));
                }}
              >
                <option value="">{isAr ? "+ ضيف جزء هنا" : "+ Add a part here"}</option>
                {[...missingParts(zones), "link" as const, "text" as const].map((type) => (
                  <option key={type} value={type}>
                    {name(type)}
                  </option>
                ))}
              </select>
            </ZoneBox>
          </section>
        ))}
      </DndContext>
      </div>
    </LookBlock>
  );
}

const COLUMN_NAMES: Record<FooterColumnType, [string, string]> = {
  group: ["Link group", "مجموعة روابط"],
  pages: ["Pages and policies", "الصفحات والسياسات"],
  brand: ["Brand", "العلامة"],
  contact: ["Contact", "التواصل"],
  newsletter: ["Newsletter", "النشرة البريدية"],
  social: ["Social accounts", "حسابات التواصل"],
  payments: ["Payment methods", "طرق الدفع"],
};

export function FooterLayoutBlock({
  columns: savedColumns,
  bottom: savedBottom,
  groups,
  showBrand,
  onChange,
}: {
  columns: unknown;
  bottom: unknown;
  /** The footer's link groups' titles, by place. */
  groups: string[];
  showBrand: boolean;
  onChange: (patch: { columns?: unknown; bottom?: unknown }, historyKey?: string) => void;
}) {
  const locale = useEditorLocale();
  const isAr = ar(locale);
  const look = useXsLook();
  const screen = useEditorScreen();
  const sensors = useListSensors();
  if (!look) return null;

  const columns = readColumns(savedColumns) ?? templateColumns(groups.length, showBrand);
  const bottom = readBottom(savedBottom) ?? TEMPLATE_BOTTOM;
  const setColumns = (next: FooterColumn[], key?: string) => onChange({ columns: next }, key);
  const setBottom = (next: FooterBottomPart[], key?: string) => onChange({ bottom: next }, key);
  const colName = (col: FooterColumn) =>
    col.type === "group" ? `${COLUMN_NAMES.group[isAr ? 1 : 0]}: ${groups[col.at ?? -1] || (isAr ? "بدون عنوان" : "untitled")}` : COLUMN_NAMES[col.type][isAr ? 1 : 0];
  const patch = (id: string, next: Partial<FooterColumn>, key: string) =>
    setColumns(columns.map((c) => (c.id === id ? { ...c, ...next } : c)), `shell:footer:columns:${id}:${key}`);
  const screenName = SCREEN_NAMES[screen][isAr ? 1 : 0];

  // What may still be added: each link group not placed, and each other kind once.
  const addable: Array<{ value: string; label: string }> = [
    ...groups.flatMap((title, at) => (columns.some((c) => c.type === "group" && c.at === at) ? [] : [{ value: `group:${at}`, label: `${COLUMN_NAMES.group[isAr ? 1 : 0]}: ${title || at + 1}` }])),
    ...(["pages", "brand", "contact", "newsletter", "social", "payments"] as const)
      .filter((type) => !columns.some((c) => c.type === type))
      .map((type) => ({ value: type, label: COLUMN_NAMES[type][isAr ? 1 : 0] })),
  ];

  const sortEnd =
    <T extends { id: string }>(list: T[], apply: (next: T[]) => void) =>
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const from = list.findIndex((x) => x.id === active.id);
      const to = list.findIndex((x) => x.id === over.id);
      if (from !== -1 && to !== -1) apply(arrayMove(list, from, to));
    };

  return (
    <LookBlock
      title={isAr ? "ترتيب الفوتر" : "Footer layout"}
      hint={
        isAr
          ? `رتّب الأعمدة بالسحب، وغيّر عرض كل عمود ومحاذاته (العرض لشاشة ${screenName}). سطر حقوق تصميم القالب ثابت بحكم ترخيصه.`
          : `Drag the columns into order and set each one's width and alignment (widths are for the ${screenName}). The template's licence credit always stays.`
      }
    >
      {(savedColumns !== undefined || savedBottom !== undefined) && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ columns: undefined, bottom: undefined })}>
          {isAr ? "ترتيب القالب الأصلي" : "Back to the template's layout"}
        </Button>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={sortEnd(columns, (next) => setColumns(next))}>
        <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {columns.map((col) => {
              const width = valueOnDevice(col.width, screen);
              return (
                <SortableRow
                  key={col.id}
                  id={col.id}
                  grip={isAr ? `اسحب: ${colName(col)}` : `Drag: ${colName(col)}`}
                  removeLabel={isAr ? `احذف: ${colName(col)}` : `Remove: ${colName(col)}`}
                  onRemove={() => setColumns(columns.filter((c) => c.id !== col.id))}
                >
                  <p className="pt-2 text-sm font-medium">{colName(col)}</p>
                  {(col.type === "contact" || col.type === "newsletter" || col.type === "social" || col.type === "payments") && (
                    <Input
                      value={col.title ?? ""}
                      dir="auto"
                      maxLength={80}
                      aria-label={isAr ? "العنوان" : "Heading"}
                      placeholder={COLUMN_NAMES[col.type][isAr ? 1 : 0]}
                      className="h-9 text-sm"
                      onChange={(e) => patch(col.id, { title: e.target.value || undefined }, "title")}
                    />
                  )}
                  {(col.type === "contact" || col.type === "newsletter" || col.type === "payments") && (
                    <textarea
                      value={col.text ?? ""}
                      dir="auto"
                      rows={3}
                      maxLength={600}
                      aria-label={isAr ? "السطور" : "Lines"}
                      placeholder={
                        col.type === "payments"
                          ? isAr
                            ? "طريقة دفع في كل سطر"
                            : "One payment method a line"
                          : col.type === "contact"
                            ? isAr
                              ? "العنوان، الإيميل، المواعيد… سطر لكل واحد"
                              : "Address, email, opening hours… one a line"
                            : isAr
                              ? "سطر تحت العنوان"
                              : "A line under the heading"
                      }
                      className="w-full rounded-[0.75rem] bg-paper-sunken p-2 text-sm ring-1 ring-line focus-visible:outline-2 focus-visible:outline-primary"
                      onChange={(e) => patch(col.id, { text: e.target.value || undefined }, "text")}
                    />
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <select
                      aria-label={isAr ? `العرض على ${screenName}` : `Width on the ${screenName}`}
                      className={selectClass}
                      value={typeof width === "number" ? String(width) : "auto"}
                      onChange={(e) =>
                        patch(col.id, { width: withDeviceValue(col.width, screen, e.target.value === "auto" ? null : Number(e.target.value)) }, `width:${screen}`)
                      }
                    >
                      <option value="auto">{isAr ? "عرض القالب" : "Template width"}</option>
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {isAr ? `${n} جزء` : `${n} part${n > 1 ? "s" : ""}`}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={isAr ? "المحاذاة" : "Alignment"}
                      className={selectClass}
                      value={col.align ?? "auto"}
                      onChange={(e) => patch(col.id, { align: e.target.value === "auto" ? undefined : (e.target.value as FooterColumn["align"]) }, "align")}
                    >
                      <option value="auto">{isAr ? "محاذاة القالب" : "Template alignment"}</option>
                      <option value="start">{isAr ? "البداية" : "Start"}</option>
                      <option value="center">{isAr ? "الوسط" : "Centre"}</option>
                      <option value="end">{isAr ? "النهاية" : "End"}</option>
                    </select>
                    <label className="inline-flex min-h-9 items-center gap-1.5 px-1 text-xs text-ink pointer-coarse:min-h-11">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--color-primary)]"
                        checked={!(col.hide ?? []).includes(screen)}
                        onChange={(e) => {
                          const rest = (col.hide ?? []).filter((d) => d !== screen);
                          const hide = e.target.checked ? rest : [...rest, screen];
                          patch(col.id, { hide: hide.length > 0 ? hide : undefined }, `hide:${screen}`);
                        }}
                      />
                      {isAr ? `يظهر على ${screenName}` : `Shown on the ${screenName}`}
                    </label>
                  </div>
                </SortableRow>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      {addable.length > 0 && (
        <select
          aria-label={isAr ? "ضيف عمود" : "Add a column"}
          className={cn(selectClass, "w-full")}
          value=""
          onChange={(e) => {
            const value = e.target.value;
            if (!value) return;
            const column: FooterColumn = value.startsWith("group:")
              ? { id: partId("group"), type: "group", at: Number(value.slice(6)) }
              : { id: value, type: value as FooterColumnType };
            setColumns([...columns, column]);
          }}
        >
          <option value="">{isAr ? "+ ضيف عمود" : "+ Add a column"}</option>
          {addable.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      <h4 className="pt-2 text-xs font-semibold text-ink-soft">{isAr ? "السطر الأخير" : "Bottom line"}</h4>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={sortEnd(bottom, (next) => setBottom(next))}>
        <SortableContext items={bottom.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {bottom.map((part) => {
              const label = part.type === "rights" ? (isAr ? "سطر الحقوق" : "Rights line") : part.type === "powered" ? (isAr ? "مدعوم من زيموس" : "Powered by Zimos") : isAr ? "كلام" : "Words";
              return (
                <SortableRow
                  key={part.id}
                  id={part.id}
                  grip={isAr ? `اسحب: ${label}` : `Drag: ${label}`}
                  removeLabel={isAr ? `احذف: ${label}` : `Remove: ${label}`}
                  // ZIMOS's line is hidden by the plan (Store design → Hide ZIMOS branding), not from here: the store puts it back.
                  onRemove={part.type === "powered" ? undefined : () => setBottom(bottom.filter((p) => p.id !== part.id))}
                >
                  {part.type === "text" ? (
                    <Input
                      value={part.label ?? ""}
                      dir="auto"
                      maxLength={200}
                      aria-label={label}
                      className="h-9 text-sm"
                      onChange={(e) => setBottom(bottom.map((p) => (p.id === part.id ? { ...p, label: e.target.value } : p)), `shell:footer:bottom:${part.id}`)}
                    />
                  ) : (
                    <p className="py-2 text-sm">{label}</p>
                  )}
                </SortableRow>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="text-xs text-ink-soft">{isAr ? "سطر حقوق تصميم القالب: ثابت ولا يُحذف (شرط ترخيص القالب)." : "The template's design credit: always shown (its licence asks for it)."}</p>
      <p className="text-xs text-ink-soft">
        {isAr
          ? "«مدعوم من زيموس» لا يُحذف من هنا: يُخفيه «إخفاء شعار ZIMOS» في إعدادات المتجر ← عام، إن كانت باقتك تتيح ذلك."
          : "“Powered by Zimos” is not removed here: “Hide ZIMOS branding” in Store settings → General hides it, where your plan allows."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setBottom([...bottom, { id: partId("text"), type: "text", label: isAr ? "كلام جديد" : "New words" }])}>
          <IconPlus className="size-4" aria-hidden />
          {isAr ? "ضيف كلام" : "Add words"}
        </Button>
        {(["rights", "powered"] as const)
          .filter((type) => !bottom.some((p) => p.type === type))
          .map((type) => (
            <Button key={type} type="button" size="sm" variant="outline" onClick={() => setBottom([...bottom, { id: type, type }])}>
              <IconPlus className="size-4" aria-hidden />
              {type === "rights" ? (isAr ? "سطر الحقوق" : "Rights line") : isAr ? "مدعوم من زيموس" : "Powered by Zimos"}
            </Button>
          ))}
      </div>
    </LookBlock>
  );
}
