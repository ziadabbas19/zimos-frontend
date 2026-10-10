import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@store-builder/ui";
import { whatsappTemplatesList, type LostOrder } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { IconWhatsApp } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { dayString, useLast } from "./lostOrderModel";

const STRINGS = {
  en: {
    title: "Send the recovery message?",
    toName: "It goes to {name} on WhatsApp, from your store's number, right away.",
    toNoName: "It goes to this customer on WhatsApp, from your store's number, right away.",
    what: "It is your store's ready recovery message: the customer's name, your store's name and a link that takes them back to finish the order. Sending it marks the order as contacted.",
    template: "The message as WhatsApp has it",
    templateNote: "The numbers in braces are filled in for each customer when it is sent.",
    dontAsk: "Don't ask me again today",
    dontAskHint: "Without this, the button still sends at once for the rest of this session.",
    send: "Send",
    cancel: "Cancel",
  },
  ar: {
    title: "إرسال رسالة الاسترجاع؟",
    toName: "ستُرسَل إلى {name} عبر واتساب من رقم المتجر، الآن.",
    toNoName: "ستُرسَل إلى هذا العميل عبر واتساب من رقم المتجر، الآن.",
    what: "هذه رسالة الاسترجاع الجاهزة الخاصة بمتجرك: فيها اسم العميل واسم المتجر ورابط يعيده ليكمل الطلب. وعند إرسالها يُعلَّم الطلب بأنه تم التواصل.",
    template: "نص الرسالة كما هو لدى واتساب",
    templateNote: "الأرقام بين الأقواس تُستبدل ببيانات كل عميل وقت الإرسال.",
    dontAsk: "لا تسألني مرة أخرى اليوم",
    dontAskHint: "بدونها أيضًا سيرسل الزر مباشرة إلى أن تغلق الصفحة.",
    send: "إرسال",
    cancel: "إلغاء",
  },
} satisfies Messages;

/** The template the backend sends unless another is named (checkoutSessions/lostOrderWhatsapp.js). */
const TEMPLATE_NAME = "cart_reminder";

/* ---------------------------------------------------------------- *
 * Whether to ask before sending. The first send of a session asks;
 * after it the button sends at once until the tab is closed. Ticking
 * «ما تسألنيش تاني النهارده» also covers new tabs for the rest of the day.
 * Storage may be missing (a private window): a module-level set stands in.
 * ---------------------------------------------------------------- */

const SESSION_KEY = "zimos.lostOrders.whatsappAsked.";
const TODAY_KEY = "zimos.lostOrders.whatsappNoAsk.";
const askedHere = new Set<string>();

export function shouldAskBeforeWhatsapp(workspaceId: string): boolean {
  if (askedHere.has(workspaceId)) return false;
  try {
    if (window.sessionStorage.getItem(SESSION_KEY + workspaceId) === "1") return false;
    if (window.localStorage.getItem(TODAY_KEY + workspaceId) === dayString(new Date())) return false;
  } catch {
    /* no storage: the set above is the memory */
  }
  return true;
}

export function rememberWhatsappAsked(workspaceId: string, notAgainToday: boolean): void {
  askedHere.add(workspaceId);
  try {
    window.sessionStorage.setItem(SESSION_KEY + workspaceId, "1");
    if (notAgainToday) window.localStorage.setItem(TODAY_KEY + workspaceId, dayString(new Date()));
  } catch {
    /* no storage */
  }
}

/**
 * Asked once, the first time «ابعت واتساب» is pressed in a session: with the
 * store's WhatsApp connected that button does not open a chat, it sends the
 * store's recovery template to the customer at once (POST
 * /checkout-sessions/:id/whatsapp). The sheet says so in words, shows the
 * template's text when the store's template list can be read, and offers not
 * to be asked again today. Nothing is sent until «ابعت».
 */
export function WhatsappSendConfirm({
  session,
  name,
  onCancel,
  onConfirm,
}: {
  /** The lost order about to be messaged; null keeps the sheet closed. */
  session: LostOrder | null;
  /** The customer's name as the list shows it; empty when there is none. */
  name: string;
  onCancel: () => void;
  onConfirm: (session: LostOrder, notAgainToday: boolean) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const checkId = useId();
  const open = session !== null;
  // What it was about, kept while the sheet closes.
  const shownName = useLast(open ? name : null) ?? "";
  const [notAgain, setNotAgain] = useState(false);
  useEffect(() => {
    if (open) setNotAgain(false);
  }, [open]);

  // The template's own words, read once, the first time the question is asked. A role that cannot read
  // the templates, or a store whose list has no such template, simply gets the sentence above without it.
  const [template, setTemplate] = useState<string | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    whatsappTemplatesList(apiClient, workspaceId, "APPROVED")
      .then((list) => {
        const rows = list.templates.filter((row) => row.name === TEMPLATE_NAME && row.bodyText);
        const row = rows.find((candidate) => candidate.language.toLowerCase().startsWith("ar")) ?? rows[0];
        setTemplate(row?.bodyText ?? null);
      })
      .catch(() => undefined);
  }, [open, workspaceId]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={t.title}
      description={shownName ? fmt(t.toName, { name: shownName }) : t.toNoName}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button
            type="button"
            className="gap-2 rounded-full px-5"
            onClick={() => {
              if (session) onConfirm(session, notAgain);
            }}
          >
            <IconWhatsApp className="size-4" aria-hidden />
            {t.send}
          </Button>
        </>
      }
    >
      <div data-slot="lost-whatsapp-ask" className="space-y-4">
        <p className="text-sm leading-6 text-ink">{t.what}</p>
        {template && (
          <figure>
            <figcaption className="mb-1.5 text-xs leading-4 font-medium text-ink-soft">{t.template}</figcaption>
            <blockquote
              dir="auto"
              data-slot="lost-template"
              className="max-h-48 overflow-y-auto rounded-[0.875rem] bg-paper-sunken px-3.5 py-3 text-sm leading-6 whitespace-pre-wrap text-ink"
            >
              {template}
            </blockquote>
            <p className="mt-1.5 text-xs leading-4 text-ink-soft">{t.templateNote}</p>
          </figure>
        )}
        <label htmlFor={checkId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.875rem] py-1.5">
          <input
            id={checkId}
            type="checkbox"
            checked={notAgain}
            onChange={(e) => setNotAgain(e.target.checked)}
            className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
          />
          <span className="min-w-0">
            <span className="block text-sm leading-6 font-medium text-ink">{t.dontAsk}</span>
            <span className="block text-xs leading-4 text-ink-soft">{t.dontAskHint}</span>
          </span>
        </label>
      </div>
    </Sheet>
  );
}
