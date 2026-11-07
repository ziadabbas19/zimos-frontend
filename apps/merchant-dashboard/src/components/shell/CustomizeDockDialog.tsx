import { useCallback } from "react";
import { dashboardResetMobileNav, dashboardSetMobileNav, type HomeShortcuts } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { DOCK_CATALOG, readMobileNav, seedMobileNav } from "@/lib/mobileNav";
import { ShortcutRowEditor, type ShortcutRowEditorProps } from "@/pages/home/CustomizeShortcutsDialog";

// The dashboard's Arabic is Modern Standard Arabic.
const WORDS: ShortcutRowEditorProps["words"] = {
  en: {
    title: "Customize the bottom bar",
    description: "Choose the pages on the bar at the bottom of your phone, and their order. “More” always stays at the end. Only you see this, in this store.",
    current: "Your bar",
    none: "Nothing on the bar yet: only “More” shows. Add a page from the list.",
    add: "Add a page",
    full: "The bar holds {max} pages. Hide one to add another.",
    saved: "Bottom bar updated.",
    restored: "The default bar is back. Press Done to save.",
  },
  ar: {
    title: "تخصيص الشريط السفلي",
    description: "اختر الصفحات التي تظهر في الشريط أسفل شاشة هاتفك وترتيبها. يبقى «المزيد» دائمًا في آخره. هذا الترتيب لك وحدك في هذا المتجر.",
    current: "شريطك",
    none: "لا توجد صفحات في الشريط بعد: يظهر «المزيد» وحده. أضف صفحة من القائمة.",
    add: "إضافة صفحة",
    full: "يتسع الشريط لـ {max} صفحات. أخفِ إحداها لإضافة غيرها.",
    saved: "تم تحديث الشريط السفلي.",
    restored: "استُعيد الشريط الافتراضي. اضغط «تم» للحفظ.",
  },
};

export interface CustomizeDockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  answer: HomeShortcuts;
  permissions?: readonly string[] | null;
}

/** The phone's bottom bar (lib/mobileNav): the Home row's editor, with the bar's slots and endpoints. */
export function CustomizeDockDialog({ workspaceId, ...props }: CustomizeDockDialogProps) {
  const refresh = useCallback(() => void readMobileNav(workspaceId), [workspaceId]);
  return (
    <ShortcutRowEditor
      {...props}
      catalog={DOCK_CATALOG}
      idPrefix="dock-slots"
      words={WORDS}
      refresh={refresh}
      save={(ids) => dashboardSetMobileNav(apiClient, workspaceId, ids)}
      reset={() => dashboardResetMobileNav(apiClient, workspaceId)}
      onSaved={(saved) => seedMobileNav(workspaceId, saved)}
    />
  );
}
