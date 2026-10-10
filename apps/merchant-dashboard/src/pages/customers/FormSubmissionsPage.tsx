import { useEffect, useId, useMemo, useState } from "react";
import { Button, cn } from "@store-builder/ui";
import {
  formSubmissionsDelete,
  formSubmissionsList,
  formSubmissionsMarkRead,
  type FormSubmission,
  type FormSubmissionList,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconDelete, IconEmail, IconEmailOpen, IconEye, IconPhone, IconSearch, IconTray, IconUser, IconWhatsApp } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useAsync } from "@/lib/useAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { TagChips } from "./ContactsAllTab";

const STRINGS = {
  en: {
    title: "Form submissions",
    description: "Every message sent through a form on your store's pages.",
    back: "Contacts",
    searchLabel: "Search the messages",
    searchPlaceholder: "Name, phone, email or message",
    formFilter: "Form",
    anyForm: "All forms",
    formOption: "{form} ({count})",
    chipsLabel: "Messages by status",
    chipAll: "All",
    chipUnread: "Unread",
    unread_one: "1 unread",
    unread_other: "{n} unread",
    emptyTitle: "No messages yet",
    emptyDescription: "Add a form to a page in the website editor. Whatever shoppers send through it lands here, and each sender becomes a contact.",
    emptyAction: "Open the website editor",
    emptyFiltered: "No message matches",
    emptyFilteredHint: "Try another word, another form, or show the read ones too.",
    clearFilters: "Show all messages",
    from: "From {form}",
    page: "on {path}",
    noName: "No name",
    noMessage: "No message text",
    colSender: "From",
    colMessage: "Message",
    colForm: "Form",
    colWhen: "When",
    colActions: "Actions",
    peek: "Read the message from {name}",
    menuLabel: "Actions for the message from {name}",
    open: "Read the message",
    openContact: "Open the contact",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    call: "Call",
    whatsapp: "WhatsApp",
    copyPhone: "Copy the number",
    copied: "The number is copied",
    remove: "Delete",
    sentOn: "Sent {date}",
    message: "The message",
    fields: "What else they filled in",
    photos: "Photos",
    consent: "Agreed to marketing messages",
    addedTags: "Tags added",
    deleteTitle: "Delete the message from {name}?",
    deleteDescription: "The message and its photos are removed for good. The contact stays.",
    deleteConfirm: "Delete the message",
    deleting: "Deleting…",
    cancel: "Cancel",
    deleted: "Message deleted.",
  },
  ar: {
    title: "رسائل النماذج",
    description: "كل رسالة أُرسلت من نموذج في صفحات متجرك.",
    back: "جهات الاتصال",
    searchLabel: "ابحث في الرسائل",
    searchPlaceholder: "الاسم أو الهاتف أو البريد أو نص الرسالة",
    formFilter: "النموذج",
    anyForm: "كل النماذج",
    formOption: "{form} ({count})",
    chipsLabel: "الرسائل حسب الحالة",
    chipAll: "الكل",
    chipUnread: "غير مقروءة",
    unread_one: "رسالة واحدة غير مقروءة",
    unread_two: "رسالتان غير مقروءتين",
    unread_few: "{n} رسائل غير مقروءة",
    unread_other: "{n} رسالة غير مقروءة",
    emptyTitle: "لا توجد رسائل بعد",
    emptyDescription: "أضف نموذجًا إلى صفحة من محرر الموقع. كل ما يرسله الزوار يصل هنا، وكل مرسل يصبح جهة اتصال.",
    emptyAction: "فتح محرر الموقع",
    emptyFiltered: "لا توجد رسالة مطابقة",
    emptyFilteredHint: "جرّب كلمة أخرى أو نموذجًا آخر، أو اعرض المقروءة أيضًا.",
    clearFilters: "عرض كل الرسائل",
    from: "من {form}",
    page: "في {path}",
    noName: "بدون اسم",
    noMessage: "بدون نص",
    colSender: "من",
    colMessage: "الرسالة",
    colForm: "النموذج",
    colWhen: "متى",
    colActions: "الإجراءات",
    peek: "قراءة رسالة {name}",
    menuLabel: "إجراءات رسالة {name}",
    open: "قراءة الرسالة",
    openContact: "فتح جهة الاتصال",
    markRead: "تحديد كمقروءة",
    markUnread: "تحديد كغير مقروءة",
    call: "اتصال",
    whatsapp: "واتساب",
    copyPhone: "نسخ الرقم",
    copied: "تم نسخ الرقم",
    remove: "حذف",
    sentOn: "أُرسلت {date}",
    message: "الرسالة",
    fields: "باقي ما كتبه",
    photos: "الصور",
    consent: "وافق على الرسائل التسويقية",
    addedTags: "الوسوم المضافة",
    deleteTitle: "حذف رسالة {name}؟",
    deleteDescription: "تُحذف الرسالة وصورها نهائيًا. جهة الاتصال تبقى.",
    deleteConfirm: "حذف الرسالة",
    deleting: "جارٍ الحذف…",
    cancel: "إلغاء",
    deleted: "تم حذف الرسالة.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type ReadFilter = "all" | "unread";

const COLUMNS = "grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_max-content_max-content_max-content]";
const PILL = "rounded-full px-5";

/** What a row shows of the message: its text, or the first thing the form carried. */
function previewOf(submission: FormSubmission): string {
  return submission.message?.trim() || Object.values(submission.data)[0]?.trim() || "";
}

/**
 * Form submissions (SPEC §18.4 "Contact Form Data"): the inbox of the store's
 * page forms. A row is one message — who, the start of what they wrote, which
 * form, how long ago; pressing it opens the whole message beside the list and
 * marks it read. Calling and WhatsApp are on the row; mark read / unread,
 * open the contact and delete are in the message and in the row's menu.
 */
export function FormSubmissionsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const copy = useCopy();
  const navigate = useViewNavigate();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();
  const formSelectId = useId();

  const [formName, setFormName] = useState("");
  const [read, setRead] = useState<ReadFilter>("all");
  const [search, setSearch] = useState("");
  // The field answers at once; the request waits for the typing to pause.
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const unreadOnly = read === "unread";
  const params = useMemo(() => ({ formName: formName || undefined, unreadOnly: unreadOnly || undefined, q: q || undefined }), [formName, unreadOnly, q]);
  const list = useAsync(() => formSubmissionsList(apiClient, workspaceId, { ...params, limit: 30 }), [workspaceId, params]);
  const submissions = list.data?.submissions ?? [];
  const forms = list.data?.forms ?? [];
  const [loadingMore, setLoadingMore] = useState(false);
  // Each stays here while its sheet closes, so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const [removing, setRemoving] = useState<{ submission: FormSubmission; open: boolean } | null>(null);
  const filtered = Boolean(formName || unreadOnly || q);

  async function loadMore() {
    const cursor = list.data?.nextCursor;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await formSubmissionsList(apiClient, workspaceId, { ...params, limit: 30, cursor });
      list.setData((prev) => ({ ...prev, ...next, forms: prev?.forms, unread: prev?.unread, submissions: [...(prev?.submissions ?? []), ...next.submissions] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  /** Read or unread: the row changes at once and goes back if the save is refused. */
  async function markRead(submission: FormSubmission, isRead: boolean) {
    if (submission.isRead === isRead) return;
    // `moved` is what the change does to the count of unread messages.
    const paint = (row: FormSubmission, moved: number) =>
      list.setData((prev): FormSubmissionList => ({
        ...(prev ?? { nextCursor: null }),
        unread: prev?.unread === undefined ? undefined : Math.max(0, prev.unread + moved),
        submissions: (prev?.submissions ?? []).map((other) => (other.id === row.id ? row : other)),
      }));
    const moved = isRead ? -1 : 1;
    paint({ ...submission, isRead }, moved);
    try {
      const saved = await formSubmissionsMarkRead(apiClient, workspaceId, submission.id, isRead);
      paint(saved, 0);
    } catch (err) {
      paint(submission, -moved);
      toast.error(errorMessage(err));
    }
  }

  async function confirmRemove(submission: FormSubmission) {
    try {
      await formSubmissionsDelete(apiClient, workspaceId, submission.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.deleted);
    setRemoving((current) => (current ? { ...current, open: false } : current));
    void list.refresh({ silent: true });
  }

  const closePeek = () => setPeek((current) => (current ? { ...current, open: false } : current));
  function openMessage(submission: FormSubmission) {
    setPeek({ id: submission.id, open: true });
    // Opening a message is reading it.
    if (!submission.isRead) void markRead(submission, true);
  }
  function askRemove(submission: FormSubmission) {
    closePeek();
    setRemoving({ submission, open: true });
  }
  function clearFilters() {
    setSearch("");
    setQ("");
    setFormName("");
    setRead("all");
  }

  const nameOf = (submission: FormSubmission) => submission.fullName?.trim() || t.noName;

  function menuFor(submission: FormSubmission): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "open", label: t.open, icon: IconEye, onSelect: () => openMessage(submission) }];
    items.push(
      submission.isRead
        ? { id: "unread", label: t.markUnread, icon: IconEmail, onSelect: () => void markRead(submission, false) }
        : { id: "read", label: t.markRead, icon: IconEmailOpen, onSelect: () => void markRead(submission, true) }
    );
    const customerId = submission.customerId;
    if (customerId) items.push({ id: "contact", label: t.openContact, icon: IconUser, onSelect: () => navigate(`/customers/${customerId}`) });
    const number = submission.phone;
    if (number) {
      items.push({
        id: "call",
        label: t.call,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = `tel:+${number}`;
        },
      });
      items.push({
        id: "whatsapp",
        label: t.whatsapp,
        icon: IconWhatsApp,
        onSelect: () => {
          window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
        },
      });
      items.push({ id: "copy", label: t.copyPhone, icon: IconCopy, onSelect: () => copy(`+${number}`, t.copied) });
    }
    items.push({ id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => askRemove(submission) });
    return items;
  }

  const rows = submissions.map((submission) => {
    const name = nameOf(submission);
    const menu = menuFor(submission);
    const menuLabel = fmt(t.menuLabel, { name });
    const onPeek = () => openMessage(submission);
    const peekLabel = fmt(t.peek, { name });
    const keys = rowKeyProps(onPeek);
    const preview = previewOf(submission);
    const when = (
      <time dateTime={submission.createdAt} title={formatDateTime(submission.createdAt)}>
        {formatRelativeTime(submission.createdAt)}
      </time>
    );
    const contact = submission.phone ? <ContactActions phone={`+${submission.phone}`} name={submission.fullName} variant="icon" /> : null;

    if (compact) {
      return (
        <li key={submission.id}>
          <ContextMenu items={menu} label={menuLabel}>
            <ListRowCard
              title={<bdi>{name}</bdi>}
              amount={<span className="text-[13px] font-normal text-ink-soft">{when}</span>}
              meta={<bdi>{fmt(t.from, { form: submission.formName })}</bdi>}
              action={contact ?? undefined}
              footer={
                <p dir="auto" className={cn("line-clamp-2 basis-full text-[13px] leading-5", submission.isRead ? "text-ink-soft" : "text-ink")}>
                  {preview || t.noMessage}
                </p>
              }
              unread={!submission.isRead}
              onOpen={onPeek}
              openLabel={peekLabel}
              aria-haspopup="dialog"
              {...keys}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow
        key={submission.id}
        onOpen={onPeek}
        openLabel={peekLabel}
        keyProps={keys}
        current={peek?.open === true && peek.id === submission.id}
        menu={menu}
        menuLabel={menuLabel}
      >
        <div className="min-w-0">
          <p className={cn("flex min-w-0 items-center gap-2 text-[15px] leading-6 text-ink", submission.isRead ? "font-medium" : "font-semibold")}>
            {!submission.isRead && <span aria-hidden data-slot="form-unread-dot" className="size-2 shrink-0 rounded-full bg-primary" />}
            <bdi className="truncate">{name}</bdi>
          </p>
          <p className="truncate text-xs leading-5 text-ink-soft">
            <bdi dir="ltr">{submission.phone ? `+${submission.phone}` : (submission.email ?? "")}</bdi>
          </p>
        </div>
        <p dir="auto" className={cn("line-clamp-2 min-w-0 text-sm leading-5", submission.isRead ? "text-ink-soft" : "text-ink")}>
          {preview || t.noMessage}
        </p>
        <div className="max-w-40 truncate text-xs text-ink-soft">
          <bdi>{submission.formName}</bdi>
        </div>
        <div className="text-xs whitespace-nowrap text-ink-soft">{when}</div>
        <div className="flex items-center justify-end gap-1">
          {contact}
          <ItemMenu items={menu} label={menuLabel} />
        </div>
      </DeskRow>
    );
  });

  const peeked = peek ? (submissions.find((row) => row.id === peek.id) ?? null) : null;
  const unread = list.data?.unread;
  // The forms come with their counts: together they are every message of the store (or of the form chosen).
  const total = forms.length > 0 ? forms.filter((form) => !formName || form.formName === formName).reduce((sum, form) => sum + form.count, 0) : undefined;
  const chips: ChipItem<ReadFilter>[] = [
    { value: "all", label: t.chipAll, count: q ? undefined : total },
    { value: "unread", label: t.chipUnread, count: unread, tone: "attention" },
  ];
  const firstLoad = list.loading && !list.data;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the messages: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        back={{ to: "/customers", label: t.back }}
        titleBadge={
          unread ? (
            <span data-slot="form-unread-badge" className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-dark dark:text-primary">
              {pluralOf(t, "unread", unread)}
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}>
          {/* One form: nothing to choose between. */}
          {(forms.length > 1 || formName) && (
            <div className="w-full sm:w-56">
              <label htmlFor={formSelectId} className="sr-only">
                {t.formFilter}
              </label>
              <Select id={formSelectId} value={formName} onChange={(e) => setFormName(e.target.value)} className="h-11 rounded-full px-4 text-base md:text-sm">
                <option value="">{t.anyForm}</option>
                {forms.map((form) => (
                  <option key={form.formName} value={form.formName}>
                    {fmt(t.formOption, { form: form.formName, count: form.count })}
                  </option>
                ))}
                {formName && !forms.some((form) => form.formName === formName) && <option value={formName}>{formName}</option>}
              </Select>
            </div>
          )}
        </ListToolbar>
        <ChipRow items={chips} value={read} onChange={setRead} label={t.chipsLabel} collapseEmpty={false} countsLoading={firstLoad} />

        <DataState
          // A new search keeps the rows on screen until its answer lands: only the first load is a skeleton.
          loading={firstLoad}
          error={list.data ? null : list.error}
          onRetry={() => void list.refresh()}
          skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
        >
          <div aria-busy={list.loading || undefined} className={cn("transition-opacity duration-[var(--dur-fade)] motion-reduce:transition-none", list.loading && "opacity-60")}>
            {submissions.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={<IconSearch aria-hidden />}
                  title={t.emptyFiltered}
                  description={t.emptyFilteredHint}
                  action={
                    <Button type="button" variant="outline" className={PILL} onClick={clearFilters}>
                      {t.clearFilters}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<IconTray aria-hidden />}
                  title={t.emptyTitle}
                  description={t.emptyDescription}
                  action={
                    <Button asChild className={PILL}>
                      <ViewLink to="/website">{t.emptyAction}</ViewLink>
                    </Button>
                  }
                />
              )
            ) : compact ? (
              <ul aria-label={t.title} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={COLUMNS}
                label={t.title}
                head={[{ label: t.colSender }, { label: t.colMessage }, { label: t.colForm }, { label: t.colWhen }, { label: t.colActions, end: true }]}
              >
                {rows}
              </DeskList>
            )}
          </div>
          <LoadMore hasMore={Boolean(list.data?.nextCursor)} loading={loadingMore} onClick={() => void loadMore()} />
        </DataState>
      </div>

      <MessageSheet
        t={t}
        submission={peeked}
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        onToggleRead={(submission) => {
          // Marked unread, it goes back to the list as it came.
          if (submission.isRead) closePeek();
          void markRead(submission, !submission.isRead);
        }}
        onRemove={askRemove}
      />

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={removing ? fmt(t.deleteTitle, { name: nameOf(removing.submission) }) : ""}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deleting}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setRemoving((current) => (current ? { ...current, open: false } : current))}
        onConfirm={() => (removing ? confirmRemove(removing.submission) : undefined)}
      />
    </div>
  );
}

/**
 * The whole message: who sent it and how to reach them, what they wrote, the
 * other fields of the form, its photos, and what the form did to the contact
 * (tags, marketing consent). A bottom sheet on a phone, a panel on the end
 * edge from 640px; the list stays behind it.
 */
function MessageSheet({
  t,
  submission,
  open,
  onOpenChange,
  onToggleRead,
  onRemove,
}: {
  t: Strings;
  submission: FormSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRead: (submission: FormSubmission) => void;
  onRemove: (submission: FormSubmission) => void;
}) {
  if (!submission) return null;
  const s = submission;
  const fields = Object.entries(s.data);
  const files = s.files ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="auto-end"
      title={<bdi>{s.fullName?.trim() || t.noName}</bdi>}
      description={
        <>
          <bdi>{fmt(t.from, { form: s.formName })}</bdi>
          {s.pagePath && (
            <>
              {" "}
              <bdi dir="ltr">{fmt(t.page, { path: s.pagePath })}</bdi>
            </>
          )}
        </>
      }
      footer={
        <>
          <Button type="button" variant="outline" className="gap-2 rounded-full px-4 text-danger hover:text-danger" onClick={() => onRemove(s)}>
            <IconDelete className="size-4" aria-hidden />
            {t.remove}
          </Button>
          <Button type="button" variant="outline" className="gap-2 rounded-full px-4" onClick={() => onToggleRead(s)}>
            {s.isRead ? <IconEmail className="size-4" aria-hidden /> : <IconEmailOpen className="size-4" aria-hidden />}
            {s.isRead ? t.markUnread : t.markRead}
          </Button>
          {s.customerId && (
            <Button asChild className="gap-2 rounded-full px-5">
              <ViewLink to={`/customers/${s.customerId}`}>
                <IconUser className="size-4" aria-hidden />
                {t.openContact}
              </ViewLink>
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          {s.phone && <ContactActions phone={`+${s.phone}`} name={s.fullName} />}
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] leading-5 text-ink-soft">
            {s.phone && <bdi dir="ltr">+{s.phone}</bdi>}
            {s.email && (
              <a href={`mailto:${s.email}`} className="rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <bdi dir="ltr">{s.email}</bdi>
              </a>
            )}
            <span>{fmt(t.sentOn, { date: formatDateTime(s.createdAt) })}</span>
          </p>
        </div>

        <section>
          <h3 className="mb-1.5 text-[13px] leading-5 font-semibold text-ink-soft">{t.message}</h3>
          <p
            dir="auto"
            data-slot="form-message"
            className={cn("rounded-2xl bg-paper-sunken px-4 py-3 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap", s.message ? "text-ink" : "text-ink-soft")}
          >
            {s.message || t.noMessage}
          </p>
        </section>

        {fields.length > 0 && (
          <section>
            <h3 className="mb-1 text-[13px] leading-5 font-semibold text-ink-soft">{t.fields}</h3>
            <dl>
              {fields.map(([label, value]) => (
                <div key={label} className="border-b border-line py-2.5 last:border-b-0">
                  <dt dir="auto" className="text-xs leading-5 text-ink-soft">
                    {label}
                  </dt>
                  <dd dir="auto" className="text-sm leading-6 wrap-anywhere text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* The form's photo input (backend contacts/formFiles.js): a link that works for a few minutes. */}
        {files.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[13px] leading-5 font-semibold text-ink-soft">{t.photos}</h3>
            <ul className="flex flex-wrap gap-3">
              {files.map((file, index) => (
                <li key={index} className="w-24 text-xs text-ink-soft">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <img src={file.url} alt={file.label} loading="lazy" className="size-24 rounded-2xl object-cover ring-1 ring-line" />
                  </a>
                  <bdi className="mt-1 block truncate">{file.label}</bdi>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(s.tags.length > 0 || s.marketingConsent) && (
          <div className="space-y-2 text-[13px] leading-5 text-ink-soft">
            {s.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span>{t.addedTags}</span>
                <TagChips tags={s.tags} max={6} />
              </div>
            )}
            {s.marketingConsent && <p>{t.consent}</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
