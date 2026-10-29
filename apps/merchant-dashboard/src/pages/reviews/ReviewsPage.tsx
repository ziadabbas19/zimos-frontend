import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { reviewsDelete, type Review, type ReviewStatus } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconPlus, IconRefresh, IconReviews, IconSearch } from "@/components/icons";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { ActiveFilters } from "@/pages/returns/rowkit/ActiveFilters";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AddReviewDialog } from "./AddReviewDialog";
import {
  NO_REVIEW_FILTERS,
  ReviewFilterSheet,
  countReviewFilters,
  isReviewKind,
  matchesReviewFilters,
  readSourceParam,
  useReviewFilterChips,
  type ContentFilter,
  type RatingBand,
  type ReviewFilterState,
} from "./ReviewFilters";
import { ReviewQuickLook } from "./ReviewQuickLook";
import { REVIEW_COLUMNS, ReviewRow } from "./ReviewRow";
import { REVIEW_WORDS, actionTo, fold, isLegacyAdded, reviewAuthor, statusAfter, type ModerateAction } from "./reviewModel";
import { refreshWorkCounts } from "@/lib/workCounts";

const STRINGS = {
  en: {
    title: "Reviews",
    description: "Anyone can review a product or your store. Nothing shows until you approve it, and only reviews from delivered orders count in your stars.",
    legacyNote:
      "Reviews you added yourself show as before, but no longer count in your stars: your average comes only from published reviews of customers whose order was delivered. Edit one to give it its source: it then shows apart, with that source.",
    add: "Add a review from another site",
    tools: "Tools",
    refresh: "Refresh the list",
    searchLabel: "Search the reviews",
    searchPlaceholder: "Product, customer or a word they wrote",
    chipsLabel: "Reviews by status",
    tabPending: "Waiting for you",
    tabApproved: "In the store",
    tabRejected: "Hidden",
    tabAll: "All",
    colProduct: "Product",
    colReview: "Review",
    colStatus: "Status",
    colAge: "Written",
    colAction: "Next step",
    firstTitle: "No reviews yet",
    firstBody: "A review arrives when a shopper writes one on a product or your store. You can also add real reviews your customers left you on other sites.",
    emptyPending: "No reviews are waiting for you",
    emptyPendingBody: "A new review lands here first, and shows in your store once you approve it.",
    emptyApproved: "No review shows in your store yet",
    emptyRejected: "No hidden reviews",
    seeAll: "See all reviews",
    emptyFiltered: "No review matches this search or these filters",
    clearAll: "Clear the search and filters",
    searchAll: "Look in all reviews",
    toastApproved: "Approved — it shows in your store now.",
    toastStars: "Published — your store shows its stars only.",
    toastHidden: "Hidden — it won't show in your store.",
    toastShown: "The review shows in your store again.",
    toastHiddenAgain: "The review is off your store.",
    hideIt: "Hide it",
    showIt: "Show it",
    deleteTitle: "Delete the review by {who}?",
    deleteBody: "It leaves your store for good and can't be brought back.",
    deleteConfirm: "Delete review",
    deleting: "Deleting…",
    deleted: "Review deleted.",
  },
  ar: {
    title: "التقييمات",
    description: "يمكن لأي شخص تقييم منتج أو متجرك، ولا يظهر أي تقييم إلا بعد موافقتك، ولا يدخل في متوسط نجومك إلا تقييم من طلب تم تسليمه.",
    legacyNote:
      "التقييمات التي أضفتها بنفسك تظهر كما كانت، لكنها لم تعد تدخل في متوسط نجومك: المتوسط يُحسب من التقييمات المنشورة لعملاء تم تسليم طلباتهم فقط. عدّل أيًّا منها لتحدد مصدره، فيظهر منفصلًا مع ذلك المصدر.",
    add: "إضافة تقييم من مصدر خارجي",
    tools: "أدوات",
    refresh: "تحديث القائمة",
    searchLabel: "ابحث في التقييمات",
    searchPlaceholder: "منتج، عميل أو كلمة من التقييم",
    chipsLabel: "التقييمات حسب الحالة",
    tabPending: "تنتظر موافقتك",
    tabApproved: "ظاهرة في المتجر",
    tabRejected: "مخفية",
    tabAll: "الكل",
    colProduct: "المنتج",
    colReview: "التقييم",
    colStatus: "الحالة",
    colAge: "كُتب",
    colAction: "الخطوة التالية",
    firstTitle: "لا توجد تقييمات بعد",
    firstBody: "يصل التقييم عندما يكتبه عميل على منتج أو على متجرك. ويمكنك أيضًا إضافة تقييمات حقيقية تركها لك عملاؤك على مواقع أخرى.",
    emptyPending: "لا توجد تقييمات تنتظر موافقتك",
    emptyPendingBody: "أي تقييم جديد يصل هنا أولًا، ويظهر في متجرك بعد موافقتك عليه.",
    emptyApproved: "لا يظهر أي تقييم في متجرك بعد",
    emptyRejected: "لا توجد تقييمات مخفية",
    seeAll: "عرض كل التقييمات",
    emptyFiltered: "لا يوجد تقييم مطابق لهذا البحث أو هذه الفلاتر",
    clearAll: "مسح البحث والفلاتر",
    searchAll: "البحث في كل التقييمات",
    toastApproved: "تمت الموافقة — يظهر الآن في متجرك.",
    toastStars: "تم النشر — يعرض متجرك نجومه فقط.",
    toastHidden: "تم الإخفاء — لن يظهر في متجرك.",
    toastShown: "عاد التقييم إلى الظهور في متجرك.",
    toastHiddenAgain: "أُزيل التقييم من متجرك.",
    hideIt: "إخفاؤه",
    showIt: "إظهاره",
    deleteTitle: "حذف تقييم {who}؟",
    deleteBody: "سيُحذف من متجرك نهائيًا ولا يمكن استرجاعه.",
    deleteConfirm: "حذف التقييم",
    deleting: "جارٍ الحذف…",
    deleted: "تم حذف التقييم.",
  },
} satisfies Messages;

/** "all" is the whole list; the others are the statuses a review can be in. */
type StatusTab = "all" | ReviewStatus;

/** Waiting first: this page is a moderation queue before it is an archive. */
const DEFAULT_TAB: StatusTab = "pending";

function tabOf(value: string | null): StatusTab {
  return value === "all" || value === "approved" || value === "rejected" ? value : DEFAULT_TAB;
}

/**
 * /reviews — the moderation list: what waits for a decision first, the rest a
 * chip away. The list is read whole and filtered here, so the chips can say
 * how many each status holds and a chip answers at once. A row opens Quick
 * Look; its ONE button is the move its status allows, taken at once and
 * undone from the toast.
 *
 * `?status=` keeps the chosen chip (absent = waiting) and `?source=` the
 * origin filter (customer | external | added; the older manual and import
 * both read as added) — both are what the product link import points at.
 *
 * A review the store added (from another site, or by hand before sources
 * existed) is edited in the same form that adds one; a customer's never is.
 */
export function ReviewsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get("status"));
  const source = readSourceParam(params.get("source"));
  const rawKind = params.get("kind");
  const kind = isReviewKind(rawKind) ? rawKind : null;

  function patchParams(change: (out: URLSearchParams) => void) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        change(out);
        return out;
      },
      { replace: true }
    );
  }
  function selectTab(next: StatusTab) {
    patchParams((out) => {
      if (next === DEFAULT_TAB) out.delete("status");
      else out.set("status", next);
    });
  }

  const list = useCachedAsync<Review[]>(`reviews:${workspaceId}`, () => apiClient.listReviews(workspaceId), [workspaceId]);
  const reviews = useMemo(() => list.data ?? [], [list.data]);

  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<RatingBand | null>(null);
  const [content, setContent] = useState<ContentFilter | null>(null);
  const filters: ReviewFilterState = useMemo(() => ({ kind, source, rating, content }), [kind, source, rating, content]);
  function setFilters(next: ReviewFilterState) {
    setRating(next.rating);
    setContent(next.content);
    if (next.source !== source || next.kind !== kind) {
      patchParams((out) => {
        if (next.source) out.set("source", next.source);
        else out.delete("source");
        if (next.kind) out.set("kind", next.kind);
        else out.delete("kind");
      });
    }
  }

  const [filtersOpen, setFiltersOpen] = useState(false);
  // The form, for a new review from another site (review null) or for editing one the store added.
  const [form, setForm] = useState<{ open: boolean; review: Review | null }>({ open: false, review: null });
  // The review being looked at stays here while its panel closes, so the panel does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  // The same for the review being deleted: its name stays in the question while the question closes.
  const [removing, setRemoving] = useState<{ review: Review; open: boolean } | null>(null);
  const [busy, setBusy] = useState<Record<string, ModerateAction>>({});

  const filtered = useMemo(() => reviews.filter((review) => matchesReviewFilters(review, filters)), [reviews, filters]);
  const counts = useMemo(() => {
    const tally: Record<ReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const review of filtered) if (review.status in tally) tally[review.status] += 1;
    return tally;
  }, [filtered]);
  const inTab = useMemo(() => (tab === "all" ? filtered : filtered.filter((review) => review.status === tab)), [filtered, tab]);

  const query = fold(search.trim());
  const visible = query
    ? inTab.filter((review) => {
        const haystack = [review.product?.name, reviewAuthor(review, ""), review.comment];
        return haystack.some((part) => part && fold(part).includes(query));
      })
    : inTab;

  const activeFilters = countReviewFilters(filters);
  const narrowed = query !== "" || activeFilters > 0;
  const filterChips = useReviewFilterChips(filters, setFilters);

  function clearAll() {
    setSearch("");
    setFilters(NO_REVIEW_FILTERS);
  }

  function patchRow(id: string, patch: Partial<Review>) {
    list.setData((prev) => (prev ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  /** The request alone: the row already shows where it is going, and goes back if the server says no. */
  async function send(review: Review, action: ModerateAction) {
    const before = { status: review.status, showText: review.showText };
    patchRow(review.id, { status: statusAfter(action), ...(action === "reject" ? {} : { showText: action === "approve" }) });
    try {
      // The answer is the bare row: the product and the customer the list joined in stay as they are.
      const updated = await apiClient.moderateReview(workspaceId, review.id, action);
      patchRow(review.id, { status: updated.status, showText: updated.showText, updatedAt: updated.updatedAt });
      // The sidebar's "waiting" badge follows at once.
      refreshWorkCounts();
    } catch (err) {
      patchRow(review.id, before);
      throw err;
    }
  }

  /** Approve or hide, at once. The toast is the way back. */
  function moderate(review: Review, action: ModerateAction) {
    const before = review.status;
    const after = statusAfter(action);
    const sameText = action === "reject" || (review.showText !== false) === (action === "approve");
    if ((before === after && sameText) || busy[review.id]) return;
    setBusy((prev) => ({ ...prev, [review.id]: action }));
    void send(review, action)
      .then(() => {
        const moved: Review = { ...review, status: after, ...(action === "reject" ? {} : { showText: action === "approve" }) };
        const back = before === after ? null : actionTo(before);
        if (action === "approve_stars" || (before === after && action === "approve")) {
          toast.success(action === "approve_stars" ? t.toastStars : t.toastApproved);
        } else if (back) {
          // The opposite call puts it exactly where it was: a true Undo.
          toast.undo(after === "approved" ? t.toastShown : t.toastHiddenAgain, () => send(moved, back));
        } else {
          // A waiting review cannot go back to waiting (the API has only the two moves): the toast offers the other one, by its name.
          const other: ModerateAction = action === "reject" ? "approve" : "reject";
          toast.notify("success", after === "approved" ? t.toastApproved : t.toastHidden, {
            action: { label: other === "reject" ? t.hideIt : t.showIt, onClick: () => moderate(moved, other) },
          });
        }
      })
      .catch((err: unknown) => toast.error(errorMessage(err)))
      .finally(() => {
        setBusy((prev) => {
          const next = { ...prev };
          delete next[review.id];
          return next;
        });
      });
  }

  const peeked = peek ? (reviews.find((review) => review.id === peek.id) ?? null) : null;

  /** Delete asks first. Quick Look steps aside for the question: two sheets are never stacked. */
  function askDelete(review: Review) {
    setPeek((current) => (current ? { ...current, open: false } : current));
    setRemoving({ review, open: true });
  }

  /** The form, filled with a review the store added. Quick Look steps aside for it too. */
  function openEdit(review: Review) {
    setPeek((current) => (current ? { ...current, open: false } : current));
    setForm({ open: true, review });
  }

  /** What an edit changed, laid over the row: the order facts the list joined in stay as they are. */
  function applyEdit(id: string, saved: Review) {
    patchRow(id, {
      kind: saved.kind,
      productId: saved.productId,
      product: saved.product ?? null,
      authorName: saved.authorName,
      rating: saved.rating,
      comment: saved.comment,
      photos: saved.photos,
      source: saved.source,
      externalSource: saved.externalSource ?? null,
      externalSourceLabel: saved.externalSourceLabel ?? null,
      externalUrl: saved.externalUrl ?? null,
      reviewedAt: saved.reviewedAt ?? null,
      updatedAt: saved.updatedAt,
    });
  }

  // While the list is on its way a chip holds its place with a dash (null) instead of a zero.
  const figure = (count: number) => (list.loading ? null : count);
  const chips: ChipItem<StatusTab>[] = [
    { value: "pending", label: t.tabPending, count: figure(counts.pending), tone: "attention" },
    { value: "approved", label: t.tabApproved, count: figure(counts.approved) },
    { value: "rejected", label: t.tabRejected, count: figure(counts.rejected) },
    { value: "all", label: t.tabAll, count: figure(filtered.length) },
  ];

  const tools: ContextMenuItem[] = [
    { id: "refresh", label: t.refresh, icon: IconRefresh, onSelect: () => void list.refresh({ silent: true }) },
  ];

  const addButton = (
    <Button className="min-h-11 rounded-full px-5" onClick={() => setForm({ open: true, review: null })}>
      <IconPlus className="size-4" aria-hidden />
      {t.add}
    </Button>
  );

  const empty = narrowed ? (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptyFiltered}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={clearAll}>
            {t.clearAll}
          </Button>
          {tab !== "all" && (
            <Button variant="outline" className="rounded-full px-5" onClick={() => selectTab("all")}>
              {t.searchAll}
            </Button>
          )}
        </div>
      }
    />
  ) : reviews.length === 0 ? (
    // A store nobody has reviewed yet: what the page is for, and the one thing to do about it.
    <EmptyState
      icon={<IconReviews aria-hidden />}
      title={t.firstTitle}
      description={t.firstBody}
      action={
        <Button className="rounded-full px-5" onClick={() => setForm({ open: true, review: null })}>
          <IconPlus className="size-4" aria-hidden />
          {t.add}
        </Button>
      }
    />
  ) : tab === "pending" ? (
    <EmptyState
      icon={<IconReviews aria-hidden />}
      tone="success"
      title={t.emptyPending}
      description={t.emptyPendingBody}
      action={
        <Button variant="outline" className="rounded-full px-5" onClick={() => selectTab("all")}>
          {t.seeAll}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<IconReviews aria-hidden />}
      title={tab === "approved" ? t.emptyApproved : t.emptyRejected}
      action={
        <Button variant="outline" className="rounded-full px-5" onClick={() => selectTab("all")}>
          {t.seeAll}
        </Button>
      }
    />
  );

  const rows = visible.map((review) => (
    <ReviewRow
      key={review.id}
      review={review}
      compact={compact}
      busy={busy[review.id] ?? null}
      current={peek?.open === true && peek.id === review.id}
      onPeek={() => setPeek({ id: review.id, open: true })}
      onModerate={(action) => moderate(review, action)}
      onEdit={() => openEdit(review)}
      onDelete={() => askDelete(review)}
    />
  ));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the list: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={<ItemMenu items={tools} label={t.tools} />}
        primaryAction={addButton}
      />

      <div className="flex flex-col gap-3">
        <ListToolbar
          search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
          filters={{ count: activeFilters, onOpen: () => setFiltersOpen(true) }}
        />
        <ChipRow items={chips} value={tab} onChange={selectTab} label={t.chipsLabel} collapseEmpty={false} countsLoading={list.loading} />
        <ActiveFilters filters={filterChips} onClearAll={() => setFilters(NO_REVIEW_FILTERS)} />
        {/* About the reviews added by hand before reviews had a source; one from another site says its own. */}
        {reviews.some(isLegacyAdded) && (
          <p data-slot="reviews-legacy-note" className="rounded-2xl bg-paper-sunken px-4 py-3 text-[13px] leading-5 text-ink-soft">
            {t.legacyNote}
          </p>
        )}

        <DataState
          loading={list.loading}
          // A refresh that failed behind rows already on screen leaves them there.
          error={reviews.length === 0 ? list.error : null}
          onRetry={() => void list.refresh()}
          skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
        >
          {visible.length === 0 ? (
            empty
          ) : compact ? (
            <ul aria-label={t.title} className="flex flex-col gap-2.5">
              {rows}
            </ul>
          ) : (
            <DeskList
              columns={REVIEW_COLUMNS}
              label={t.title}
              head={[{ label: t.colProduct }, { label: t.colReview }, { label: t.colStatus }, { label: t.colAge }, { label: t.colAction, end: true }]}
            >
              {rows}
            </DeskList>
          )}
        </DataState>
      </div>

      <ReviewFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        value={filters}
        onChange={setFilters}
        matching={visible.length}
        legacy={reviews.some(isLegacyAdded)}
      />

      <ReviewQuickLook
        review={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        busy={peeked ? (busy[peeked.id] ?? null) : null}
        onModerate={(action) => {
          if (peeked) moderate(peeked, action);
        }}
        onEdit={() => {
          if (peeked) openEdit(peeked);
        }}
        onDelete={() => {
          if (peeked) askDelete(peeked);
        }}
      />

      <AddReviewDialog
        open={form.open}
        review={form.review}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
        onSaved={(saved) => {
          const edited = form.review;
          setForm((current) => ({ ...current, open: false }));
          if (edited) applyEdit(edited.id, saved);
          else void list.refresh({ silent: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={fmt(t.deleteTitle, { who: removing ? reviewAuthor(removing.review, words.unknownCustomer) : "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setRemoving((current) => (current ? { ...current, open: false } : current))}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await reviewsDelete(apiClient, workspaceId, removing.review.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          const id = removing.review.id;
          toast.success(t.deleted);
          list.setData((prev) => (prev ?? []).filter((row) => row.id !== id));
          refreshWorkCounts();
          setRemoving((current) => (current ? { ...current, open: false } : current));
        }}
      />
    </div>
  );
}
