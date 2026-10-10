import { useId, type ReactNode } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import type { ConfirmationChannel } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { Textarea } from "@/components/Textarea";
import { ChannelPicker } from "../confirmationChannel";
import { useQueueStrings } from "../queueStrings";
import { useStationStrings } from "./stationStrings";

/** Both actions are pills; the footer of the sheet gives them their height (44px rows on the phone). */
const ACTION = "rounded-full px-5";
/** Recording a cancellation is the full danger fill, like every destructive confirmation (components/ConfirmDialog.tsx). */
const DANGER_FILL =
  "bg-danger text-paper-raised hover:bg-danger/90 focus-visible:ring-danger/30 dark:bg-danger dark:hover:bg-danger/90";

interface SheetShellProps {
  open: boolean;
  /** Closing is refused while the result is being saved. */
  onClose: () => void;
  /** Who the sheet is about: "Mona Ali · ORD-1001". */
  who: string;
  busy: boolean;
  error: string | null;
}

/** The parts the two outcome sheets share under their own first field: how the customer was reached, and the note. */
function CallDetails({
  channel,
  onChannel,
  note,
  onNote,
  busy,
}: {
  channel: ConfirmationChannel;
  onChannel: (channel: ConfirmationChannel) => void;
  note: string;
  onNote: (note: string) => void;
  busy: boolean;
}) {
  const q = useQueueStrings();
  return (
    <>
      <ChannelPicker value={channel} onChange={onChannel} disabled={busy} />
      <Field label={q.notes}>
        {({ id }) => (
          <Textarea
            id={id}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={q.notesPlaceholder}
            disabled={busy}
            className="min-h-[72px]"
          />
        )}
      </Field>
    </>
  );
}

function OutcomeSheet({
  open,
  onClose,
  who,
  busy,
  error,
  title,
  submit,
  onSubmit,
  children,
}: SheetShellProps & {
  title: string;
  /** The main action, given the id of the form it submits. */
  submit: (formId: string) => ReactNode;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const t = useStationStrings();
  const formId = useId();
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      size="sm"
      title={title}
      description={who}
      footer={
        <>
          <Button type="button" variant="outline" className={ACTION} onClick={onClose} disabled={busy}>
            {t.back}
          </Button>
          {submit(formId)}
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {error && <Alert variant="danger">{error}</Alert>}
        {children}
      </form>
    </Sheet>
  );
}

/**
 * "Call me later": the customer asked for another time. The order comes back
 * to the queue after the server's own delay (24 hours), which the sheet says;
 * then how they were reached and a note.
 */
export function LaterSheet({
  channel,
  onChannel,
  note,
  onNote,
  onSave,
  ...shell
}: SheetShellProps & {
  channel: ConfirmationChannel;
  onChannel: (channel: ConfirmationChannel) => void;
  note: string;
  onNote: (note: string) => void;
  onSave: () => void;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  return (
    <OutcomeSheet
      {...shell}
      title={t.laterTitle}
      onSubmit={onSave}
      submit={(formId) => (
        <Button type="submit" form={formId} className={ACTION} disabled={shell.busy}>
          {shell.busy ? q.saving : q.saveOutcome}
        </Button>
      )}
    >
      <p className="text-sm leading-5 text-ink-soft">{t.laterHint}</p>
      <CallDetails channel={channel} onChannel={onChannel} note={note} onNote={onNote} busy={shell.busy} />
    </OutcomeSheet>
  );
}

/**
 * "Cancelled": the customer does not want the order. The existing rejection reason
 * is asked for (required, as in the list), then the channel and a note.
 */
export function CancelSheet({
  reason,
  onReason,
  channel,
  onChannel,
  note,
  onNote,
  onSave,
  ...shell
}: SheetShellProps & {
  reason: string;
  onReason: (reason: string) => void;
  channel: ConfirmationChannel;
  onChannel: (channel: ConfirmationChannel) => void;
  note: string;
  onNote: (note: string) => void;
  onSave: () => void;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  const missing = reason.trim() === "";
  return (
    <OutcomeSheet
      {...shell}
      title={t.cancelTitle}
      onSubmit={() => {
        if (!missing) onSave();
      }}
      submit={(formId) => (
        <Button
          type="submit"
          form={formId}
          variant="danger"
          data-fill="danger"
          className={cn(ACTION, DANGER_FILL)}
          disabled={shell.busy || missing}
        >
          {shell.busy ? q.saving : t.cancelSave}
        </Button>
      )}
    >
      <TextField
        label={q.rejectionReason}
        required
        value={reason}
        onChange={(e) => onReason(e.target.value)}
        placeholder={q.rejectionPlaceholder}
        disabled={shell.busy}
      />
      <CallDetails channel={channel} onChannel={onChannel} note={note} onNote={onNote} busy={shell.busy} />
    </OutcomeSheet>
  );
}

/**
 * A note for a result recorded in one tap (confirmed, no answer): typed here,
 * kept on the card, and sent with whichever result is pressed next.
 */
export function NoteSheet({
  open,
  onClose,
  who,
  note,
  onNote,
}: {
  open: boolean;
  onClose: () => void;
  who: string;
  note: string;
  onNote: (note: string) => void;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  const formId = useId();
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="sm"
      title={t.noteTitle}
      description={who}
      footer={
        <Button type="submit" form={formId} className={ACTION}>
          {t.noteDone}
        </Button>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <Field label={q.notes} hint={t.noteHint}>
          {({ id }) => (
            <Textarea id={id} value={note} onChange={(e) => onNote(e.target.value)} placeholder={q.notesPlaceholder} />
          )}
        </Field>
      </form>
    </Sheet>
  );
}
