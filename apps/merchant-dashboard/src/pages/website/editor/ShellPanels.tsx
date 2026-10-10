import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconAnnounce,
  IconCaretDown,
  IconCaretLeft,
  IconCaretRight,
  IconCart,
  IconCheck,
  IconClose,
  IconDragHandle,
  IconFolder,
  IconGlobe,
  IconHome,
  IconPage,
  IconPanelBottom,
  IconPanelTop,
  IconPlus,
  IconProducts,
  IconSearch,
  IconShipping,
  type Icon,
} from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import type { WebsitePage } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { PHONE_QUERY, useMediaQuery } from "@/components/report/useMediaQuery";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import { Textarea } from "@/components/Textarea";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useEditorLocale } from "./editorLocale";
import { AnnouncementSection } from "./StoreLookPanel";
import type { StoreLook } from "./storeLook";
import {
  FOOTER_TEXT_MAX,
  LINK_HREF_MAX,
  LINK_KINDS,
  LINK_LABEL_MAX,
  MAX_FOOTER_GROUPS,
  MAX_GROUP_LINKS,
  MAX_MENU_LINKS,
  builtinHref,
  collectionHref,
  newLink,
  productHref,
  shellId,
  shellPartLabel,
  starterFooterGroups,
  starterMenu,
  submenuCount,
  type FooterGroupLook,
  type LinkKind,
  type LogoAlign,
  type LogoSize,
  type ShellLink,
  type ShellPart,
} from "./storeShell";
import { LookBlock, SwitchRow, lookIconButtonClass, lookTextButtonClass } from "./theme/parts";
import { lookUi, themeUi } from "./theme/themeLocale";

/**
 * The inspector for the store's fixed parts — the announcement bar, the
 * header and the footer — opened by clicking one in the preview or in the
 * section list. They are part of the store look (storeLook.ts): the same undo
 * history, the same Save, and the canvas shows every change live before it is
 * saved (StorefrontPreview's `shell`).
 *
 * Built from the same compact blocks as the theme panel (theme/parts.tsx), so
 * the two read as one inspector. `onChange` takes a history key, so a burst of
 * typing in one field is one undo step.
 */

type OnLookChange = (next: StoreLook, historyKey?: string) => void;

const PART_ICON = { header: IconPanelTop, footer: IconPanelBottom, announcement: IconAnnounce } as const;

const KIND_ICON: Record<LinkKind, Icon> = {
  home: IconHome,
  cart: IconCart,
  track: IconShipping,
  page: IconPage,
  product: IconProducts,
  collection: IconFolder,
  url: IconGlobe,
};

export function ShellPanel({
  part,
  look,
  onChange,
  pages,
  usage = 0,
  onClose,
  variant = "panel",
}: {
  part: ShellPart;
  look: StoreLook;
  onChange: OnLookChange;
  /** The site's pages, for "link to a page". */
  pages: WebsitePage[];
  /**
   * How much of the API's themeSettings allowance a save would use (1 = all
   * of it) — these panels are what can push it over, so they say so.
   */
  usage?: number;
  onClose: () => void;
  /**
   * `panel` (the default) is the inspector column: its own header with a close
   * button, its own gutter and scroll. `sheet` is the same fields for a phone
   * bottom sheet that already has a title, a close button, a gutter and a
   * scrolling body: only the hint and the fields are drawn.
   */
  variant?: "panel" | "sheet";
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const PartIcon = PART_ICON[part];
  const hint = part === "header" ? ui.headerHint : part === "footer" ? ui.footerHint : ui.announcementHint;
  const pct = Math.round(usage * 100);
  const sheet = variant === "sheet";
  const gutters = { "--look-gutter": sheet ? "0px" : "1rem" } as CSSProperties;

  const fields = (
    <>
      {usage > 1 ? (
        <p
          role="alert"
          className="border-b border-line bg-danger-soft px-[var(--look-gutter)] py-2 text-xs font-medium text-danger"
        >
          {ui.shellTooLarge}
        </p>
      ) : (
        usage >= 0.8 && (
          <p className="border-b border-line px-[var(--look-gutter)] py-2 text-xs text-ink-soft">
            {ui.shellSizeWarning(pct)}
          </p>
        )
      )}
      {part === "header" && <HeaderFields look={look} onChange={onChange} pages={pages} />}
      {part === "footer" && <FooterFields look={look} onChange={onChange} pages={pages} />}
      {part === "announcement" && (
        <LookBlock>
          <AnnouncementSection
            announcement={look.announcement}
            onChange={(next, key) => onChange({ ...look, announcement: next }, key)}
            bare
          />
        </LookBlock>
      )}
    </>
  );

  if (sheet) {
    return (
      <div data-slot="store-shell" data-variant="sheet" data-part={part} style={gutters} className="zimos-look">
        <p className="pb-1 text-xs text-ink-soft">{hint}</p>
        {fields}
      </div>
    );
  }

  return (
    <div
      data-slot="store-shell"
      data-variant="panel"
      data-part={part}
      style={gutters}
      className="zimos-look flex h-full flex-col"
    >
      <div className="flex items-start gap-2.5 border-b border-line py-2.5 ps-4 pe-2">
        <span
          aria-hidden
          className="zimos-look-badge mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary-soft text-primary"
        >
          <PartIcon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 py-0.5">
          <h2 className="truncate text-sm font-semibold text-ink">{shellPartLabel(part, ui)}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
        </div>
        <button
          type="button"
          aria-label={ui.closePanel}
          title={ui.closePanel}
          onClick={onClose}
          className={lookIconButtonClass}
        >
          <IconClose className="size-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{fields}</div>
    </div>
  );
}

/** The small name over a control that has no label of its own (a segmented choice). */
function ControlLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-ink-soft">{children}</p>;
}

function HeaderFields({ look, onChange, pages }: { look: StoreLook; onChange: OnLookChange; pages: WebsitePage[] }) {
  const ui = lookUi(useEditorLocale());
  const header = look.header;
  const set = (patch: Partial<StoreLook["header"]>, key?: string) =>
    onChange({ ...look, header: { ...header, ...patch } }, key);

  return (
    <>
      <LookBlock title={ui.menuLinks} hint={header.menu === null ? ui.menuDefaultNote : ui.menuLinksHint}>
        {header.menu === null ? (
          <Button type="button" size="sm" variant="outline" onClick={() => set({ menu: starterMenu() })}>
            {ui.customiseLinks}
          </Button>
        ) : (
          <>
            <ShellLinksEditor
              links={header.menu}
              max={MAX_MENU_LINKS}
              pages={pages}
              historyKey="shell:header:menu"
              onChange={(menu, key) => set({ menu }, key)}
            />
            <button type="button" onClick={() => set({ menu: null })} className={lookTextButtonClass}>
              {ui.useStandardLinks}
            </button>
          </>
        )}
      </LookBlock>

      <LookBlock title={ui.logo}>
        <div className="space-y-1.5">
          <ControlLabel>{ui.logoSize}</ControlLabel>
          <Segmented<LogoSize>
            value={header.logoSize}
            onChange={(logoSize) => set({ logoSize })}
            options={(["sm", "md", "lg"] as const).map((value) => ({ value, label: ui.logoSizeName(value) }))}
            label={ui.logoSize}
            size="sm"
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <ControlLabel>{ui.logoPlacement}</ControlLabel>
          <Segmented<LogoAlign>
            value={header.logoAlign}
            onChange={(logoAlign) => set({ logoAlign })}
            options={(["start", "center"] as const).map((value) => ({ value, label: ui.logoPlacementName(value) }))}
            label={ui.logoPlacement}
            size="sm"
            className="w-full"
          />
        </div>
      </LookBlock>

      <LookBlock title={ui.showInHeader} className="space-y-1">
        <SwitchRow label={ui.showCart} checked={header.showCart} onChange={(showCart) => set({ showCart })} />
        <SwitchRow
          label={ui.showLanguage}
          checked={header.showLanguage}
          onChange={(showLanguage) => set({ showLanguage })}
        />
        <SwitchRow label={ui.showTheme} checked={header.showTheme} onChange={(showTheme) => set({ showTheme })} />
        <SwitchRow
          label={ui.showTrackOrder}
          checked={header.showTrackOrder}
          onChange={(showTrackOrder) => set({ showTrackOrder })}
        />
      </LookBlock>

      <LookBlock>
        <SwitchRow label={ui.stickyHeader} checked={header.sticky} onChange={(sticky) => set({ sticky })} />
      </LookBlock>
    </>
  );
}

function FooterFields({ look, onChange, pages }: { look: StoreLook; onChange: OnLookChange; pages: WebsitePage[] }) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const footer = look.footer;
  const set = (patch: Partial<StoreLook["footer"]>, key?: string) =>
    onChange({ ...look, footer: { ...footer, ...patch } }, key);
  const groups = footer.groups;

  function setGroup(id: string, patch: Partial<FooterGroupLook>, key?: string) {
    if (!groups) return;
    set({ groups: groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }, key);
  }

  return (
    <>
      <LookBlock>
        <SwitchRow
          strong
          label={ui.footerBrand}
          checked={footer.showBrand}
          onChange={(showBrand) => set({ showBrand })}
        />
        {footer.showBrand && (
          <Field label={ui.footerText} hint={ui.footerTextHint}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                dir="auto"
                maxLength={FOOTER_TEXT_MAX}
                value={footer.text}
                onChange={(e) => set({ text: e.target.value }, "shell:footer:text")}
              />
            )}
          </Field>
        )}
      </LookBlock>

      <LookBlock>
        <SwitchRow
          strong
          label={ui.footerLinks}
          checked={footer.showLinks}
          onChange={(showLinks) => set({ showLinks })}
        />
        {footer.showLinks &&
          (groups === null ? (
            <>
              <p className="text-xs text-ink-soft">{ui.footerDefaultNote}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => set({ groups: starterFooterGroups(ui.footerStandardTitle) })}
              >
                {ui.customiseGroups}
              </Button>
            </>
          ) : (
            <>
              {groups.map((group, i) => (
                <fieldset
                  key={group.id}
                  className="zimos-look-group min-w-0 space-y-2 rounded-[0.875rem] bg-paper-sunken p-2 ring-1 ring-line"
                >
                  <legend className="sr-only">{ui.groupAria(i + 1)}</legend>
                  <div className="flex items-center gap-1">
                    <Input
                      value={group.title}
                      dir="auto"
                      maxLength={LINK_LABEL_MAX}
                      placeholder={ui.groupTitle}
                      aria-label={`${ui.groupTitle} — ${ui.groupAria(i + 1)}`}
                      onChange={(e) => setGroup(group.id, { title: e.target.value }, `shell:footer:group:${group.id}`)}
                      className="h-9 min-w-0 flex-1 text-sm font-medium pointer-coarse:h-11"
                    />
                    <span className="shrink-0 px-1 text-[11px] text-ink-soft">{t.groupLinks(group.links.length)}</span>
                    <button
                      type="button"
                      aria-label={ui.removeGroup(i + 1)}
                      title={ui.removeGroup(i + 1)}
                      onClick={() => set({ groups: groups.filter((g) => g.id !== group.id) })}
                      className={lookIconButtonClass}
                    >
                      <IconClose className="size-4" aria-hidden />
                    </button>
                  </div>
                  <ShellLinksEditor
                    links={group.links}
                    max={MAX_GROUP_LINKS}
                    pages={pages}
                    historyKey={`shell:footer:links:${group.id}`}
                    onChange={(links, key) => setGroup(group.id, { links }, key)}
                  />
                </fieldset>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={groups.length >= MAX_FOOTER_GROUPS}
                  onClick={() =>
                    set({ groups: [...groups, { id: shellId("group"), title: "", links: [newLink("page")] }] })
                  }
                >
                  <IconPlus className="size-4" aria-hidden />
                  {ui.addGroup}
                </Button>
                <span className="text-xs text-ink-soft">{ui.maxGroups(MAX_FOOTER_GROUPS)}</span>
              </div>
              <button type="button" onClick={() => set({ groups: null })} className={lookTextButtonClass}>
                {ui.useStandardGroup}
              </button>
            </>
          ))}
      </LookBlock>

      <LookBlock>
        <SwitchRow label={ui.footerHelp} checked={footer.showHelp} onChange={(showHelp) => set({ showHelp })} />
      </LookBlock>
    </>
  );
}

/**
 * A reorderable list of links: drag a row by its grip (or pick it up with
 * Space and move it with the arrow keys — dnd-kit's keyboard sensor), type
 * its label, choose where it goes.
 */
function ShellLinksEditor({
  links,
  max,
  pages,
  historyKey,
  onChange,
}: {
  links: ShellLink[];
  max: number;
  pages: WebsitePage[];
  historyKey: string;
  onChange: (next: ShellLink[], historyKey?: string) => void;
}) {
  const ui = lookUi(useEditorLocale());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = links.findIndex((l) => l.id === active.id);
    const to = links.findIndex((l) => l.id === over.id);
    if (from === -1 || to === -1) return;
    onChange(arrayMove(links, from, to));
  }

  const patch = (id: string, next: Partial<ShellLink>, key?: string) =>
    onChange(
      links.map((l) => (l.id === id ? { ...l, ...next } : l)),
      key
    );

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {links.map((link, i) => (
              <SortableLinkRow
                key={link.id}
                link={link}
                index={i}
                pages={pages}
                onPatch={(next, key) => patch(link.id, next, key ? `${historyKey}:${link.id}:${key}` : undefined)}
                onRemove={() => onChange(links.filter((l) => l.id !== link.id))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={links.length >= max}
          onClick={() => onChange([...links, newLink("page")])}
        >
          <IconPlus className="size-4" aria-hidden />
          {ui.addLink}
        </Button>
        <span className="text-xs text-ink-soft">{ui.maxLinks(max)}</span>
      </div>
    </div>
  );
}

/**
 * One link: a grip the height of a thumb at the start, then its name over
 * where it goes. A link that carries a dropdown (written by a template) says
 * so — the dropdown is kept as it is.
 */
function SortableLinkRow({
  link,
  index,
  pages,
  onPatch,
  onRemove,
}: {
  link: ShellLink;
  index: number;
  pages: WebsitePage[];
  onPatch: (next: Partial<ShellLink>, key?: string) => void;
  onRemove: () => void;
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });
  const builtin = builtinHref(link.kind) !== null;
  const unlabelled = !builtin && link.label.trim() === "" && link.href.trim() !== "";
  const submenu = submenuCount(link);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-dragging={isDragging || undefined}
      className={cn(
        "zimos-look-link grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-0.5 gap-y-1.5 rounded-[0.875rem] bg-paper-raised py-1.5 pe-1 ring-1 ring-line",
        isDragging && "relative z-10 shadow-[var(--shadow-raised)]"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={ui.dragLink(index + 1)}
        title={ui.dragLink(index + 1)}
        className={cn(
          "row-span-2 flex min-h-11 w-9 cursor-grab touch-none items-center justify-center self-stretch rounded-[0.75rem] text-ink-soft",
          "transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink active:cursor-grabbing",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary pointer-coarse:w-11 motion-reduce:transition-none"
        )}
      >
        <IconDragHandle className="size-4" aria-hidden />
      </button>
      <Input
        value={link.label}
        dir="auto"
        maxLength={LINK_LABEL_MAX}
        placeholder={builtin ? ui.linkLabelAuto : ui.linkLabel}
        aria-label={`${ui.linkLabel} — ${ui.linkAria(index + 1)}`}
        className="h-9 min-w-0 text-sm pointer-coarse:h-11"
        onChange={(e) => onPatch({ label: e.target.value }, "label")}
      />
      <button
        type="button"
        aria-label={ui.removeLink(index + 1)}
        title={ui.removeLink(index + 1)}
        onClick={onRemove}
        className={lookIconButtonClass}
      >
        <IconClose className="size-4" aria-hidden />
      </button>
      <div className="col-span-2 col-start-2 min-w-0 space-y-1.5 pe-1">
        <LinkTargetField link={link} pages={pages} index={index} onPatch={onPatch} />
        {unlabelled && <p className="text-xs font-medium text-danger">{ui.linkLabelRequired}</p>}
        {submenu > 0 && <p className="text-xs text-ink-soft">{t.submenuKept(submenu)}</p>}
      </div>
    </li>
  );
}

/**
 * Where one link goes, on one line: what kind of place and which one. Pressing
 * it opens the chooser — a popover beside it with a pointer, a bottom sheet on
 * a phone.
 */
function LinkTargetField({
  link,
  pages,
  index,
  onPatch,
}: {
  link: ShellLink;
  pages: WebsitePage[];
  index: number;
  onPatch: (next: Partial<ShellLink>, key?: string) => void;
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const phone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const catalog = useCatalog(link.kind === "product" || link.kind === "collection" ? link.kind : null);

  const KindIcon = KIND_ICON[link.kind];
  const kindName = ui.linkKind(link.kind);
  // The place itself, when the kind alone does not say it.
  let place: string | null = null;
  let placeIsAddress = false;
  if (link.kind === "page") {
    place = pages.find((p) => p.path === link.href)?.title ?? (link.href.trim() || null);
    placeIsAddress = place === link.href.trim();
  } else if (link.kind === "product" || link.kind === "collection") {
    place = catalog.options?.find((o) => o.href === link.href)?.name ?? null;
  } else if (link.kind === "url") {
    place = link.href.trim() || null;
    placeIsAddress = true;
  }
  const missing = builtinHref(link.kind) === null && link.href.trim() === "";

  const trigger = (
    <button
      type="button"
      aria-label={`${ui.linkTarget} — ${ui.linkAria(index + 1)}: ${place ?? kindName}`}
      aria-haspopup="dialog"
      onClick={phone ? () => setOpen(true) : undefined}
      className={cn(
        "zimos-look-target flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-[0.75rem] bg-paper-sunken px-2.5 text-start text-xs ring-1 ring-line",
        "transition-[scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:ring-line-strong active:scale-[0.99]",
        "focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11 pointer-coarse:text-sm motion-reduce:transition-none"
      )}
    >
      <KindIcon className="size-4 shrink-0 text-ink-soft" aria-hidden />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className={cn("shrink-0", place ? "text-ink-soft" : "font-medium text-ink")}>{kindName}</span>
        {place ? (
          <bdi dir={placeIsAddress ? "ltr" : undefined} className="min-w-0 truncate font-medium text-ink">
            {place}
          </bdi>
        ) : (
          missing && <span className="min-w-0 truncate text-danger">{t.linkTargetEmpty}</span>
        )}
      </span>
      <IconCaretDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
    </button>
  );

  const chooser = (
    <LinkTargetChooser link={link} pages={pages} onPatch={onPatch} onDone={() => setOpen(false)} roomy={phone} />
  );

  if (phone) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen} title={t.linkTargetTitle} size="sm">
          {open && chooser}
        </Sheet>
      </>
    );
  }
  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="start"
      label={t.linkTargetTitle}
      className="w-[min(18.5rem,calc(100vw-1.5rem))] p-1.5"
    >
      {chooser}
    </Popover>
  );
}

/** One pressable line of the chooser. */
const optionClass =
  "zimos-look-option flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[0.75rem] px-2.5 text-start text-sm text-ink " +
  "transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/6 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.99] " +
  "aria-[current=true]:bg-primary-soft pointer-coarse:min-h-11 motion-reduce:transition-none";

type ChooserStep = "root" | "page" | "product" | "collection" | "url";

/**
 * The link-target chooser: first the kind of place — the three built-in pages
 * are one press — then, for a page, a product or a collection, the list to
 * pick from (searchable), and for a web address a box to type it in.
 *
 * Picking a page, product or collection also names the link after it when the
 * merchant has not named it yet.
 */
function LinkTargetChooser({
  link,
  pages,
  onPatch,
  onDone,
  roomy,
}: {
  link: ShellLink;
  pages: WebsitePage[];
  onPatch: (next: Partial<ShellLink>, key?: string) => void;
  onDone: () => void;
  /** In a sheet: the sheet's own body scrolls, so the list is not boxed. */
  roomy: boolean;
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const [step, setStep] = useState<ChooserStep>("root");
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState(link.kind === "url" ? link.href : "");
  const named = (label: string) => (link.label.trim() ? {} : { label: label.slice(0, LINK_LABEL_MAX) });

  function go(next: ChooserStep) {
    setQuery("");
    setStep(next);
  }

  if (step === "root") {
    return (
      <ul className="space-y-0.5">
        {LINK_KINDS.map((kind) => {
          const KindIcon = KIND_ICON[kind];
          const current = link.kind === kind;
          const fixed = builtinHref(kind);
          return (
            <li key={kind}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => {
                  if (fixed !== null) {
                    onPatch({ kind, href: fixed });
                    onDone();
                  } else {
                    go(kind as ChooserStep);
                  }
                }}
                className={optionClass}
              >
                <KindIcon
                  className={cn("size-[18px] shrink-0", current ? "text-primary" : "text-ink-soft")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{ui.linkKind(kind)}</span>
                {fixed !== null ? (
                  current && <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <IconCaretRight className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const head = (
    <div className="flex items-center gap-1 pb-1">
      <button type="button" aria-label={t.back} title={t.back} onClick={() => go("root")} className={lookIconButtonClass}>
        <IconCaretLeft className="size-4 rtl:-scale-x-100" aria-hidden />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{ui.linkKind(step)}</p>
    </div>
  );

  if (step === "url") {
    return (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onDone();
        }}
      >
        {head}
        <div className="space-y-1.5 px-1 pb-1">
          <Input
            value={address}
            dir="ltr"
            type="url"
            inputMode="url"
            maxLength={LINK_HREF_MAX}
            placeholder="https://"
            aria-label={ui.webAddress}
            className="h-10 text-sm pointer-coarse:h-11"
            onChange={(e) => {
              setAddress(e.target.value);
              onPatch({ kind: "url", href: e.target.value }, "href");
            }}
          />
          <p className="text-xs text-ink-soft">{ui.webAddressHint}</p>
          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm">
              {t.done}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  if (step === "page") {
    return (
      <div>
        {head}
        <PickList
          items={pages.map((page) => ({ key: page.id, name: page.title, detail: page.path, href: page.path }))}
          currentHref={link.kind === "page" ? link.href : null}
          query={query}
          onQuery={setQuery}
          empty={ui.choosePage}
          roomy={roomy}
          onPick={(item) => {
            onPatch({ kind: "page", href: item.href, ...named(item.name) });
            onDone();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {head}
      <CatalogPick
        kind={step}
        currentHref={link.kind === step ? link.href : null}
        query={query}
        onQuery={setQuery}
        roomy={roomy}
        onPick={(item) => {
          onPatch({ kind: step, href: item.href, ...named(item.name) });
          onDone();
        }}
      />
    </div>
  );
}

interface PickItem {
  key: string;
  name: string;
  /** A second, quieter line part — a page's path. */
  detail?: string;
  href: string;
}

/** How many rows a list shows before it is worth a search box. */
const SEARCH_FROM = 7;

function PickList({
  items,
  currentHref,
  query,
  onQuery,
  empty,
  roomy,
  onPick,
}: {
  items: PickItem[];
  currentHref: string | null;
  query: string;
  onQuery: (next: string) => void;
  /** Said when the list itself is empty. */
  empty: string;
  roomy: boolean;
  onPick: (item: PickItem) => void;
}) {
  const t = themeUi(useEditorLocale());
  const needle = query.trim().toLocaleLowerCase();
  const shown = needle
    ? items.filter((item) => `${item.name} ${item.detail ?? ""}`.toLocaleLowerCase().includes(needle))
    : items;

  if (items.length === 0) return <p className="px-2.5 py-3 text-xs text-ink-soft">{empty}</p>;

  return (
    <div className="space-y-1.5">
      {items.length >= SEARCH_FROM && (
        <div className="relative px-1">
          <IconSearch
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <Input
            value={query}
            type="search"
            dir="auto"
            placeholder={t.searchList}
            aria-label={t.searchList}
            className="h-9 ps-8 text-sm pointer-coarse:h-11"
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-ink-soft">{t.noMatches}</p>
      ) : (
        <ul className={cn("space-y-0.5", !roomy && "max-h-64 overflow-y-auto overscroll-contain")}>
          {shown.map((item) => {
            const current = currentHref !== null && item.href === currentHref;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => onPick(item)}
                  className={optionClass}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" dir="auto">
                      {item.name}
                    </span>
                    {item.detail && (
                      <bdi dir="ltr" className="block truncate text-start text-[11px] text-ink-soft">
                        {item.detail}
                      </bdi>
                    )}
                  </span>
                  {current && <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface CatalogOption {
  value: string;
  name: string;
  href: string;
}

/**
 * Products and collections, loaded once per workspace and kind while the
 * editor is open — a menu with three product links asks the API once, not
 * three times.
 */
const catalogCache = new Map<string, Promise<CatalogOption[]>>();

function loadCatalog(workspaceId: string, kind: "product" | "collection"): Promise<CatalogOption[]> {
  const key = `${workspaceId}:${kind}`;
  let pending = catalogCache.get(key);
  if (!pending) {
    pending =
      kind === "product"
        ? apiClient
            .listProducts(workspaceId, { status: "active", limit: 100 })
            .then(({ products }) =>
              products.map((p) => ({ value: p.slug || p.id, name: p.name, href: productHref(p.slug || p.id) }))
            )
        : apiClient
            .listCollections(workspaceId)
            .then((collections) => collections.map((c) => ({ value: c.id, name: c.name, href: collectionHref(c.id) })));
    pending.catch(() => catalogCache.delete(key));
    catalogCache.set(key, pending);
  }
  return pending;
}

/** The catalogue list for one kind (nothing is asked for while `kind` is null), with a way to ask again after a failure. */
function useCatalog(kind: "product" | "collection" | null) {
  const workspaceId = useWorkspaceId();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; options: CatalogOption[] | null; failed: boolean }>({
    key: "",
    options: null,
    failed: false,
  });
  const key = kind ? `${workspaceId}:${kind}:${attempt}` : "";

  useEffect(() => {
    if (!kind) return;
    let live = true;
    loadCatalog(workspaceId, kind).then(
      (options) => {
        if (live) setState({ key, options, failed: false });
      },
      () => {
        if (live) setState({ key, options: null, failed: true });
      }
    );
    return () => {
      live = false;
    };
  }, [workspaceId, kind, key]);

  const current = kind && state.key === key ? state : null;
  return {
    options: current?.options ?? null,
    failed: current?.failed ?? false,
    retry: () => setAttempt((n) => n + 1),
  };
}

function CatalogPick({
  kind,
  currentHref,
  query,
  onQuery,
  roomy,
  onPick,
}: {
  kind: "product" | "collection";
  currentHref: string | null;
  query: string;
  onQuery: (next: string) => void;
  roomy: boolean;
  onPick: (item: PickItem) => void;
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const catalog = useCatalog(kind);

  if (catalog.failed) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2">
        <p role="alert" className="min-w-0 flex-1 text-xs text-danger">
          {ui.listFailed}
        </p>
        <button type="button" onClick={catalog.retry} className={lookTextButtonClass}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (!catalog.options) {
    return (
      <div role="status" aria-label={ui.listLoading} className="space-y-1.5 px-1 py-1">
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden className="block h-9 animate-pulse rounded-[0.75rem] bg-ink/6 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  return (
    <PickList
      items={catalog.options.map((option) => ({ key: option.value, name: option.name, href: option.href }))}
      currentHref={currentHref}
      query={query}
      onQuery={onQuery}
      empty={kind === "product" ? ui.noProductsYet : ui.noCollectionsYet}
      roomy={roomy}
      onPick={onPick}
    />
  );
}
