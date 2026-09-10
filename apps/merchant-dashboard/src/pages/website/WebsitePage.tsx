import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutTemplate, Pencil, Trash2 } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type { CreateWebsitePayload, Website, WebsiteTemplateSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
      className="cursor-pointer flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised text-left transition-colors hover:border-primary"
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
 * site name, then calls createWebsite and drops the merchant straight into the
 * editor for the new site. The template detail fetch is purely informational —
 * a failure shows an inline notice but never blocks creation, because the
 * summary already carries the `templateVersionId` the API needs.
 */
function UseTemplateForm({
  template,
  onCancel,
}: {
  template: WebsiteTemplateSummary;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();

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
      navigate(`/website/${result.website.id}/edit`);
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
              className="cursor-pointer font-medium text-primary hover:underline"
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

/**
 * Sites the workspace already has. Without this the editor is only reachable
 * in the moments right after creating a site — a reload would strand it.
 */
function ExistingSites() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const sites = useAsync(() => apiClient.listWebsites(workspaceId), [workspaceId]);
  const [pendingDelete, setPendingDelete] = useState<Website | null>(null);
  const list = sites.data ?? [];

  // A workspace with no site yet is the normal first-run case, and the template
  // gallery below already tells that story — stay quiet rather than showing an
  // empty state. Same for an error: it must not block picking a template.
  if (sites.loading || sites.error || list.length === 0) return null;

  // Throwing keeps ConfirmDialog open with the error inline; resolving lets it
  // close. Refetching (rather than filtering locally) also catches sites deleted
  // from another tab.
  async function confirmDelete() {
    const site = pendingDelete;
    if (!site) return;
    await apiClient.deleteWebsite(workspaceId, site.id);
    setPendingDelete(null);
    toast.success(`Site "${site.name}" deleted.`);
    await sites.refresh({ silent: true });
  }

  return (
    <div className="mb-8">
      <h2 className="mb-2 font-display text-base font-medium text-ink">Your sites</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {list.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{site.name}</p>
              <p className="truncate text-xs text-ink-soft">
                {site.subdomain} · {humanize(site.status)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/website/${site.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${site.name}`}
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => setPendingDelete(site)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this site?"
        confirmLabel="Delete site"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            <span className="font-medium text-ink">{pendingDelete?.name}</span> and all of its
            pages, published revisions and any domain bound to it will be deleted permanently.
            This cannot be undone.
          </p>
          {pendingDelete?.status === "published" && (
            <Alert variant="danger">
              This site is live right now. Deleting it takes it offline immediately — anyone
              visiting <span className="font-medium">{pendingDelete.subdomain}</span> will stop
              seeing your store.
            </Alert>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

export function WebsitePage() {
  const templates = useAsync(() => apiClient.listWebsiteTemplates(), []);

  const [selected, setSelected] = useState<WebsiteTemplateSummary | null>(null);

  const list = templates.data ?? [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Website"
        description="Pick a template to start your store's website. You can rename it now and customise it later."
      />

      <ExistingSites />

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

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ""}
        description="Preview what this template ships with, then name your site."
      >
        {selected && (
          <UseTemplateForm template={selected} onCancel={() => setSelected(null)} />
        )}
      </Modal>
    </div>
  );
}
