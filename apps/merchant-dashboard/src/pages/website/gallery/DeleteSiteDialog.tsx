import { useRef } from "react";
import type { Website } from "@store-builder/api-client";
import { Alert } from "@store-builder/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

const STRINGS = {
  en: {
    title: "Delete this site?",
    confirm: "Delete site",
    cancel: "Cancel",
    working: "Deleting…",
    body: "{name} and all of its pages, published versions and any domain bound to it will be deleted permanently. This cannot be undone.",
    live: "This site is live right now. Deleting it takes it offline at once — anyone visiting {subdomain} stops seeing your store.",
    deleted: "Site “{name}” deleted.",
  },
  ar: {
    title: "حذف هذا الموقع؟",
    confirm: "حذف الموقع",
    cancel: "إلغاء",
    working: "جارٍ الحذف…",
    body: "سيُحذف {name} نهائيًا مع كل صفحاته ونسخه المنشورة وأي دومين مربوط به. لا يمكن التراجع عن ذلك.",
    live: "هذا الموقع منشور الآن. حذفه يوقفه فورًا — ولن يرى متجرك أي شخص يزور {subdomain}.",
    deleted: "تم حذف الموقع «{name}».",
  },
} satisfies Messages;

/**
 * Asks once before a site is deleted, naming what goes with it — its pages,
 * its published versions, a bound domain — and, for a site that is live, that
 * shoppers lose the store the moment it is confirmed. Nothing brings it back,
 * so there is no Undo: the dialog is the safeguard.
 *
 * `site` is the one being asked about (null: closed). A failed delete stays
 * open with the reason inline (ConfirmDialog); a successful one says so and
 * hands the site to `onDeleted`, which refreshes the list.
 */
export function DeleteSiteDialog({
  site,
  onClose,
  onDeleted,
}: {
  site: Website | null;
  onClose: () => void;
  onDeleted: (site: Website) => void | Promise<void>;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  // The words stay while the dialog slides away.
  const last = useRef<Website | null>(null);
  if (site) last.current = site;
  const shown = site ?? last.current;

  async function confirmDelete() {
    if (!site) return;
    await apiClient.deleteWebsite(workspaceId, site.id);
    toast.success(fmt(t.deleted, { name: site.name }));
    await onDeleted(site);
  }

  // The site's name and address sit inside these sentences, each in its own span.
  const body = t.body.split("{name}");
  const live = t.live.split("{subdomain}");

  return (
    <ConfirmDialog
      open={site !== null}
      title={t.title}
      confirmLabel={t.confirm}
      cancelLabel={t.cancel}
      busyLabel={t.working}
      destructive
      onCancel={onClose}
      onConfirm={confirmDelete}
    >
      <div className="space-y-3 text-sm leading-6 text-ink-soft">
        <p>
          {body[0]}
          <span className="font-medium text-ink">{shown?.name}</span>
          {body[1]}
        </p>
        {shown?.status === "published" && (
          <Alert variant="danger">
            {live[0]}
            <bdi dir="ltr" className="font-medium">
              {shown.subdomain}
            </bdi>
            {live[1]}
          </Alert>
        )}
      </div>
    </ConfirmDialog>
  );
}
