import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FileDown, KeyRound, Link2, Settings2, Trash2, Upload } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  ApiError,
  digitalAddCodes,
  digitalDeleteCode,
  digitalDeleteFile,
  digitalListCodes,
  digitalListFiles,
  digitalListProducts,
  digitalSaveDelivery,
  digitalUploadFile,
  digitalUploadLargeFile,
  type DigitalDeliveryType,
  type DigitalFile,
  type DigitalProduct,
  type LicenseCode,
} from "@store-builder/api-client";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Digital products",
    description: "What the customer receives after paying: a file, a link or a licence code.",
    tabs: "Digital products view",
    tabProducts: "Delivery",
    tabFiles: "File library",
    colProduct: "Product",
    colDelivery: "Delivery",
    colStock: "Codes in stock",
    notSet: "Not set up",
    notSetHint: "Nothing is delivered yet",
    paused: "Paused",
    type_file: "File",
    type_link: "Link",
    type_license_codes: "Licence codes",
    setUp: "Set up",
    edit: "Edit",
    stock: "{available} of {total} left",
    emptyProductsTitle: "No digital products yet",
    emptyProductsDescription: "Create a product and choose the type “Digital”. It will show here so you can set what the customer receives.",
    newProduct: "New product",
    deliveryTitle: "Delivery of “{name}”",
    deliveryDescription: "Sent when the order is paid. A cash-on-delivery order is delivered once its payment is recorded.",
    type: "What the customer gets",
    file: "File",
    chooseFile: "Choose a file from the library",
    noFiles: "The file library is empty. Upload a file first.",
    linkUrl: "Link",
    linkHint: "A private page, a drive folder, a course — anything with an address.",
    message: "Message to the customer",
    messageHint: "Shown on the download page.",
    maxDownloads: "Download limit",
    maxDownloadsHint: "Leave empty for no limit.",
    validHours: "Link valid for (hours)",
    validHoursHint: "Leave empty so it never expires.",
    active: "Deliver automatically",
    saved: "Delivery saved.",
    codesTitle: "Licence codes",
    codesHint: "One code per line. Each unit sold takes one code; codes already in stock are skipped.",
    addCodes: "Add codes",
    codesAdded: "{added} codes added, {duplicates} already there.",
    codeGiven: "Given {date}",
    codeFree: "In stock",
    noCodes: "No codes yet.",
    removeCode: "Remove code",
    upload: "Upload file",
    uploading: "Uploading…",
    uploaded: "“{name}” uploaded.",
    maxSize: "Up to {large} GB per file — above {size} MB it goes straight to storage in parts. Files are private: only a buyer's download link can open them.",
    uploadingPercent: "Uploading… {percent}%",
    cancelUpload: "Cancel",
    colFile: "File",
    colSize: "Size",
    colUsed: "Used by",
    colAdded: "Added",
    usedBy: "{count} products",
    unused: "—",
    emptyFilesTitle: "The file library is empty",
    emptyFilesDescription: "Upload the e-books, templates or archives your digital products deliver.",
    deleteFileTitle: "Delete “{name}”?",
    deleteFileDescription: "The file is removed for good. Customers who already bought it can no longer download it.",
    deleting: "Deleting…",
    fileDeleted: "File deleted.",
    fileInUse: "A product still delivers this file. Change its delivery first.",
    fileTooLarge: "The file is too large.",
  },
  ar: {
    title: "المنتجات الرقمية",
    description: "ما يستلمه العميل بعد الدفع: ملف أو رابط أو كود ترخيص.",
    tabs: "طريقة عرض المنتجات الرقمية",
    tabProducts: "التسليم",
    tabFiles: "مكتبة الملفات",
    colProduct: "المنتج",
    colDelivery: "التسليم",
    colStock: "الأكواد المتاحة",
    notSet: "غير مُعَدّ",
    notSetHint: "لا يُسلَّم شيء حتى الآن",
    paused: "متوقف",
    type_file: "ملف",
    type_link: "رابط",
    type_license_codes: "أكواد ترخيص",
    setUp: "إعداد",
    edit: "تعديل",
    stock: "متبقي {available} من {total}",
    emptyProductsTitle: "لا توجد منتجات رقمية بعد",
    emptyProductsDescription: "أنشئ منتجًا واختر النوع «رقمي». سيظهر هنا لتحدد ما يستلمه العميل.",
    newProduct: "منتج جديد",
    deliveryTitle: "تسليم «{name}»",
    deliveryDescription: "يُرسل عند دفع الطلب. طلب الدفع عند الاستلام يُسلَّم بعد تسجيل دفعه.",
    type: "ما يحصل عليه العميل",
    file: "الملف",
    chooseFile: "اختر ملفًا من المكتبة",
    noFiles: "مكتبة الملفات فارغة. ارفع ملفًا أولًا.",
    linkUrl: "الرابط",
    linkHint: "صفحة خاصة، مجلد على درايف، كورس — أي شيء له عنوان.",
    message: "رسالة للعميل",
    messageHint: "تظهر في صفحة التحميل.",
    maxDownloads: "الحد الأقصى للتحميل",
    maxDownloadsHint: "اتركه فارغًا بدون حد.",
    validHours: "صلاحية الرابط (بالساعات)",
    validHoursHint: "اتركه فارغًا ليبقى الرابط دائمًا.",
    active: "التسليم تلقائيًا",
    saved: "تم حفظ التسليم.",
    codesTitle: "أكواد الترخيص",
    codesHint: "كود في كل سطر. كل قطعة مباعة تأخذ كودًا؛ الأكواد الموجودة مسبقًا تُتجاهل.",
    addCodes: "إضافة أكواد",
    codesAdded: "أُضيف {added} كود، و{duplicates} موجود مسبقًا.",
    codeGiven: "سُلِّم {date}",
    codeFree: "متاح",
    noCodes: "لا توجد أكواد بعد.",
    removeCode: "حذف الكود",
    upload: "رفع ملف",
    uploading: "جارٍ الرفع…",
    uploaded: "تم رفع «{name}».",
    maxSize: "حتى {large} جيجابايت للملف — فوق {size} ميجابايت بيترفع على أجزاء مباشرة للتخزين. الملفات خاصة: لا يفتحها إلا رابط تحميل المشتري.",
    uploadingPercent: "جارٍ الرفع… {percent}%",
    cancelUpload: "إلغاء",
    colFile: "الملف",
    colSize: "الحجم",
    colUsed: "مستخدم في",
    colAdded: "أُضيف",
    usedBy: "{count} منتج",
    unused: "—",
    emptyFilesTitle: "مكتبة الملفات فارغة",
    emptyFilesDescription: "ارفع الكتب والقوالب والملفات التي تسلّمها منتجاتك الرقمية.",
    deleteFileTitle: "حذف «{name}»؟",
    deleteFileDescription: "يُحذف الملف نهائيًا. العملاء الذين اشتروه لن يتمكنوا من تحميله.",
    deleting: "جارٍ الحذف…",
    fileDeleted: "تم حذف الملف.",
    fileInUse: "يوجد منتج ما زال يسلّم هذا الملف. غيّر تسليمه أولًا.",
    fileTooLarge: "الملف أكبر من الحد المسموح.",
  },
} satisfies Messages;

const TYPE_ICON = { file: FileDown, link: Link2, license_codes: KeyRound } as const;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const codeOf = (err: unknown) => (err instanceof ApiError ? err.code : undefined);

/** Digital products (SPEC §18.2): delivery per product and the private file library. */
export function DigitalProductsPage() {
  const t = useT(STRINGS);
  const [tab, setTab] = useState<"products" | "files">("products");

  return (
    <div className="max-w-5xl">
      <PageHeader title={t.title} description={t.description} />
      <FilterTabs
        className="mb-4"
        label={t.tabs}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "products", label: t.tabProducts },
          { value: "files", label: t.tabFiles },
        ]}
      />
      {tab === "products" ? <DeliveriesTab /> : <FilesTab />}
    </div>
  );
}

function DeliveriesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => digitalListProducts(apiClient, workspaceId), [workspaceId]);
  const products = list.data ?? [];
  const [editing, setEditing] = useState<DigitalProduct | null>(null);

  const columns: Column<DigitalProduct>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (product) => (
        <div className="min-w-0">
          <Link to={`/catalog/${product.id}`} className="font-medium text-ink hover:text-primary">
            <bdi>{product.name}</bdi>
          </Link>
          {product.productCode && (
            <div className="text-xs text-ink-soft">
              <bdi dir="ltr">#{product.productCode}</bdi>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "delivery",
      header: t.colDelivery,
      cell: (product) => {
        const delivery = product.delivery;
        if (!delivery) {
          return (
            <div>
              <StatusBadge value="not_set" tone="warning" text={t.notSet} />
              <div className="mt-1 text-xs text-ink-soft">{t.notSetHint}</div>
            </div>
          );
        }
        const Icon = TYPE_ICON[delivery.type];
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-ink">
              <Icon className="size-4 text-ink-soft" aria-hidden />
              {t[`type_${delivery.type}`]}
            </span>
            {delivery.file && <bdi className="max-w-48 truncate text-xs text-ink-soft">{delivery.file.name}</bdi>}
            {!delivery.isActive && <StatusBadge value="paused" tone="neutral" text={t.paused} />}
          </div>
        );
      },
    },
    {
      key: "stock",
      header: t.colStock,
      cell: (product) =>
        product.delivery?.type === "license_codes" ? (
          <StatusBadge
            value="stock"
            tone={product.codes.available === 0 ? "danger" : product.codes.available <= 5 ? "warning" : "success"}
            text={fmt(t.stock, { available: product.codes.available, total: product.codes.total })}
          />
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.edit}</span>,
      align: "end",
      cell: (product) => (
        <Button variant="outline" size="sm" className="min-h-9" onClick={() => setEditing(product)}>
          <Settings2 className="size-4" aria-hidden />
          {product.delivery ? t.edit : t.setUp}
        </Button>
      ),
    },
  ];

  return (
    <DataState skeleton={<ListSkeleton />} loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
      <Card className="p-0">
        <DataTable
          columns={columns}
          rows={products}
          rowKey={(product) => product.id}
          minWidth="40rem"
          empty={
            <EmptyState
              icon={<FileDown className="size-6" aria-hidden />}
              title={t.emptyProductsTitle}
              description={t.emptyProductsDescription}
              action={
                <Link to="/catalog/new" className="text-sm font-medium text-primary hover:underline">
                  {t.newProduct}
                </Link>
              }
            />
          }
        />
      </Card>
      <DeliveryModal
        product={editing}
        onClose={() => {
          setEditing(null);
          void list.refresh({ silent: true });
        }}
      />
    </DataState>
  );
}

function DeliveryModal({ product, onClose }: { product: DigitalProduct | null; onClose: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const open = product !== null;

  const [type, setType] = useState<DigitalDeliveryType>("file");
  const [fileId, setFileId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [validHours, setValidHours] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const d = product.delivery;
    setType(d?.type ?? "file");
    setFileId(d?.fileId ?? "");
    setLinkUrl(d?.linkUrl ?? "");
    setMessage(d?.message ?? "");
    setMaxDownloads(d?.maxDownloads ? String(d.maxDownloads) : "");
    setValidHours(d?.linkValidHours ? String(d.linkValidHours) : "");
    setIsActive(d?.isActive ?? true);
    setError(null);
    let cancelled = false;
    digitalListFiles(apiClient, workspaceId)
      .then((result) => {
        if (!cancelled) setFiles(result.files);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, workspaceId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setBusy(true);
    setError(null);
    const positive = (text: string) => {
      const n = Math.floor(Number(text));
      return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
    };
    try {
      await digitalSaveDelivery(apiClient, workspaceId, product.id, {
        type,
        fileId: type === "file" ? fileId || null : null,
        linkUrl: type === "link" ? linkUrl.trim() : null,
        message: message.trim() || null,
        maxDownloads: type === "file" ? positive(maxDownloads) : null,
        linkValidHours: positive(validHours),
        isActive,
      });
      toast.success(t.saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canSave = type === "file" ? Boolean(fileId) : type === "link" ? linkUrl.trim().length > 0 : true;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? fmt(t.deliveryTitle, { name: product.name }) : ""}
      description={t.deliveryDescription}
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label={t.type}>
          {(props) => (
            <Select {...props} value={type} onChange={(e) => setType(e.target.value as DigitalDeliveryType)}>
              <option value="file">{t.type_file}</option>
              <option value="link">{t.type_link}</option>
              <option value="license_codes">{t.type_license_codes}</option>
            </Select>
          )}
        </Field>

        {type === "file" && (
          <>
            <Field label={t.file} hint={files.length === 0 ? t.noFiles : undefined} required>
              {(props) => (
                <Select {...props} value={fileId} onChange={(e) => setFileId(e.target.value)}>
                  <option value="">{t.chooseFile}</option>
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name} ({formatSize(file.sizeBytes)})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <TextField
              label={t.maxDownloads}
              hint={t.maxDownloadsHint}
              type="number"
              min={1}
              max={1000}
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
            />
          </>
        )}
        {type === "link" && (
          <TextField label={t.linkUrl} hint={t.linkHint} required type="url" dir="ltr" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} maxLength={1000} />
        )}

        <TextField label={t.validHours} hint={t.validHoursHint} type="number" min={1} value={validHours} onChange={(e) => setValidHours(e.target.value)} />
        <Field label={t.message} hint={t.messageHint}>
          {(props) => <Textarea {...props} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {t.active}
        </label>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || !canSave}>
            {busy ? common.saving : common.save}
          </Button>
        </div>
      </form>

      {product && type === "license_codes" && <CodesSection productId={product.id} />}
    </Modal>
  );
}

function CodesSection({ productId }: { productId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => digitalListCodes(apiClient, workspaceId, productId), [workspaceId, productId]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await digitalAddCodes(apiClient, workspaceId, productId, text);
      toast.success(fmt(t.codesAdded, { added: result.added, duplicates: result.duplicates }));
      setText("");
      void list.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(code: LicenseCode) {
    try {
      await digitalDeleteCode(apiClient, workspaceId, code.id);
      void list.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const codes = list.data?.codes ?? [];
  return (
    <div className="mt-6 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t.codesTitle}</h3>
        {list.data && <span className="text-xs text-ink-soft">{fmt(t.stock, { available: list.data.available, total: list.data.total })}</span>}
      </div>
      <form onSubmit={add} className="mt-2 space-y-2">
        <Field label={t.addCodes} hint={t.codesHint} labelHidden>
          {(props) => <Textarea {...props} rows={3} dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={"XXXX-1111\nXXXX-2222"} />}
        </Field>
        <Button type="submit" variant="outline" size="sm" disabled={busy || !text.trim()}>
          {t.addCodes}
        </Button>
      </form>
      <ul className="mt-3 max-h-56 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line">
        {codes.length === 0 && <li className="px-3 py-3 text-sm text-ink-soft">{t.noCodes}</li>}
        {codes.map((code) => (
          <li key={code.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <code dir="ltr" className="min-w-0 break-all text-ink">
              {code.code}
            </code>
            {code.assignedAt ? (
              <span className="shrink-0 text-xs text-ink-soft">{fmt(t.codeGiven, { date: formatDate(code.assignedAt) })}</span>
            ) : (
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-success">{t.codeFree}</span>
                <button
                  type="button"
                  aria-label={t.removeCode}
                  title={t.removeCode}
                  onClick={() => void remove(code)}
                  className="cursor-pointer rounded-md p-1 text-ink-soft hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilesTab() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => digitalListFiles(apiClient, workspaceId), [workspaceId]);
  const files = list.data?.files ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // A large file's progress (0–100) and the way to stop it; null for a small one.
  const [progress, setProgress] = useState<number | null>(null);
  const cancel = useRef<AbortController | null>(null);
  const [removing, setRemoving] = useState<DigitalFile | null>(null);
  const maxBytes = list.data?.maxFileBytes ?? 100 * 1024 * 1024;

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      let saved: DigitalFile;
      if (file.size > maxBytes) {
        if (list.data?.maxLargeFileBytes && file.size > list.data.maxLargeFileBytes) throw new ApiError("too large", 413, "FILE_TOO_LARGE");
        cancel.current = new AbortController();
        setProgress(0);
        saved = await digitalUploadLargeFile(apiClient, workspaceId, file, {
          signal: cancel.current.signal,
          onProgress: (sent, total) => setProgress(Math.floor((sent / total) * 100)),
        });
      } else {
        saved = await digitalUploadFile(apiClient, apiBaseUrl, workspaceId, file);
      }
      toast.success(fmt(t.uploaded, { name: saved.name }));
      void list.refresh({ silent: true });
    } catch (err) {
      if (!cancel.current?.signal.aborted) toast.error(codeOf(err) === "FILE_TOO_LARGE" ? t.fileTooLarge : errorMessage(err));
    } finally {
      setUploading(false);
      setProgress(null);
      cancel.current = null;
      if (input.current) input.current.value = "";
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await digitalDeleteFile(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(codeOf(err) === "FILE_IN_USE" ? t.fileInUse : errorMessage(err));
    }
    toast.success(t.fileDeleted);
    setRemoving(null);
    void list.refresh({ silent: true });
  }

  const uploadButton = (
    <span className="inline-flex items-center gap-2">
      <Button className="min-h-10" disabled={uploading} onClick={() => input.current?.click()}>
        <Upload className="size-4" aria-hidden />
        {progress !== null ? fmt(t.uploadingPercent, { percent: progress }) : uploading ? t.uploading : t.upload}
      </Button>
      {progress !== null && (
        <Button variant="outline" className="min-h-10" onClick={() => cancel.current?.abort()}>
          {t.cancelUpload}
        </Button>
      )}
    </span>
  );

  const columns: Column<DigitalFile>[] = [
    { key: "name", header: t.colFile, cell: (file) => <bdi className="font-medium break-all text-ink">{file.name}</bdi> },
    { key: "size", header: t.colSize, cell: (file) => <span dir="ltr" className="text-ink-soft">{formatSize(file.sizeBytes)}</span> },
    {
      key: "used",
      header: t.colUsed,
      cell: (file) => <span className="text-ink-soft">{file.usedByProducts ? fmt(t.usedBy, { count: file.usedByProducts }) : t.unused}</span>,
    },
    { key: "added", header: t.colAdded, cell: (file) => <span className="text-ink-soft">{formatDate(file.createdAt)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{common.delete}</span>,
      align: "end",
      cell: (file) => (
        <Button variant="outline" size="sm" className="min-h-9" onClick={() => setRemoving(file)}>
          <Trash2 className="size-4" aria-hidden />
          {common.delete}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <input ref={input} type="file" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">
          {fmt(t.maxSize, { size: Math.round(maxBytes / 1024 / 1024), large: list.data?.maxLargeFileBytes ? Math.round(list.data.maxLargeFileBytes / 1024 ** 3) : 10 })}
        </p>
        {uploadButton}
      </div>
      <DataState skeleton={<ListSkeleton rows={4} />} loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable
            columns={columns}
            rows={files}
            rowKey={(file) => file.id}
            minWidth="40rem"
            empty={<EmptyState icon={<Upload className="size-6" aria-hidden />} title={t.emptyFilesTitle} description={t.emptyFilesDescription} action={uploadButton} />}
          />
        </Card>
      </DataState>
      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.deleteFileTitle, { name: removing.name }) : ""}
        description={t.deleteFileDescription}
        confirmLabel={common.delete}
        busyLabel={t.deleting}
        cancelLabel={common.cancel}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
