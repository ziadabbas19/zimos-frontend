import { useState } from "react";
import { IconCopy, IconDownload, IconMagic } from "@/components/icons";
import { Alert, Button, Label } from "@store-builder/ui";
import { couponsBulkGenerate, type CouponBulkPayload, type CouponBulkResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, percentToBasisPoints } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

/**
 * Bulk code generation: many random codes with one set of rules,
 * for a campaign where each influencer or customer gets a code of their own.
 * The result is shown once here to copy or download; the codes are ordinary
 * discounts afterwards and appear in the list.
 */

const STRINGS = {
  en: {
    open: "Generate codes",
    title: "Generate discount codes",
    description: "Random codes that share the same discount. Give each influencer or customer a code of their own.",
    count: "How many",
    prefix: "Prefix",
    prefixHint: "Optional. Letters and digits, e.g. RAMADAN → RAMADAN-X7K2M9QD.",
    type: "Discount",
    type_percentage: "Percentage",
    type_fixed: "Fixed amount",
    type_free_shipping: "Free shipping",
    percent: "Percent off",
    amount: "Amount off",
    minimum: "Minimum order",
    minimumHint: "Optional.",
    usage: "Uses per code",
    usageHint: "1 makes every code single-use.",
    countInvalid: "Enter a number between 1 and 500.",
    valueInvalid: "Enter the discount value.",
    cancel: "Cancel",
    generate: "Generate {count} codes",
    generating: "Generating…",
    done: "{count} codes created",
    doneHint: "They are in your discounts list. A link ending with ?coupon=CODE applies a code automatically.",
    copy: "Copy all",
    copied: "Codes copied.",
    download: "Download CSV",
    close: "Close",
  },
  ar: {
    open: "توليد أكواد",
    title: "توليد أكواد خصم",
    description: "أكواد عشوائية بنفس الخصم. أعطِ كل مؤثر أو عميل كودًا خاصًا به.",
    count: "العدد",
    prefix: "بادئة",
    prefixHint: "اختياري. حروف وأرقام، مثل RAMADAN ← RAMADAN-X7K2M9QD.",
    type: "الخصم",
    type_percentage: "نسبة",
    type_fixed: "مبلغ ثابت",
    type_free_shipping: "شحن مجاني",
    percent: "نسبة الخصم",
    amount: "مبلغ الخصم",
    minimum: "الحد الأدنى للطلب",
    minimumHint: "اختياري.",
    usage: "عدد الاستخدامات لكل كود",
    usageHint: "1 يجعل كل كود يُستخدم مرة واحدة.",
    countInvalid: "أدخل رقمًا بين 1 و500.",
    valueInvalid: "أدخل قيمة الخصم.",
    cancel: "إلغاء",
    generate: "توليد {count} كود",
    generating: "جارٍ التوليد…",
    done: "تم إنشاء {count} كود",
    doneHint: "تجدها في قائمة الخصومات. أي رابط ينتهي بـ ?coupon=CODE يطبّق الكود تلقائيًا.",
    copy: "نسخ الكل",
    copied: "تم نسخ الأكواد.",
    download: "تحميل CSV",
    close: "إغلاق",
  },
} satisfies Messages;

type CodeType = CouponBulkPayload["type"];

export function BulkCodesButton({ onGenerated }: { onGenerated: () => void }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 md:min-h-9" onClick={() => setOpen(true)}>
        <IconMagic className="size-4" aria-hidden />
        {t.open}
      </Button>
      {open && <BulkCodesDialog onClose={() => setOpen(false)} onGenerated={onGenerated} />}
    </>
  );
}

function BulkCodesDialog({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [count, setCount] = useState("20");
  const [prefix, setPrefix] = useState("");
  const [type, setType] = useState<CodeType>("percentage");
  const [value, setValue] = useState("10");
  const [minimum, setMinimum] = useState("");
  const [usage, setUsage] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CouponBulkResult | null>(null);

  const n = Number.parseInt(count, 10);

  async function generate() {
    if (!Number.isInteger(n) || n < 1 || n > 500) return setError(t.countInvalid);
    const payload: CouponBulkPayload = {
      count: n,
      prefix: prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
      type,
      usageLimit: Math.max(1, Number.parseInt(usage, 10) || 1),
    };
    if (type !== "free_shipping") {
      const amount = type === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
      if (!Number.isFinite(amount) || amount <= 0 || (type === "percentage" && amount > 10000)) return setError(t.valueInvalid);
      payload.value = amount;
    }
    if (minimum.trim()) {
      const min = majorToMinor(minimum);
      if (Number.isFinite(min) && min > 0) payload.minimumSubtotal = min;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await couponsBulkGenerate(apiClient, workspaceId, payload));
      onGenerated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  async function copyAll() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.codes.join("\n"));
      toast.success(t.copied);
    } catch {
      /* the codes are on screen to select */
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([`code\r\n${result.codes.join("\r\n")}\r\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discount-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (result) {
    return (
      <Modal
        open
        onClose={onClose}
        title={fmt(t.done, { count: result.count })}
        description={t.doneHint}
        footer={
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
        }
      >
        <div className="space-y-3">
          <ul dir="ltr" className="zimos-offer-paper grid max-h-64 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-[1rem] bg-paper-raised p-3 font-mono text-sm text-ink ring-1 ring-line">
            {result.codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => void copyAll()}>
              <IconCopy className="size-4" aria-hidden />
              {t.copy}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={download}>
              <IconDownload className="size-4" aria-hidden />
              {t.download}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void generate()}>
            {busy ? t.generating : fmt(t.generate, { count: Number.isInteger(n) && n > 0 ? n : 0 })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.count} type="number" inputMode="numeric" min={1} max={500} value={count} disabled={busy} onChange={(e) => setCount(e.target.value)} />
          <TextField label={t.prefix} hint={t.prefixHint} dir="ltr" maxLength={20} value={prefix} disabled={busy} onChange={(e) => setPrefix(e.target.value)} />
          <div className="space-y-1.5">
            <Label htmlFor="bulk-type">{t.type}</Label>
            <Select id="bulk-type" value={type} disabled={busy} onChange={(e) => setType(e.target.value as CodeType)}>
              <option value="percentage">{t.type_percentage}</option>
              <option value="fixed">{t.type_fixed}</option>
              <option value="free_shipping">{t.type_free_shipping}</option>
            </Select>
          </div>
          {type !== "free_shipping" && (
            <TextField
              label={type === "percentage" ? t.percent : t.amount}
              type="number"
              inputMode="decimal"
              min={0}
              dir="ltr"
              value={value}
              disabled={busy}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
          <TextField label={t.minimum} hint={t.minimumHint} type="number" inputMode="decimal" min={0} dir="ltr" value={minimum} disabled={busy} onChange={(e) => setMinimum(e.target.value)} />
          <TextField label={t.usage} hint={t.usageHint} type="number" inputMode="numeric" min={1} value={usage} disabled={busy} onChange={(e) => setUsage(e.target.value)} />
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
