import { useState } from "react";
import { lostOrdersExport, type LostOrderFilters } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    exported_zero: "Nothing to export: no lost order matches these filters.",
    exported_one: "{n} lost order exported.",
    exported_two: "{n} lost orders exported.",
    exported_few: "{n} lost orders exported.",
    exported_many: "{n} lost orders exported.",
    exported_other: "{n} lost orders exported.",
  },
  ar: {
    exported_zero: "لا يوجد ما يُصدَّر: لا يوجد طلب مفقود يطابق هذه الفلاتر.",
    exported_one: "تم تصدير طلب مفقود واحد.",
    exported_two: "تم تصدير طلبين مفقودين.",
    exported_few: "تم تصدير {n} طلبات مفقودة.",
    exported_many: "تم تصدير {n} طلبًا مفقودًا.",
    exported_other: "تم تصدير {n} طلب مفقود.",
  },
} satisfies Messages;

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * The lost orders export: the list as it is filtered now, as a CSV file. The
 * server masks the phones and names the file. The choice lives in the
 * header's Tools menu (LostOrdersTools.tsx); this is what it runs.
 */
export function useLostOrdersExport(filters: LostOrderFilters): { busy: boolean; run: () => Promise<void> } {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const { csv, count, filename } = await lostOrdersExport(apiClient, workspaceId, filters);
      saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
      toast.success(count === 0 ? t.exported_zero : pluralOf(t, "exported", count));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}
