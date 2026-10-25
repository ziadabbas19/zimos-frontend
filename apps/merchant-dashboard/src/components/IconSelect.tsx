import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretDown, IconCheck } from "@/components/icons";
import { Popover } from "@/components/Popover";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { close: "Close the list" },
  ar: { close: "إغلاق القائمة" },
} satisfies Messages;

export interface IconSelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Drawn before the label, on the button and in the list. Decorative: the label already says it. */
  icon?: ReactNode;
}

/** Letters typed within this long are one search: «go» finds Google, a second «g» the next G. */
const TYPEAHEAD_MS = 500;
/** How far Page Up / Page Down move. */
const PAGE = 10;

/** The look of the native <Select> beside it (components/Select.tsx), so a form keeps one kind of field. */
const TRIGGER =
  "flex h-10 w-full cursor-pointer items-center gap-2 rounded-[0.5rem] border border-line-strong bg-paper-raised px-3 py-2 text-start text-sm text-ink " +
  "transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

/**
 * A select whose options carry an icon, which a native <select> cannot draw.
 * It is the WAI-ARIA "select-only combobox": the button keeps the focus and
 * points at the highlighted option (aria-activedescendant), so a screen reader
 * reads the field's label, its value, and each option as the arrows move.
 *
 * Keys on the button: ↓ ↑ Enter Space open the list on the chosen option, Home
 * / End on the first / last, a letter on the next option starting with it.
 * In the list: ↓ ↑ Home End Page Up / Down move, Enter / Space choose, Tab
 * chooses and moves on, Escape closes without a change (and only the list: a
 * dialog around it stays open). The list is drawn by <Popover>, so it is
 * never clipped by the dialog and lines up with the button's start edge in
 * either direction.
 */
export function IconSelect<V extends string>({
  id,
  value,
  options,
  onChange,
  label,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: {
  /** The id a <label htmlFor> points at (Field's render prop). */
  id?: string;
  value: V;
  options: readonly IconSelectOption<V>[];
  onChange: (value: V) => void;
  /** Names the list for screen readers: the field's label. */
  label: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const t = useT(STRINGS);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });

  const last = options.length - 1;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options.find((option) => option.value === value);
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    if (!open) return;
    // jsdom has no scrollIntoView.
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    // optionId only joins listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function show(index: number) {
    if (options.length === 0) return;
    setActive(Math.min(Math.max(index, 0), last));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(index: number, refocus = true) {
    const option = options[index];
    close(refocus);
    if (option && option.value !== value) onChange(option.value);
  }

  /** The option a typed letter leads to, or null when no label starts with it. */
  function typeahead(key: string, from: number): number | null {
    const now = Date.now();
    const search = typed.current;
    search.text = now - search.at > TYPEAHEAD_MS ? key : search.text + key;
    search.at = now;
    const text = search.text.toLocaleLowerCase();
    // The same letter again steps to the next option with it; a longer search stays on its match.
    const repeated = [...text].every((c) => c === text[0]);
    const needle = repeated ? text[0] : text;
    const start = repeated ? from + 1 : from;
    for (let step = 0; step < options.length; step++) {
      const index = (start + step) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(needle)) return index;
    }
    return null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) return;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    const searching = typed.current.text !== "" && Date.now() - typed.current.at <= TYPEAHEAD_MS;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show(selectedIndex);
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        show(e.key === "Home" ? 0 : last);
      } else if (printable) {
        const found = typeahead(e.key, selectedIndex);
        if (found !== null) {
          e.preventDefault();
          show(found);
        }
      }
      return;
    }

    const move = (index: number) => {
      e.preventDefault();
      setActive(Math.min(Math.max(index, 0), last));
    };
    if (e.key === "ArrowDown" && !e.altKey) move(active + 1);
    else if (e.key === "ArrowUp" && !e.altKey) move(active - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(last);
    else if (e.key === "PageDown") move(active + PAGE);
    else if (e.key === "PageUp") move(active - PAGE);
    else if (e.key === "Enter" || (e.key === " " && !searching) || (e.key === "ArrowUp" && e.altKey)) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      // The list's key alone: a Modal around it listens on window and would close too.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      choose(active, false);
    } else if (printable) {
      const found = typeahead(e.key, active);
      e.preventDefault();
      if (found !== null) setActive(found);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        onClick={() => (open ? close() : show(selectedIndex))}
        onKeyDown={onKeyDown}
        // Firefox clicks a button on the key-up of Space even when its key-down was handled here.
        onKeyUp={(e) => {
          if (e.key === " ") e.preventDefault();
        }}
        className={cn(TRIGGER, className)}
      >
        {selected?.icon && (
          <span aria-hidden className="flex shrink-0 items-center">
            {selected.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? value}</span>
        <IconCaretDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      <Popover
        open={open}
        onClose={() => close()}
        anchorRef={triggerRef}
        closeLabel={t.close}
        align="start"
        matchWidth
        // Over the Modal (z-40) the select usually sits in.
        layerClassName="z-50"
        surfaceClassName="rounded-[0.75rem] border border-line bg-paper-raised p-1 shadow-lg"
      >
        {/* A press inside the list keeps the focus on the button, which the keys and the screen reader follow. */}
        <ul id={listId} role="listbox" aria-label={label} onMouseDown={(e) => e.preventDefault()}>
          {options.map((option, index) => {
            const chosen = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={chosen}
                data-active={index === active ? "" : undefined}
                onMouseMove={() => {
                  if (index !== active) setActive(index);
                }}
                onClick={() => choose(index)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-start text-sm text-ink",
                  index === active && "bg-primary-soft text-primary-dark dark:text-primary"
                )}
              >
                {option.icon && (
                  <span aria-hidden className="flex shrink-0 items-center">
                    {option.icon}
                  </span>
                )}
                <span className={cn("min-w-0 flex-1 truncate", chosen && "font-medium")}>{option.label}</span>
                {chosen && <IconCheck aria-hidden className="size-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}
