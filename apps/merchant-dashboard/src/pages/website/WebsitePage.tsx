import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, LayoutTemplate } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type {
  CreateWebsitePayload,
  Website,
  WebsitePage as WebsitePageType,
  WebsiteTemplateSummary,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

/** Square-ish preview for a template card — the thumbnail, or a placeholder. */
function TemplateThumb({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="aspect-[4/3] w-full object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center bg-primary-soft text-primary-dark">
      <LayoutTemplate className="size-8" aria-hidden />
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: WebsiteTemplateSummary;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised text-left transition-colors hover:border-primary"
    >
      <TemplateThumb url={template.thumbnailUrl} name={template.name} />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="font-medium text-ink">{template.name}</span>
        {template.category && (
          <span className="text-xs text-ink-soft">{humanize(template.category)}</span>
        )}
        <span className="mt-auto pt-2 text-sm font-medium text-primary">Preview →</span>
      </div>
    </button>
  );
}

/**
 * Modal body: previews the picked template (pages it ships with) and takes a
 * site name, then calls createWebsite. The template detail fetch is purely
 * informational — a failure shows an inline notice but never blocks creation,
 * because the summary already carries the `templateVersionId` the API needs.
 */
function UseTemplateForm({
  template,
  onCreated,
  onCancel,
}: {
  template: WebsiteTemplateSummary;
  onCreated: (result: { website: Website; pages: WebsitePageType[] }) => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();

  const detail = useAsync(() => apiClient.getWebsiteTemplate(template.id), [template.id]);

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: CreateWebsitePayload = {
      name: name.trim(),
      templateVersionId: template.templateVersionId,
    };
    try {
      const result = await apiClient.createWebsite(workspaceId, payload);
      toast.success(`Site "${result.website.name}" created.`);
      onCreated(result);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const pages = detail.data?.pages ?? [];

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <div className="rounded-[0.5rem] border border-line bg-paper px-4 py-3 text-sm">
        {detail.loading ? (
          <span className="flex items-center gap-2 text-ink-soft">
            <Spinner className="size-4" /> جارٍ تحميل تفاصيل القالب…
          </span>
        ) : detail.error ? (
          <span className="flex flex-wrap items-center gap-2 text-ink-soft">
            تعذّر تحميل معاينة القالب، بس تقدر تكمّل الإنشاء عادي.
            <button
              type="button"
              onClick={() => detail.refresh()}
              className="font-medium text-primary hover:underline"
            >
              إعادة المحاولة
            </button>
          </span>
        ) : (
          <>
            <p className="text-ink-soft">
              القالب فيه {pages.length} {pages.length === 1 ? "صفحة" : "صفحات"} هتتنسخ لموقعك:
            </p>
            {pages.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {pages.map((p) => (
                  <li
                    key={p.path}
                    className="rounded-full border border-line bg-paper-raised px-2 py-0.5 text-xs text-ink-soft"
                  >
                    {p.title || p.path}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <TextField
        label="Site name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        hint="هيتولّد منه رابط مؤقت (subdomain) تقدر تغيّره بعدين."
        placeholder="My store"
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0}>
          {saving ? "Creating…" : "Use this template"}
        </Button>
      </div>
    </form>
  );
}

function CreatedPanel({
  result,
  onBack,
}: {
  result: { website: Website; pages: WebsitePageType[] };
  onBack: () => void;
}) {
  const { website, pages } = result;
  return (
    <div className="max-w-xl rounded-[var(--radius-card)] border border-line bg-paper-raised p-6">
      <CheckCircle2 className="size-8 text-success" aria-hidden />
      <h2 className="mt-3 font-display text-xl font-medium text-ink">Your site has been created</h2>
      <div className="mt-2 space-y-1 text-sm text-ink-soft">
        <p>
          تم إنشاء موقع <span className="font-medium text-ink">{website.name}</span> بنجاح
          {pages.length > 0 && <> مع {pages.length} {pages.length === 1 ? "صفحة" : "صفحات"} من القالب</>}.
        </p>
        <p>
          الاسم المختصر (subdomain):{" "}
          <span className="font-medium text-ink">{website.subdomain}</span>
        </p>
        <p className="pt-2">
          محرر الموقع الكامل بالسحب والإفلات لسه جاي قريب. الموقع اتحفظ عندك كمسودة، وهتقدر تكمّل
          تحريره من هنا أول ما المحرر ينزل — مش محتاج تعمل حاجة دلوقتي.
        </p>
      </div>
      <Button type="button" variant="outline" className="mt-5" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to templates
      </Button>
    </div>
  );
}

export function WebsitePage() {
  const templates = useAsync(() => apiClient.listWebsiteTemplates(), []);

  const [selected, setSelected] = useState<WebsiteTemplateSummary | null>(null);
  const [created, setCreated] = useState<{ website: Website; pages: WebsitePageType[] } | null>(
    null
  );

  const list = templates.data ?? [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Website"
        description="Pick a template to start your store's website. You can rename it now and customise it later."
      />

      {created ? (
        <CreatedPanel result={created} onBack={() => setCreated(null)} />
      ) : (
        <DataState
          loading={templates.loading}
          error={templates.error}
          empty={list.length === 0}
          emptyMessage="No website templates are available right now. Check back soon."
          onRetry={() => templates.refresh()}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => setSelected(template)}
              />
            ))}
          </div>
        </DataState>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ""}
        description="Preview what this template ships with, then name your site."
      >
        {selected && (
          <UseTemplateForm
            template={selected}
            onCancel={() => setSelected(null)}
            onCreated={(result) => {
              setSelected(null);
              setCreated(result);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
