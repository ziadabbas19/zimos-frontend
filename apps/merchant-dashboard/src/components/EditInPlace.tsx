import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import { IconEdit, IconSpinner } from "@/components/icons";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { useToast } from "@/components/Toast";
import { useErrorMessage } from "@/lib/errorMessages";
import { asciiDigits } from "@/lib/wholeNumber";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    saved: "Saved",
    editing: "Edit {label}",
    failed: "That didn't save, so the old value is back. {reason}",
    undoFailed: "We couldn't undo that, so it stays as you changed it. {reason}",
    needNumber: "Type a whole number in digits, like {example}.",
    needAmount: "Type the amount in digits only, like {example}.",
  },
  ar: {
    saved: "تم الحفظ",
    editing: "تعديل {label}",
    failed: "لم يُحفظ، فأعدنا القيمة السابقة. {reason}",
    undoFailed: "تعذّر التراجع، فبقي التعديل كما هو. {reason}",
    needNumber: "اكتب رقمًا صحيحًا بالأرقام فقط، مثل {example}.",
    needAmount: "اكتب المبلغ بالأرقام فقط، مثل {example}.",
  },
} satisfies Messages;

type EditKind = "text" | "number" | "money";

export interface EditInPlaceProps {
  /** The value as the field edits it: "149.50", "12", a short name. */
  value: string;
  /** How it reads on the page when that is not the raw value (a formatted price, a badge). */
  display?: ReactNode;
  /** The same formatting as a function, so the new value reads right in the moment before the page catches up. */
  format?: (value: string) => ReactNode;
  /** Names the field: the label over the input, and what a screen reader hears. */
  label: string;
  kind?: EditKind;
  /** Saves it. Throw (or reject) when it did not save: the old value comes back and a toast says why. */
  onSave: (next: string) => Promise<void> | void;
  /** A sentence that says how to fix what was typed, or null when it is fine. */
  validate?: (next: string) => string | null;
  /** The toast after a save, next to «تراجع». Default «اتحفظ». */
  undoMessage?: string;
  /** Shows the value with nothing to press (a role that may look but not change). */
  disabled?: boolean;
  className?: string;
}

/** Digits typed on an Arabic keyboard, the Arabic decimal mark and stray spaces, as the plain form the API takes. */
function tidy(kind: EditKind, raw: string): string {
  if (kind === "text") return raw.trim();
  return asciiDigits(raw).replace(/٫/g, ".").replace(/[٬\s]/g, "");
}

/** The typed value in the language's digits, for the moment between the save and the page's own formatting. */
function inFlight(kind: EditKind, text: string): string {
  if (text === "") return "—";
  if (kind === "text" || !Number.isFinite(Number(text))) return text;
  return fmt("{n}", { n: Number(text) });
}

/**
 * Change a price, a stock count or a short text right where it is shown,
 * instead of open → edit → save → back. At rest it is the value as a quiet
 * button (a dotted underline and a small pencil under the pointer; the pencil
 * always on a touch screen). Pressing it opens a small pane with one field:
 * Enter or «حفظ» saves, Esc or «إلغاء» leaves it as it was.
 *
 * The save is optimistic: the pane closes at once and the new value shows,
 * dimmed until the server answers. Then a toast offers «تراجع» for a few
 * seconds; if the save fails the old value comes back and a toast says why.
 * The page stays where it is the whole time.
 */
export function EditInPlace({
  value,
  display,
  format,
  label,
  kind = "text",
  onSave,
  validate,
  undoMessage,
  disabled = false,
  className,
}: EditInPlaceProps) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const inputId = useId();
  const problemId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // What was just typed, shown until the page's own value catches up. `base` is the value it was typed over.
  const [typed, setTyped] = useState<{ text: string; base: string } | null>(null);

  // The Undo toast outlives this render (and maybe this row): it calls back through the latest props.
  const latest = useRef({ value, onSave, undoMessage, t, errorMessage });
  useEffect(() => {
    latest.current = { value, onSave, undoMessage, t, errorMessage };
  });
  const runs = useRef(0);

  // The page caught up (or changed under us): its value is the truth again.
  if (typed && typed.base !== value) setTyped(null);
  const pending = typed && typed.base === value && typed.text !== value ? typed.text : null;
  const current = pending ?? value;

  const save = useCallback(
    async (target: string, from: string, undoable: boolean): Promise<void> => {
      const run = ++runs.current;
      setTyped({ text: target, base: latest.current.value });
      setSaving(true);
      try {
        await latest.current.onSave(target);
      } catch (err) {
        // Back to what the page says, and say what happened.
        setTyped(null);
        if (runs.current === run) setSaving(false);
        const now = latest.current;
        toast.error(fmt(undoable ? now.t.failed : now.t.undoFailed, { reason: now.errorMessage(err) }));
        return;
      }
      if (runs.current === run) setSaving(false);
      if (undoable) {
        const now = latest.current;
        toast.undo(now.undoMessage ?? now.t.saved, () => save(from, target, false));
      }
    },
    [toast]
  );

  function onOpenChange(next: boolean) {
    if (next) {
      // One save at a time: the value is dimmed until the last one lands.
      if (saving) return;
      setDraft(current);
      setProblem(null);
    }
    setOpen(next);
  }

  function check(next: string): string | null {
    if (next !== "") {
      if (kind === "number" && !/^-?\d+$/.test(next)) return fmt(t.needNumber, { example: 25 });
      if (kind === "money" && !/^\d+(\.\d+)?$/.test(next)) return fmt(t.needAmount, { example: 149.5 });
    }
    return validate ? validate(next) : null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = tidy(kind, draft);
    const issue = check(next);
    if (issue) {
      setProblem(issue);
      inputRef.current?.focus();
      return;
    }
    setOpen(false);
    if (next !== current) void save(next, current, true);
  }

  const numeric = kind !== "text";
  const resting = display ?? (format ? format(value) : <bdi>{value === "" ? "—" : value}</bdi>);
  const shown = pending === null ? resting : format ? format(pending) : <bdi>{inFlight(kind, pending)}</bdi>;

  if (disabled) {
    return (
      <span data-slot="edit-in-place" className={cn("inline-flex max-w-full items-center", className)}>
        <span className="min-w-0 truncate">{shown}</span>
      </span>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      label={fmt(t.editing, { label })}
      align="start"
      // The field itself, also after a tap: whoever pressed a price wants to type the new one.
      initialFocus={inputRef}
      trigger={
        <button
          type="button"
          data-slot="edit-in-place"
          aria-busy={saving || undefined}
          // It often sits in a row that is itself pressable: pressing the value edits it and nothing else.
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
          }}
          className={cn(
            "group/eip relative -mx-1.5 inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-start",
            "transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            saving && "cursor-progress",
            className
          )}
        >
          <span className="sr-only">{label}: </span>
          <span
            className={cn(
              "-my-0.5 min-w-0 truncate py-0.5 underline decoration-transparent decoration-dotted underline-offset-[3px]",
              "transition-[text-decoration-color,opacity] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              "group-hover/eip:decoration-ink-soft group-focus-visible/eip:decoration-ink-soft group-data-[popup-open]/eip:decoration-ink-soft",
              saving && "opacity-60"
            )}
          >
            {shown}
          </span>
          {saving ? (
            <IconSpinner className="size-3.5 shrink-0 animate-spin text-ink-soft motion-reduce:animate-none" aria-hidden />
          ) : (
            <IconEdit
              className="size-3.5 shrink-0 text-ink-soft opacity-0 transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] group-hover/eip:opacity-100 group-focus-visible/eip:opacity-100 group-data-[popup-open]/eip:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
              aria-hidden
            />
          )}
          <span className="sr-only"> — {common.edit}</span>
        </button>
      }
    >
      <form onSubmit={submit} noValidate className="flex w-64 max-w-full flex-col gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-ink-soft">
          {label}
        </label>
        <Input
          ref={inputRef}
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (problem) setProblem(null);
          }}
          // The whole value is selected, so typing replaces it.
          onFocus={(event) => event.currentTarget.select()}
          inputMode={kind === "money" ? "decimal" : kind === "number" ? "numeric" : undefined}
          dir={numeric ? "ltr" : "auto"}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          className={cn(
            "h-10 rounded-[0.875rem] px-3",
            numeric && "tabular-nums",
            problem && "border-danger focus-visible:ring-danger/30"
          )}
        />
        {problem && (
          <p id={problemId} role="alert" className="text-xs leading-5 font-medium text-danger">
            {problem}
          </p>
        )}
        <div className="mt-1 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full px-3.5 active:scale-[0.97]" onClick={() => setOpen(false)}>
            {common.cancel}
          </Button>
          <Button type="submit" className="rounded-full px-4 active:scale-[0.97]">
            {common.save}
          </Button>
        </div>
      </form>
    </Popover>
  );
}
