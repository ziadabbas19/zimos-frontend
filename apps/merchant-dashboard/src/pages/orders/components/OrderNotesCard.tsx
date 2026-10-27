import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button, ZLoader } from "@store-builder/ui";
import { ordersAddNote, ordersDeleteNote, ordersListNotes, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    title: "Notes",
    description: "For your team. Tick the box to show a note to the customer on the tracking page.",
    placeholder: "Write a note…",
    label: "New note",
    showToCustomer: "Show this note to the customer",
    add: "Add note",
    adding: "Adding…",
    empty: "No notes yet.",
    loading: "Loading notes…",
    failed: "Couldn't load the notes.",
    retry: "Try again",
    public: "Shown to customer",
    internal: "Internal",
    delete: "Delete note",
    deleted: "Note deleted.",
    orderNote: "Note on the order",
    unknownAuthor: "Team member",
  },
  ar: {
    title: "الملاحظات",
    description: "لفريقك. علّم على المربع لإظهار الملاحظة للعميل في صفحة التتبع.",
    placeholder: "اكتب ملاحظة…",
    label: "ملاحظة جديدة",
    showToCustomer: "إظهار هذه الملاحظة للعميل",
    add: "إضافة ملاحظة",
    adding: "جارٍ الإضافة…",
    empty: "لا توجد ملاحظات بعد.",
    loading: "جارٍ تحميل الملاحظات…",
    failed: "تعذّر تحميل الملاحظات.",
    retry: "حاول مرة أخرى",
    public: "ظاهرة للعميل",
    internal: "داخلية",
    delete: "حذف الملاحظة",
    deleted: "تم حذف الملاحظة.",
    orderNote: "ملاحظة على الأوردر",
    unknownAuthor: "أحد أعضاء الفريق",
  },
} satisfies Messages;

export function OrderNotesCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const notes = useAsync(() => ordersListNotes(apiClient, workspaceId, order.id), [workspaceId, order.id]);
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await ordersAddNote(apiClient, workspaceId, order.id, {
        body: body.trim(),
        visibility: isPublic ? "public" : "internal",
      });
      setBody("");
      setIsPublic(false);
      await notes.refresh({ silent: true });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(noteId: string) {
    try {
      await ordersDeleteNote(apiClient, workspaceId, order.id, noteId);
      toast.success(t.deleted);
      await notes.refresh({ silent: true });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Section title={t.title} description={t.description}>
      <form onSubmit={submit} className="space-y-2">
        <label className="sr-only" htmlFor={`note-${order.id}`}>
          {t.label}
        </label>
        <Textarea
          id={`note-${order.id}`}
          rows={2}
          maxLength={2000}
          value={body}
          placeholder={t.placeholder}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            {t.showToCustomer}
          </label>
          <Button type="submit" size="sm" className="min-h-11" disabled={saving || !body.trim()}>
            {saving ? t.adding : t.add}
          </Button>
        </div>
      </form>

      <div className="mt-4 border-t border-line pt-3">
        {notes.loading && !notes.data ? (
          <ZLoader size="sm" label={t.loading} />
        ) : notes.error ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
            {t.failed}
            <Button size="sm" variant="outline" onClick={() => notes.refresh()}>
              {t.retry}
            </Button>
          </p>
        ) : (
          <ul className="space-y-3">
            {order.notes && (
              <li className="rounded-[0.5rem] border border-line bg-paper px-3 py-2">
                <p className="text-xs text-ink-soft">{t.orderNote}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{order.notes}</p>
              </li>
            )}
            {(notes.data ?? []).map((note) => (
              <li key={note.id} className="rounded-[0.5rem] border border-line bg-paper px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span className="font-medium text-ink">{note.author?.fullName ?? t.unknownAuthor}</span>
                  <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
                  <StatusBadge
                    value={note.visibility}
                    tone={note.visibility === "public" ? "info" : "neutral"}
                    text={note.visibility === "public" ? t.public : t.internal}
                  />
                  <button
                    type="button"
                    onClick={() => remove(note.id)}
                    aria-label={t.delete}
                    title={t.delete}
                    className="ms-auto inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{note.body}</p>
              </li>
            ))}
            {!order.notes && (notes.data ?? []).length === 0 && <li className="text-sm text-ink-soft">{t.empty}</li>}
          </ul>
        )}
      </div>
    </Section>
  );
}
