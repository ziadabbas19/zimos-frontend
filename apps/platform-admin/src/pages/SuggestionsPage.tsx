import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { CanLink } from "@/components/Can";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips, NativeSelect, SearchInput, TextAreaField } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { useT } from "@/i18n/LocaleContext";
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUSES,
  listSuggestions,
  updateSuggestion,
  type AdminSuggestion,
  type SuggestionCategory,
  type SuggestionStatus,
} from "@/lib/suggestionsApi";

const STRINGS = {
  en: {
    title: "Suggestions",
    description: "Ideas, bugs and improvements merchants sent from their dashboard. Change the status and reply; the store sees both.",
    refresh: "Refresh",
    all: "All",
    anyCategory: "Any category",
    search: "Search title or text",
    empty: "No suggestions match.",
    status_new: "New",
    status_under_review: "Under review",
    status_planned: "Planned",
    status_done: "Done",
    category_feature: "Feature",
    category_bug: "Bug",
    category_improvement: "Improvement",
    from: "From",
    contact: "Contact",
    deletedUser: "a deleted user",
    status: "Status",
    reply: "Reply to the store",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    readOnly: "You can read suggestions; answering needs support.manage.",
    more: "Load more",
  },
  ar: {
    title: "الاقتراحات",
    description: "أفكار وأعطال وتحسينات أرسلها التجار من لوحة التحكم. غيّر الحالة واكتب الرد، ويرى المتجر الاثنين.",
    refresh: "تحديث",
    all: "الكل",
    anyCategory: "كل الأنواع",
    search: "ابحث في العنوان أو النص",
    empty: "لا توجد اقتراحات مطابقة.",
    status_new: "جديد",
    status_under_review: "قيد المراجعة",
    status_planned: "مُخطط له",
    status_done: "تم",
    category_feature: "ميزة",
    category_bug: "عطل",
    category_improvement: "تحسين",
    from: "من",
    contact: "التواصل",
    deletedUser: "مستخدم محذوف",
    status: "الحالة",
    reply: "الرد على المتجر",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ.",
    readOnly: "يمكنك قراءة الاقتراحات؛ الرد يحتاج صلاحية support.manage.",
    more: "عرض المزيد",
  },
};

type Filter = "all" | SuggestionStatus;
const PAGE = 50;

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function SuggestionsPage() {
  const t = useT(STRINGS);
  const { can } = useAuth();
  const canManage = can(P.SUPPORT_MANAGE);
  const [status, setStatus] = useState<Filter>("new");
  const [category, setCategory] = useState<"" | SuggestionCategory>("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const [limit, setLimit] = useState(PAGE);

  const { data, loading, error, refresh } = useAsync(
    () => listSuggestions({ status: status === "all" ? undefined : status, category: category || undefined, q: q || undefined, limit }),
    [status, category, q, limit]
  );
  const counts = data?.counts;
  const options: Array<{ value: Filter; label: string; count?: number }> = [
    ...SUGGESTION_STATUSES.map((s) => ({ value: s as Filter, label: t[`status_${s}`], count: counts?.[s] })),
    { value: "all", label: t.all, count: counts ? SUGGESTION_STATUSES.reduce((sum, s) => sum + counts[s], 0) : undefined },
  ];
  const rows = data?.suggestions ?? [];

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {t.refresh}
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips options={options} value={status} onChange={setStatus} />
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label={t.anyCategory} className="h-10 w-40" value={category} onChange={(e) => setCategory(e.target.value as "" | SuggestionCategory)}>
            <option value="">{t.anyCategory}</option>
            {SUGGESTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t[`category_${c}`]}
              </option>
            ))}
          </NativeSelect>
          <SearchInput value={query} onChange={setQuery} placeholder={t.search} />
        </div>
      </div>
      {!canManage && <Alert className="mb-4">{t.readOnly}</Alert>}
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {rows.length === 0 ? (
          <EmptyBlock message={t.empty} />
        ) : (
          <div className="space-y-3">
            {rows.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} canManage={canManage} onSaved={() => void refresh()} />
            ))}
            {data && data.total > rows.length && (
              <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
                {t.more}
              </Button>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

function SuggestionCard({ suggestion: s, canManage, onSaved }: { suggestion: AdminSuggestion; canManage: boolean; onSaved: () => void }) {
  const t = useT(STRINGS);
  const [status, setStatus] = useState<SuggestionStatus>(s.status);
  const [reply, setReply] = useState(s.adminReply ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await updateSuggestion(s.id, { status, adminReply: reply.trim() || null });
      setMessage({ kind: "ok", text: t.saved });
      onSaved();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">{s.title}</p>
          <p className="text-xs text-ink-soft">
            {t[`category_${s.category}`]} · {t[`status_${s.status}`]} · {formatDateTime(s.createdAt)} · {t.from}{" "}
            <CanLink permission={P.WORKSPACES_VIEW} to={`/workspaces/${s.workspace.id}`} className="hover:text-primary">
              {s.workspace.name ?? s.workspace.id}
            </CanLink>{" "}
            ({s.user ? s.user.fullName || s.user.email : t.deletedUser})
            {s.contact ? ` · ${t.contact}: ${s.contact}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-ink" dir="auto">
        {s.description}
      </p>
      {canManage ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[12rem_1fr_auto] lg:items-end">
          <NativeSelect aria-label={t.status} className="h-10" value={status} onChange={(e) => setStatus(e.target.value as SuggestionStatus)}>
            {SUGGESTION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t[`status_${st}`]}
              </option>
            ))}
          </NativeSelect>
          <TextAreaField label={t.reply} rows={2} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} />
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? t.saving : t.save}
          </Button>
        </div>
      ) : (
        s.adminReply && <p className="mt-2 text-sm text-ink-soft">{s.adminReply}</p>
      )}
      {message && (
        <p className={`mt-2 text-sm ${message.kind === "ok" ? "text-ink-soft" : "text-danger"}`} role="status">
          {message.text}
        </p>
      )}
    </Panel>
  );
}
