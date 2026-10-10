import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { SupportTicket, SupportTicketCategory } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { SUPPORT_CATEGORIES, useSupportLabels } from "./supportLabels";

const STRINGS = {
  en: {
    title: "New ticket",
    description: "Tell the Zimos team what you need. We reply here, in the ticket.",
    subject: "Subject",
    subjectPlaceholder: "What do you need help with?",
    category: "Topic",
    message: "Message",
    messagePlaceholder: "Describe the problem. Include order numbers or links if they help.",
    send: "Send",
    sending: "Sending…",
    cancel: "Cancel",
    subjectTooShort: "Write a subject of at least {n} letters, so we know what it is about.",
    messageRequired: "Write what you need help with.",
  },
  ar: {
    title: "تذكرة جديدة",
    description: "أخبر فريق زيموس بما تحتاجه. سنرد عليك هنا في التذكرة.",
    subject: "الموضوع",
    subjectPlaceholder: "بماذا تحتاج المساعدة؟",
    category: "النوع",
    message: "الرسالة",
    messagePlaceholder: "اشرح المشكلة. أضف أرقام الطلبات أو الروابط إن كانت مفيدة.",
    send: "إرسال",
    sending: "جارٍ الإرسال…",
    cancel: "إلغاء",
    subjectTooShort: "اكتب موضوعًا من {n} أحرف على الأقل، لنعرف ما يدور حوله.",
    messageRequired: "اكتب ما تحتاج المساعدة فيه.",
  },
} satisfies Messages;

/** The shortest subject the form takes. */
const SUBJECT_MIN = 3;

/**
 * «تذكرة جديدة», in a sheet over the list: subject, topic, message — what the
 * old form on the page asked, checked the same way and sent to the same place.
 * A problem is said under its own field, and the first one gets the caret.
 * The sheet asks before a half-written message is thrown away.
 */
export function NewTicketSheet({ open, onClose, onOpened }: { open: boolean; onClose: () => void; onOpened: (ticket: SupportTicket) => void }) {
  const t = useT(STRINGS);
  const labels = useSupportLabels();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const bodyId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("general");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});

  // What was typed stays while the sheet is only put aside; a ticket that was sent leaves it empty.
  useEffect(() => {
    if (open) {
      setError(null);
      setErrors({});
    }
  }, [open]);

  function focusField(name: "subject" | "body") {
    const control = name === "body" ? document.getElementById(bodyId) : formRef.current?.querySelector<HTMLElement>('[name="subject"]');
    control?.focus();
    control?.scrollIntoView({ block: "center" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: { subject?: string; body?: string } = {};
    if (subject.trim().length < SUBJECT_MIN) next.subject = fmt(t.subjectTooShort, { n: SUBJECT_MIN });
    if (!body.trim()) next.body = t.messageRequired;
    setErrors(next);
    setError(null);
    if (next.subject || next.body) {
      focusField(next.subject ? "subject" : "body");
      return;
    }
    setBusy(true);
    try {
      const thread = await apiClient.openSupportTicket(workspaceId, { subject: subject.trim(), body: body.trim(), category });
      setSubject("");
      setBody("");
      setCategory("general");
      onOpened(thread.ticket);
    } catch (err) {
      const refused = getFieldErrors(err);
      const named = { subject: refused.subject, body: refused.body };
      if (named.subject || named.body) {
        setErrors(named);
        focusField(named.subject ? "subject" : "body");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.sending : t.send}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField
          name="subject"
          label={t.subject}
          required
          maxLength={200}
          dir="auto"
          placeholder={t.subjectPlaceholder}
          value={subject}
          error={errors.subject}
          onChange={(e) => {
            setSubject(e.target.value);
            if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
          }}
        />
        <Field label={t.category}>
          {({ id }) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as SupportTicketCategory)} className="h-11 text-base md:text-sm">
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {labels.category(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="space-y-1.5">
          <label htmlFor={bodyId} className="block text-sm font-medium text-ink">
            {t.message}
            <span className="text-danger"> *</span>
          </label>
          <Textarea
            id={bodyId}
            rows={5}
            maxLength={5000}
            dir="auto"
            placeholder={t.messagePlaceholder}
            value={body}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={errors.body ? `${bodyId}-error` : undefined}
            onChange={(e) => {
              setBody(e.target.value);
              if (errors.body) setErrors((prev) => ({ ...prev, body: undefined }));
            }}
            className="text-base md:text-sm"
          />
          {errors.body && (
            <p id={`${bodyId}-error`} role="alert" className="text-xs font-medium text-danger">
              {errors.body}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
