"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  PRODUCT_QUESTION_LIMITS,
  storefrontAskProductQuestion,
  storefrontProductQuestions,
  type StorefrontProductQuestion,
  type StorefrontProductQuestions,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary, btnSecondary, card, input, label as labelClass } from "../ui";
import { StoreButtonLoader } from "@/components/StoreLoader";

/**
 * «أسئلة وأجوبة» on the product page: the questions
 * the store has answered and published, newest answers first, and the form
 * to ask one. A question is never shown as it is sent — it waits for the
 * store's answer — so after sending the shopper is told exactly that. The
 * email is optional and private: only to tell them about the answer.
 */

const QUESTIONS_PAGE_SIZE = 20;

const TEXT = {
  en: {
    title: "Questions & answers",
    ask: "Ask a question",
    none: "No questions yet. Wondering about something? Ask and the store will answer.",
    anonymous: "A shopper",
    storeAnswer: "Store's answer",
    formTitle: "Your question",
    question: "Question",
    questionPlaceholder: "What would you like to know about this product?",
    name: "Your name (optional)",
    email: "Your email (optional)",
    emailHint: "We'll tell you when we answer",
    send: "Send question",
    sending: "Sending…",
    cancel: "Cancel",
    thanks: "Got it — it will appear once we answer",
    tooShort: "Write your question — at least 5 characters.",
    badEmail: "That email doesn't look right. Fix it or leave it empty.",
    tooMany: "You've sent several questions. Try again in a while.",
    failed: "Your question wasn't sent — try again.",
    more: "More questions",
    loading: "Loading…",
  },
  ar: {
    title: "أسئلة وأجوبة",
    ask: "اسأل سؤال",
    none: "مفيش أسئلة لسه. عندك سؤال عن المنتج؟ اسأل والمتجر هيرد عليك.",
    anonymous: "عميل",
    storeAnswer: "رد المتجر",
    formTitle: "سؤالك",
    question: "السؤال",
    questionPlaceholder: "عايز تعرف إيه عن المنتج ده؟",
    name: "اسمك (اختياري)",
    email: "إيميلك (اختياري)",
    emailHint: "هنبلغك لما نرد",
    send: "ابعت السؤال",
    sending: "بنبعت…",
    cancel: "إلغاء",
    thanks: "وصلنا سؤالك، هيظهر بعد ما نرد عليه",
    tooShort: "اكتب سؤالك — ٥ حروف على الأقل.",
    badEmail: "الإيميل ده مش مظبوط. صلّحه أو سيبه فاضي.",
    tooMany: "بعت أسئلة كتير. جرّب تاني بعد شوية.",
    failed: "السؤال ما اتبعتش — جرّب تاني.",
    more: "أسئلة أكتر",
    loading: "بنحمّل…",
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProductQuestionsList({
  workspaceId,
  productId,
  initial,
}: {
  workspaceId: string;
  productId: string;
  /** The first page, read on the server so the answers are in the page as it arrives. */
  initial: StorefrontProductQuestions;
}) {
  const { locale, intlLocale } = useStore();
  const text = pickText(TEXT, locale);
  const ids = useId();
  const questionBox = useRef<HTMLTextAreaElement>(null);
  const emailBox = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<StorefrontProductQuestion[]>(initial.questions);
  const [total, setTotal] = useState(initial.total);
  const [loadingMore, setLoadingMore] = useState(false);

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ field: "question" | "email" | null; message: string } | null>(null);
  const [sent, setSent] = useState(false);

  const date = (iso: string | null) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(intlLocale, { year: "numeric", month: "short", day: "numeric" }) : "";
  };

  async function more() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await storefrontProductQuestions(createStorefrontApiClient(), workspaceId, productId, {
        limit: QUESTIONS_PAGE_SIZE,
        offset: questions.length,
      });
      setQuestions((prev) => [...prev, ...page.questions.filter((q) => !prev.some((p) => p.id === q.id))]);
      // No further page came: stop offering one.
      setTotal(page.questions.length === 0 ? questions.length : page.total);
    } catch {
      /* the button stays: the shopper can try again */
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const body = question.trim();
    const mail = email.trim();
    if ([...body].length < PRODUCT_QUESTION_LIMITS.questionMin) {
      setProblem({ field: "question", message: text.tooShort });
      questionBox.current?.focus();
      return;
    }
    if (mail && !EMAIL.test(mail)) {
      setProblem({ field: "email", message: text.badEmail });
      emailBox.current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await storefrontAskProductQuestion(createStorefrontApiClient(), workspaceId, productId, {
        question: body,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(mail ? { email: mail } : {}),
        locale,
      });
      setSent(true);
      setOpen(false);
      setQuestion("");
      setName("");
      setEmail("");
    } catch (err) {
      setProblem({ field: null, message: err instanceof ApiError && err.status === 429 ? text.tooMany : text.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${ids}-title`} className="text-xl font-semibold text-ink">
          {text.title}
        </h2>
        {!open && !sent && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setOpen(true);
              setProblem(null);
            }}
          >
            {text.ask}
          </button>
        )}
      </div>

      <p role="status" className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary empty:hidden">
        {sent ? text.thanks : ""}
      </p>

      {open && (
        <form onSubmit={submit} noValidate className={`${card} mt-4 space-y-4 p-5`}>
          <h3 className="text-base font-semibold text-ink">{text.formTitle}</h3>
          <div>
            <label htmlFor={`${ids}-question`} className={labelClass}>
              {text.question}
            </label>
            <textarea
              ref={questionBox}
              id={`${ids}-question`}
              rows={3}
              required
              autoFocus
              maxLength={PRODUCT_QUESTION_LIMITS.question}
              value={question}
              placeholder={text.questionPlaceholder}
              aria-invalid={problem?.field === "question" || undefined}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (problem?.field === "question") setProblem(null);
              }}
              className={input}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-name`} className={labelClass}>
                {text.name}
              </label>
              <input
                id={`${ids}-name`}
                type="text"
                autoComplete="name"
                maxLength={PRODUCT_QUESTION_LIMITS.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label htmlFor={`${ids}-email`} className={labelClass}>
                {text.email}
              </label>
              <input
                ref={emailBox}
                id={`${ids}-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                maxLength={PRODUCT_QUESTION_LIMITS.email}
                value={email}
                aria-invalid={problem?.field === "email" || undefined}
                aria-describedby={`${ids}-email-hint`}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (problem?.field === "email") setProblem(null);
                }}
                className={input}
              />
              <p id={`${ids}-email-hint`} className="mt-1.5 text-xs text-ink-soft">
                {text.emailHint}
              </p>
            </div>
          </div>
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger empty:hidden">
            {problem?.message}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? text.sending : text.send}
            </button>
            <button type="button" disabled={busy} className={btnSecondary} onClick={() => setOpen(false)}>
              {text.cancel}
            </button>
          </div>
        </form>
      )}

      {questions.length === 0 ? (
        !open && !sent && <p className="mt-4 text-sm text-ink-soft">{text.none}</p>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {questions.map((q) => (
            <li key={q.id} className={`${card} p-5`}>
              <p dir="auto" className="whitespace-pre-line text-base font-semibold leading-snug text-ink">
                {q.question}
              </p>
              <p className="mt-1.5 text-xs text-ink-soft">
                <bdi>{q.askerName || text.anonymous}</bdi> · {date(q.createdAt)}
              </p>
              {q.answer && (
                <div className="mt-3 rounded-xl bg-paper px-4 py-3">
                  <p className="text-xs font-semibold text-primary">{text.storeAnswer}</p>
                  <p dir="auto" className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {q.answer}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {questions.length > 0 && questions.length < total && (
        <div className="mt-4 flex justify-center">
          <button type="button" disabled={loadingMore} className={btnSecondary} onClick={() => void more()}>
            {loadingMore ? <StoreButtonLoader label={text.loading}>{text.more}</StoreButtonLoader> : text.more}
          </button>
        </div>
      )}
    </section>
  );
}
