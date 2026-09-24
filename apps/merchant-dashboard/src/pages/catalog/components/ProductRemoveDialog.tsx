import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  funnelsList,
  isApiErrorCode,
  productInFunnelIds,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    removeTitle: "Delete “{name}”?",
    removeDescription: "Choose whether to archive the product or delete it for good.",
    archiveHeading: "Archive",
    archiveBody:
      "Hide it from your store and stop new orders. Orders and history are kept, and you can restore it from the Archived tab.",
    archive: "Archive",
    archiving: "Archiving…",
    deleteHeading: "Delete permanently",
    deleteBody: "Removes the product with its variants and offers.",
    deleteWarning: "This can't be undone.",
    deletePermanently: "Delete permanently",
    deleting: "Deleting…",
    purgeTitle: "Delete “{name}” permanently?",
    purgeDescription: "The product, its variants and its offers are removed for good. This can't be undone.",
    hasOrders: "This product has orders, so it can only be archived.",
    hasOrdersArchived: "This product has orders, so it can't be deleted. It stays archived.",
    inFunnel: "This product is used in a funnel. Remove it from the funnel first, then try again.",
    inFunnels: "This product is used in these funnels. Remove it from them first, then try again.",
    funnelFallback: "Funnel {n}",
    cancel: "Cancel",
    close: "Close",
    archivedToast: "“{name}” archived. You'll find it in the Archived tab.",
    deletedToast: "“{name}” deleted permanently.",
  },
  ar: {
    removeTitle: "حذف “{name}”؟",
    removeDescription: "اختر أرشفة المنتج أو حذفه نهائيًا.",
    archiveHeading: "أرشفة",
    archiveBody:
      "يختفي من متجرك ويتوقف استقبال أوردرات جديدة عليه. تبقى الأوردرات والسجل كما هي، ويمكنك استعادته من تبويب المؤرشف.",
    archive: "أرشفة",
    archiving: "جارٍ الأرشفة…",
    deleteHeading: "حذف نهائي",
    deleteBody: "يحذف المنتج مع كل المتغيرات والعروض الخاصة به.",
    deleteWarning: "لا يمكن التراجع عن ذلك.",
    deletePermanently: "حذف نهائي",
    deleting: "جارٍ الحذف…",
    purgeTitle: "حذف “{name}” نهائيًا؟",
    purgeDescription: "سيتم حذف المنتج ومتغيراته وعروضه نهائيًا. لا يمكن التراجع عن ذلك.",
    hasOrders: "هذا المنتج عليه أوردرات، لذلك يمكن أرشفته فقط.",
    hasOrdersArchived: "هذا المنتج عليه أوردرات، لذلك لا يمكن حذفه. سيبقى مؤرشفًا.",
    inFunnel: "هذا المنتج مستخدم في مسار بيع. احذفه من المسار أولًا ثم حاول مرة أخرى.",
    inFunnels: "هذا المنتج مستخدم في مسارات البيع التالية. احذفه منها أولًا ثم حاول مرة أخرى.",
    funnelFallback: "مسار بيع {n}",
    cancel: "إلغاء",
    close: "إغلاق",
    archivedToast: "تمت أرشفة “{name}”. ستجده في تبويب المؤرشف.",
    deletedToast: "تم حذف “{name}” نهائيًا.",
  },
} satisfies Messages;

type Blocked = { kind: "orders" } | { kind: "funnel"; funnelIds: string[] };

interface Props {
  /** Draft/active products get the archive-or-delete choice; archived ones only the permanent delete. */
  product: Product;
  onClose: () => void;
  /** Called after a successful archive or delete, so the list can refresh. */
  onDone: () => void;
}

/**
 * Remove a product from the catalog list. Render it with `key={product.id}`
 * so a new product starts with a clean dialog.
 */
export function ProductRemoveDialog({ product, onClose, onDone }: Props) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const archived = product.status === "archived";

  const [busy, setBusy] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [funnelNames, setFunnelNames] = useState<Record<string, string>>({});

  // Name the blocking funnels; the ids alone still link if this fails.
  const blockingFunnels = blocked?.kind === "funnel" ? blocked.funnelIds : null;
  useEffect(() => {
    if (!blockingFunnels?.length) return;
    let cancelled = false;
    funnelsList(apiClient, workspaceId)
      .then((funnels) => {
        if (!cancelled) setFunnelNames(Object.fromEntries(funnels.map((f) => [f.id, f.name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [blockingFunnels, workspaceId]);

  function close() {
    if (!busy) onClose();
  }

  async function archive() {
    if (busy) return;
    setBusy("archive");
    setError(null);
    try {
      await apiClient.deleteProduct(workspaceId, product.id);
      toast.success(fmt(t.archivedToast, { name: product.name }));
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function deletePermanently() {
    if (busy) return;
    setBusy("delete");
    setError(null);
    try {
      await apiClient.deleteProductPermanently(workspaceId, product.id);
      toast.success(fmt(t.deletedToast, { name: product.name }));
      onDone();
    } catch (err) {
      if (isApiErrorCode(err, "PRODUCT_HAS_ORDERS")) setBlocked({ kind: "orders" });
      else if (isApiErrorCode(err, "PRODUCT_IN_FUNNEL"))
        setBlocked({ kind: "funnel", funnelIds: productInFunnelIds(err) });
      else setError(errorMessage(err));
      setBusy(null);
    }
  }

  const canDelete = blocked === null;
  const name = product.name;

  const notices = (
    <>
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}
      {blocked?.kind === "orders" && (
        <p
          role="alert"
          className="mb-3 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark"
        >
          {archived ? t.hasOrdersArchived : t.hasOrders}
        </p>
      )}
      {blocked?.kind === "funnel" && (
        <div
          role="alert"
          className="mb-3 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark"
        >
          <p>{blocked.funnelIds.length > 1 ? t.inFunnels : t.inFunnel}</p>
          {blocked.funnelIds.length > 0 && (
            <ul className="mt-2 space-y-1">
              {blocked.funnelIds.map((id, i) => (
                <li key={id}>
                  <Link to={`/funnels/${id}`} className="font-medium underline hover:no-underline">
                    {funnelNames[id] ?? fmt(t.funnelFallback, { n: i + 1 })}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );

  if (archived) {
    return (
      <Modal
        open
        onClose={close}
        title={fmt(t.purgeTitle, { name })}
        description={t.purgeDescription}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={busy !== null}>
              {canDelete ? t.cancel : t.close}
            </Button>
            {canDelete && (
              <Button variant="danger" onClick={deletePermanently} disabled={busy !== null}>
                {busy === "delete" ? t.deleting : t.deletePermanently}
              </Button>
            )}
          </>
        }
      >
        {notices}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={close}
      title={fmt(t.removeTitle, { name })}
      description={t.removeDescription}
      footer={
        <Button variant="outline" onClick={close} disabled={busy !== null}>
          {t.cancel}
        </Button>
      }
    >
      {notices}
      <div className="space-y-3">
        <div className="rounded-[0.5rem] border border-line p-4">
          <h3 className="font-medium text-ink">{t.archiveHeading}</h3>
          <p className="mt-1 text-sm text-ink-soft">{t.archiveBody}</p>
          <div className="mt-3 flex justify-end">
            <Button
              variant={canDelete ? "outline" : "primary"}
              onClick={archive}
              disabled={busy !== null}
            >
              {busy === "archive" ? t.archiving : t.archive}
            </Button>
          </div>
        </div>

        {canDelete && (
          <div className="rounded-[0.5rem] border border-danger/30 p-4">
            <h3 className="font-medium text-danger">{t.deleteHeading}</h3>
            <p className="mt-1 text-sm text-ink-soft">
              {t.deleteBody} <strong className="font-medium text-danger">{t.deleteWarning}</strong>
            </p>
            <div className="mt-3 flex justify-end">
              <Button variant="danger" onClick={deletePermanently} disabled={busy !== null}>
                {busy === "delete" ? t.deleting : t.deletePermanently}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
