import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Alert, Badge, Button } from "@store-builder/ui";
import {
  storeDesignListPages,
  storeDesignUpdatePageFlags,
  type StoreDesignPageRow,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Pages",
    description: "Where each page of your website is linked from, and whether shoppers can open it. Changes apply at once.",
    tip: "Shipping, returns and privacy policies are required for TikTok ads.",
    page: "Page",
    link: "Link",
    header: "In header",
    footer: "In footer",
    active: "Active",
    edit: "Edit",
    home: "Home",
    draft: "Not published",
    draftHint: "Publish the website for this page to appear in the store.",
    emptyTitle: "No website yet",
    emptyBody: "Create your website first; its pages will be listed here.",
    openWebsite: "Open Website",
    saved: "Page updated.",
  },
  ar: {
    title: "الصفحات",
    description: "من أين يُربط بكل صفحة في موقعك، وهل يستطيع المشتري فتحها. التغييرات تُطبق فورًا.",
    tip: "سياسات الشحن والاسترجاع والخصوصية مطلوبة لإعلانات تيك توك.",
    page: "الصفحة",
    link: "الرابط",
    header: "في الهيدر",
    footer: "في الفوتر",
    active: "مفعّلة",
    edit: "تعديل",
    home: "الرئيسية",
    draft: "غير منشورة",
    draftHint: "انشر الموقع لتظهر هذه الصفحة في المتجر.",
    emptyTitle: "لا يوجد موقع بعد",
    emptyBody: "أنشئ موقعك أولًا وستظهر صفحاته هنا.",
    openWebsite: "فتح الموقع",
    saved: "تم تحديث الصفحة.",
  },
} satisfies Messages;

type Flag = "showInHeader" | "showInFooter" | "isActive";

export function PagesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<string | null>(null);

  // The store's website: the published one, or the first while none is live.
  const state = useAsync(async () => {
    const websites = await apiClient.listWebsites(workspaceId);
    const website = websites.find((w) => w.status === "published") ?? websites[0] ?? null;
    if (!website) return { website: null, pages: [] as StoreDesignPageRow[] };
    return { website, pages: await storeDesignListPages(apiClient, workspaceId, website.id) };
  }, [workspaceId]);

  async function toggle(page: StoreDesignPageRow, flag: Flag, value: boolean) {
    setBusy(`${page.id}:${flag}`);
    // Shown at once; put back if the server refuses.
    const patch = (v: boolean) =>
      state.setData((prev) =>
        prev
          ? { ...prev, pages: prev.pages.map((p) => (p.id === page.id ? { ...p, [flag]: v } : p)) }
          : { website: null, pages: [] }
      );
    patch(value);
    try {
      await storeDesignUpdatePageFlags(apiClient, workspaceId, page.websiteId, page.id, { [flag]: value });
      toast.success(t.saved);
    } catch (err) {
      patch(!value);
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const check = (page: StoreDesignPageRow, flag: Flag, label: string, disabled = false) => (
    <input
      type="checkbox"
      aria-label={`${label} — ${page.title}`}
      className="size-5 cursor-pointer accent-primary disabled:cursor-default"
      checked={page[flag]}
      disabled={disabled || busy === `${page.id}:${flag}`}
      onChange={(e) => void toggle(page, flag, e.target.checked)}
    />
  );

  const columns: Column<StoreDesignPageRow>[] = [
    {
      key: "title",
      header: t.page,
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{p.path === "/" ? t.home : p.title}</p>
          {!p.isLive && (
            <Badge variant="secondary" title={t.draftHint}>
              {t.draft}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "path",
      header: t.link,
      cell: (p) => (
        <bdi dir="ltr" className="text-sm text-ink-soft">
          {p.path}
        </bdi>
      ),
    },
    // The home page is always linked and always served.
    { key: "header", header: t.header, cell: (p) => check(p, "showInHeader", t.header, p.path === "/") },
    { key: "footer", header: t.footer, cell: (p) => check(p, "showInFooter", t.footer, p.path === "/") },
    { key: "active", header: t.active, cell: (p) => check(p, "isActive", t.active, p.path === "/") },
    {
      key: "edit",
      header: "",
      align: "end",
      cell: (p) => (
        <Button asChild variant="outline" size="sm">
          <Link to={`/website/${p.websiteId}/edit`}>{t.edit}</Link>
        </Button>
      ),
    },
  ];

  return (
    <DataState skeleton={<ListSkeleton rows={4} />} loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
      {state.data && !state.data.website ? (
        <EmptyState
          icon={<FileText />}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button asChild>
              <Link to="/website">{t.openWebsite}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          <Alert>{t.tip}</Alert>
          <Section title={t.title} description={t.description} flush>
            <DataTable columns={columns} rows={state.data?.pages ?? []} rowKey={(p) => p.id} minWidth="40rem" />
          </Section>
        </div>
      )}
    </DataState>
  );
}
