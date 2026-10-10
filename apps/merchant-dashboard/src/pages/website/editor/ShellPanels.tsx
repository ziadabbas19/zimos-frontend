import { useEffect, useState, type ReactNode } from "react";
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
import { GripVertical, Megaphone, PanelBottom, PanelTop, Plus, X } from "lucide-react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import type { WebsitePage } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { editorUi, useEditorLocale } from "./editorLocale";
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
  type FooterGroupLook,
  type LinkKind,
  type LogoAlign,
  type LogoSize,
  type ShellLink,
  submenuCount,
  type ShellPart,
} from "./storeShell";

/**
 * The inspector for the store's fixed parts — the announcement bar, the
 * header and the footer — opened by clicking one in the preview or in the
 * start pane's outline. They are part of the store look (storeLook.ts): the
 * same undo history, the same Save, and the canvas shows every change live
 * before it is saved (StorefrontPreview's `shell`).
 *
 * `onChange` takes a history key, so a burst of typing in one field is one
 * undo step.
 */

type OnLookChange = (next: StoreLook, historyKey?: string) => void;

const PART_ICON = { header: PanelTop, footer: PanelBottom, announcement: Megaphone } as const;

export function ShellPanel({
  part,
  look,
  onChange,
  pages,
  usage = 0,
  onClose,
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
}) {
  const ui = editorUi(useEditorLocale());
  const Icon = PART_ICON[part];
  const hint = part === "header" ? ui.headerHint : part === "footer" ? ui.footerHint : ui.announcementHint;
  const pct = Math.round(usage * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-medium text-ink">{shellPartLabel(part, ui)}</h2>
            <p className="text-xs text-ink-soft">{hint}</p>
          </div>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label={ui.closePanel} onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {usage > 1 ? (
          <p role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-xs font-medium text-danger">
            {ui.shellTooLarge}
          </p>
        ) : (
          usage >= 0.8 && (
            <p className="border-b border-line px-4 py-2 text-xs text-ink-soft">{ui.shellSizeWarning(pct)}</p>
          )
        )}
        {part === "header" && <HeaderFields look={look} onChange={onChange} pages={pages} />}
        {part === "footer" && <FooterFields look={look} onChange={onChange} pages={pages} />}
        {part === "announcement" && (
          <div className="px-4 py-4">
            <AnnouncementSection
              announcement={look.announcement}
              onChange={(next, key) => onChange({ ...look, announcement: next }, key)}
              bare
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** One titled block inside a panel, spaced like the inspector's fieldsets. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 py-0.5 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      {label}
    </label>
  );
}

/** A row of mutually exclusive buttons, the same look as the Store look tab's font and corner pickers. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "cursor-pointer rounded-[0.5rem] border px-2 py-1.5 text-xs font-medium text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeaderFields({ look, onChange, pages }: { look: StoreLook; onChange: OnLookChange; pages: WebsitePage[] }) {
  const ui = editorUi(useEditorLocale());
  const header = look.header;
  const set = (patch: Partial<StoreLook["header"]>, key?: string) =>
    onChange({ ...look, header: { ...header, ...patch } }, key);

  return (
    <>
      <Group title={ui.menuLinks}>
        {header.menu === null ? (
          <div className="space-y-2">
            <p className="text-xs text-ink-soft">{ui.menuDefaultNote}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => set({ menu: starterMenu() })}>
              {ui.customiseLinks}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink-soft">{ui.menuLinksHint}</p>
            <ShellLinksEditor
              links={header.menu}
              max={MAX_MENU_LINKS}
              pages={pages}
              historyKey="shell:header:menu"
              onChange={(menu, key) => set({ menu }, key)}
            />
            <button
              type="button"
              onClick={() => set({ menu: null })}
              className="cursor-pointer text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {ui.useStandardLinks}
            </button>
          </div>
        )}
      </Group>

      <Group title={ui.logo}>
        <Choice<LogoSize>
          label={ui.logoSize}
          value={header.logoSize}
          options={(["sm", "md", "lg"] as const).map((v) => ({ value: v, label: ui.logoSizeName(v) }))}
          onChange={(logoSize) => set({ logoSize })}
        />
        <Choice<LogoAlign>
          label={ui.logoPlacement}
          value={header.logoAlign}
          options={(["start", "center"] as const).map((v) => ({ value: v, label: ui.logoPlacementName(v) }))}
          onChange={(logoAlign) => set({ logoAlign })}
        />
      </Group>

      <Group title={ui.showInHeader}>
        <Check label={ui.showCart} checked={header.showCart} onChange={(showCart) => set({ showCart })} />
        <Check
          label={ui.showLanguage}
          checked={header.showLanguage}
          onChange={(showLanguage) => set({ showLanguage })}
        />
        <Check label={ui.showTheme} checked={header.showTheme} onChange={(showTheme) => set({ showTheme })} />
        <Check
          label={ui.showTrackOrder}
          checked={header.showTrackOrder}
          onChange={(showTrackOrder) => set({ showTrackOrder })}
        />
        <div className="border-t border-line pt-3">
          <Check label={ui.stickyHeader} checked={header.sticky} onChange={(sticky) => set({ sticky })} />
        </div>
      </Group>
    </>
  );
}

function FooterFields({ look, onChange, pages }: { look: StoreLook; onChange: OnLookChange; pages: WebsitePage[] }) {
  const ui = editorUi(useEditorLocale());
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
      <Group title={ui.footerBrand}>
        <Check label={ui.footerBrand} checked={footer.showBrand} onChange={(showBrand) => set({ showBrand })} />
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
      </Group>

      <Group title={ui.footerLinks}>
        <Check label={ui.footerLinks} checked={footer.showLinks} onChange={(showLinks) => set({ showLinks })} />
        {footer.showLinks &&
          (groups === null ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-soft">{ui.footerDefaultNote}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => set({ groups: starterFooterGroups(ui.footerStandardTitle) })}
              >
                {ui.customiseGroups}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group, i) => (
                <fieldset key={group.id} className="space-y-2 rounded-[0.5rem] border border-line p-3">
                  <legend className="sr-only">{ui.groupAria(i + 1)}</legend>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={group.title}
                      dir="auto"
                      maxLength={LINK_LABEL_MAX}
                      placeholder={ui.groupTitle}
                      aria-label={`${ui.groupTitle} — ${ui.groupAria(i + 1)}`}
                      onChange={(e) => setGroup(group.id, { title: e.target.value }, `shell:footer:group:${group.id}`)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={ui.removeGroup(i + 1)}
                      onClick={() => set({ groups: groups.filter((g) => g.id !== group.id) })}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
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
                  onClick={() => set({ groups: [...groups, { id: shellId("group"), title: "", links: [newLink("page")] }] })}
                >
                  <Plus className="size-4" aria-hidden />
                  {ui.addGroup}
                </Button>
                <span className="text-xs text-ink-soft">{ui.maxGroups(MAX_FOOTER_GROUPS)}</span>
              </div>
              <button
                type="button"
                onClick={() => set({ groups: null })}
                className="cursor-pointer text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {ui.useStandardGroup}
              </button>
            </div>
          ))}
      </Group>

      <Group title={ui.footerHelp}>
        <Check label={ui.footerHelp} checked={footer.showHelp} onChange={(showHelp) => set({ showHelp })} />
      </Group>
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
  const ui = editorUi(useEditorLocale());
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
          <Plus className="size-4" aria-hidden />
          {ui.addLink}
        </Button>
        <span className="text-xs text-ink-soft">{ui.maxLinks(max)}</span>
      </div>
    </div>
  );
}

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
  const ui = editorUi(useEditorLocale());
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
      className={cn(
        "space-y-2 rounded-[0.5rem] border border-line bg-paper-raised p-2",
        isDragging && "relative z-10 shadow-lg"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={ui.dragLink(index + 1)}
          title={ui.dragLink(index + 1)}
          className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-[0.375rem] text-ink-soft hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <Input
          value={link.label}
          dir="auto"
          maxLength={LINK_LABEL_MAX}
          placeholder={builtin ? ui.linkLabelAuto : ui.linkLabel}
          aria-label={`${ui.linkLabel} — ${ui.linkAria(index + 1)}`}
          className="h-8 text-sm"
          onChange={(e) => onPatch({ label: e.target.value }, "label")}
        />
        <Button type="button" size="icon-sm" variant="ghost" aria-label={ui.removeLink(index + 1)} onClick={onRemove}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <LinkTargetField link={link} pages={pages} index={index} onPatch={onPatch} />
      {unlabelled && <p className="text-xs font-medium text-danger">{ui.linkLabelRequired}</p>}
      {submenu > 0 && <p className="text-xs text-ink-soft">{ui.submenuKept(submenu)}</p>}
    </li>
  );
}

/**
 * Where one link goes: a built-in page, a page of this site, a product, a
 * collection, or any web address. Picking a page, product or collection also
 * names the link after it when the merchant hasn't named it yet.
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
  const ui = editorUi(useEditorLocale());
  const named = (label: string) => (link.label.trim() ? {} : { label: label.slice(0, LINK_LABEL_MAX) });

  return (
    <div className="space-y-2 ps-9">
      <Select
        value={link.kind}
        aria-label={`${ui.linkTarget} — ${ui.linkAria(index + 1)}`}
        className="h-8 py-0 text-sm"
        onChange={(e) => {
          const kind = e.target.value as LinkKind;
          onPatch({ kind, href: builtinHref(kind) ?? "" });
        }}
      >
        {LINK_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {ui.linkKind(kind)}
          </option>
        ))}
      </Select>

      {link.kind === "page" && (
        <Select
          value={pages.some((p) => p.path === link.href) ? link.href : ""}
          aria-label={ui.choosePage}
          className="h-8 py-0 text-sm"
          onChange={(e) => {
            const page = pages.find((p) => p.path === e.target.value);
            if (page) onPatch({ href: page.path, ...named(page.title) });
          }}
        >
          <option value="" disabled>
            {ui.choosePage}
          </option>
          {pages.map((page) => (
            <option key={page.id} value={page.path}>
              {page.title} ({page.path})
            </option>
          ))}
        </Select>
      )}

      {(link.kind === "product" || link.kind === "collection") && (
        <CatalogSelect kind={link.kind} link={link} onPick={(href, name) => onPatch({ href, ...named(name) })} />
      )}

      {link.kind === "url" && (
        <div className="space-y-1">
          <Input
            value={link.href}
            dir="ltr"
            type="url"
            inputMode="url"
            maxLength={LINK_HREF_MAX}
            placeholder="https://"
            aria-label={ui.webAddress}
            className="h-8 text-sm"
            onChange={(e) => onPatch({ href: e.target.value }, "href")}
          />
          <p className="text-xs text-ink-soft">{ui.webAddressHint}</p>
        </div>
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

function CatalogSelect({
  kind,
  link,
  onPick,
}: {
  kind: "product" | "collection";
  link: ShellLink;
  onPick: (href: string, name: string) => void;
}) {
  const ui = editorUi(useEditorLocale());
  const workspaceId = useWorkspaceId();
  const [state, setState] = useState<{ key: string; options: CatalogOption[] | null; failed: boolean }>({
    key: "",
    options: null,
    failed: false,
  });
  const key = `${workspaceId}:${kind}`;

  useEffect(() => {
    let live = true;
    loadCatalog(workspaceId, kind).then(
      (options) => live && setState({ key, options, failed: false }),
      () => live && setState({ key, options: null, failed: true })
    );
    return () => {
      live = false;
    };
  }, [workspaceId, kind, key]);

  const current = state.key === key ? state : { options: null, failed: false };
  if (current.failed) return <p className="text-xs text-danger">{ui.listFailed}</p>;
  if (!current.options) return <p className="text-xs text-ink-soft">{ui.listLoading}</p>;
  if (current.options.length === 0) {
    return <p className="text-xs text-ink-soft">{kind === "product" ? ui.noProductsYet : ui.noCollectionsYet}</p>;
  }

  const options = current.options;
  const selected = options.find((o) => o.href === link.href);
  const label = kind === "product" ? ui.chooseProduct : ui.chooseCollection;
  return (
    <Select
      value={selected ? selected.value : ""}
      aria-label={label}
      className="h-8 py-0 text-sm"
      onChange={(e) => {
        const option = options.find((o) => o.value === e.target.value);
        if (option) onPick(option.href, option.name);
      }}
    >
      <option value="" disabled>
        {label}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.name}
        </option>
      ))}
    </Select>
  );
}
