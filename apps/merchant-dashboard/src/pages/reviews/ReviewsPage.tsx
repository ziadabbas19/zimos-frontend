import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { catalogDeleteManualReview, type Review, type ReviewStatus } from "@store-builder/api-client";
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
  isReviewSource,
  matchesReviewFilters,
  useReviewFilterChips,
  type ContentFilter,
  type RatingBand,
  type ReviewFilterState,
} from "./ReviewFilters";
import { ReviewQuickLook } from "./ReviewQuickLook";
import { REVIEW_COLUMNS, ReviewRow } from "./ReviewRow";
import { REVIEW_WORDS, actionTo, fold, reviewAuthor, statusAfter, type ModerateAction } from "./reviewModel";

const STRINGS = {
  en: {
    title: "Reviews",
    description: "A customer can review a product once it reaches them. Nothing shows in your store until you approve it.",
    add: "Add review",
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
    firstBody: "A review arrives when a customer who received a product writes one. You can also add one that reached you on WhatsApp yourself.",
    emptyPending: "No reviews are waiting for you",
    emptyPendingBody: "A new review lands here first, and shows in your store once you approve it.",
    emptyApproved: "No review shows in your store yet",
    emptyRejected: "No hidden reviews",
    seeAll: "See all reviews",
    emptyFiltered: "No review matches this search or these filters",
    clearAll: "Clear the search and filters",
    searchAll: "Look in all reviews",
    toastApproved: "Approved — it shows in your store now.",
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
    description: "يقيّم العميل المنتج بعد استلامه، ولا يظهر أي تقييم في متجرك إلا بعد موافقتك عليه.",
    add: "إضافة تقييم",
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
    firstBody: "يصل التقييم عندما يكتبه عميل استلم منتجًا. ويمكنك أيضًا إضافة تقييم وصلك عبر واتساب بنفسك.",
    emptyPending: "لا توجد تقييمات تنتظر موافقتك",
    emptyPendingBody: "أي تقييم جديد يصل هنا أولًا، ويظهر في متجرك بعد موافقتك عليه.",
    emptyApproved: "لا يظهر أي تقييم في متجرك بعد",
    emptyRejected: "لا توجد تقييمات مخفية",
    seeAll: "عرض كل التقييمات",
    emptyFiltered: "لا يوجد تقييم مطابق لهذا البحث أو هذه الفلاتر",
    clearAll: "مسح البحث والفلاتر",
    searchAll: "البحث في كل التقييمات",
    toastApproved: "تمت الموافقة — يظهر الآن في متجرك.",
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
 * source filter — both are what the product link import points at.
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
  const rawSource = params.get("source");
  const source = isReviewSource(rawSource) ? rawSource : null;

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
  const filters: ReviewFilterState = useMemo(() => ({ source, rating, content }), [source, rating, content]);
  function setFilters(next: ReviewFilterState) {
    setRating(next.rating);
    setContent(next.content);
    if (next.source !== source) {
      patchParams((out) => {
        if (next.source) out.set("source", next.source);
        else out.delete("source");
      });
    }
  }

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
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
    const before = review.status;
    patchRow(review.id, { status: statusAfter(action) });
    try {
      // The answer is the bare row: the product and the customer the list joined in stay as they are.
      const updated = await apiClient.moderateReview(workspaceId, review.id, action);
      patchRow(review.id, { status: updated.status, updatedAt: updated.updatedAt });
    } catch (err) {
      patchRow(review.id, { status: before });
      throw err;
    }
  }

  /** Approve or hide, at once. The toast is the way back. */
  function moderate(review: Review, action: ModerateAction) {
    const before = review.status;
    const after = statusAfter(action);
    if (before === after || busy[review.id]) return;
    setBusy((prev) => ({ ...prev, [review.id]: action }));
    void send(review, action)
      .then(() => {
        const moved: Review = { ...review, status: after };
        const back = actionTo(before);
        if (back) {
          // The opposite call puts it exactly where it was: a true Undo.
          toast.undo(after === "approved" ? t.toastShown : t.toastHiddenAgain, () => send(moved, back));
        } else {
          // A waiting review cannot go back to waiting (the API has only the two moves): the toast offers the other one, by its name.
          const other: ModerateAction = action === "approve" ? "reject" : "approve";
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
    <Button className="min-h-11 rounded-full px-5" onClick={() => setAdding(true)}>
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
        <Button className="rounded-full px-5" onClick={() => setAdding(true)}>
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

      <ReviewFilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} value={filters} onChange={setFilters} matching={visible.length} />

      <ReviewQuickLook
        review={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        busy={peeked ? (busy[peeked.id] ?? null) : null}
        onModerate={(action) => {
          if (peeked) moderate(peeked, action);
        }}
        onDelete={() => {
          if (peeked) askDelete(peeked);
        }}
      />

      <AddReviewDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          void list.refresh({ silent: true });
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
            await catalogDeleteManualReview(apiClient, workspaceId, removing.review.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          const id = removing.review.id;
          toast.success(t.deleted);
          list.setData((prev) => (prev ?? []).filter((row) => row.id !== id));
          setRemoving((current) => (current ? { ...current, open: false } : current));
        }}
      />
    </div>
  );
}
