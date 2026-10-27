"use client";

import { useEffect, useState } from "react";
import { ApiError, storeDownloadFileUrl, storeGetDownload, type PublicDownload } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary, card, container } from "./ui";
import { StoreLoader } from "@/components/StoreLoader";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

const STRINGS = {
  en: {
    loading: "Loading your download…",
    notFound: "This download link is not valid.",
    error: "We could not load your download. Please try again.",
    retry: "Try again",
    download: "Download",
    openLink: "Open your product",
    codes: "Your codes",
    copy: "Copy",
    copied: "Copied",
    codesPending: (n: number) => `${n} more code(s) will appear here as soon as the store adds stock.`,
    downloadsLeft: (n: number) => `${n} download(s) left`,
    expires: (when: string) => `Available until ${when}`,
    expired: "This link has expired. Contact the store to get a new one.",
    used_up: "This link has reached its download limit. Contact the store to get a new one.",
    revoked: "This link is no longer active. Contact the store.",
  },
  ar: {
    loading: "جارٍ تحميل منتجك…",
    notFound: "رابط التحميل ده مش صحيح.",
    error: "مقدرناش نحمّل منتجك. حاول تاني.",
    retry: "حاول تاني",
    download: "تحميل",
    openLink: "افتح منتجك",
    codes: "الأكواد بتاعتك",
    copy: "نسخ",
    copied: "تم النسخ",
    codesPending: (n: number) => `باقي ${n} كود هيظهر هنا أول ما المتجر يضيف مخزون.`,
    downloadsLeft: (n: number) => `متبقي ${n} مرة تحميل`,
    expires: (when: string) => `متاح حتى ${when}`,
    expired: "الرابط ده انتهت صلاحيته. تواصل مع المتجر للحصول على رابط جديد.",
    used_up: "الرابط ده وصل للحد الأقصى من مرات التحميل. تواصل مع المتجر للحصول على رابط جديد.",
    revoked: "الرابط ده لم يعد متاحًا. تواصل مع المتجر.",
  },
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The buyer's download page for one digital product (SPEC §18.2). The token in
 * the address is the credential; the file is streamed by the API, which also
 * counts the download and enforces the limit and the expiry.
 */
export function DigitalDownload({ workspaceId, token }: { workspaceId: string; token: string }) {
  const { intlLocale } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const [download, setDownload] = useState<PublicDownload | null>(null);
  const [problem, setProblem] = useState<"notFound" | "error" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProblem(null);
    storeGetDownload(createStorefrontApiClient(), workspaceId, token)
      .then((found) => {
        if (!cancelled) setDownload(found);
      })
      .catch((err) => {
        if (!cancelled) setProblem(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, token, attempt]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — the code is on screen to select by hand */
    }
  }

  return (
    <div className={`${container} py-10`}>
      <div className={`${card} mx-auto max-w-xl p-6`}>
        {problem ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-sm text-ink">
              {problem === "notFound" ? t.notFound : t.error}
            </p>
            {problem === "error" && (
              <button type="button" className={btnPrimary} onClick={() => setAttempt((n) => n + 1)}>
                {t.retry}
              </button>
            )}
          </div>
        ) : !download ? (
          <StoreLoader label={t.loading} className="mx-auto" />
        ) : (
          <div className="space-y-5">
            <h1 dir="auto" className="text-xl font-semibold text-ink">
              {download.productName}
            </h1>
            {download.message && (
              <p dir="auto" className="whitespace-pre-line text-sm text-ink">
                {download.message}
              </p>
            )}

            {download.state !== "active" ? (
              <p role="alert" className="rounded-xl bg-paper px-4 py-3 text-sm font-medium text-ink">
                {t[download.state]}
              </p>
            ) : (
              <>
                {download.type === "file" && download.fileName && (
                  <div className="space-y-2">
                    <a
                      href={storeDownloadFileUrl(apiBaseUrl, workspaceId, token)}
                      className={`${btnPrimary} w-full`}
                      // The API counts this download; refresh what is left afterwards.
                      onClick={() => window.setTimeout(() => setAttempt((n) => n + 1), 2000)}
                    >
                      {t.download}
                    </a>
                    <p className="text-center text-xs text-ink-soft">
                      <bdi>{download.fileName}</bdi>
                      {download.fileSizeBytes !== null && <> · {formatSize(download.fileSizeBytes)}</>}
                    </p>
                  </div>
                )}
                {download.type === "link" && download.linkUrl && (
                  <a href={download.linkUrl} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} w-full`}>
                    {t.openLink}
                  </a>
                )}
                {download.type === "license_codes" && (
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{t.codes}</h2>
                    <ul className="mt-2 space-y-2">
                      {download.codes.map((code) => (
                        <li key={code} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2">
                          <code dir="ltr" className="break-all text-sm font-semibold text-ink">
                            {code}
                          </code>
                          <button type="button" onClick={() => void copy(code)} className="shrink-0 cursor-pointer text-xs font-medium text-primary">
                            {copied === code ? t.copied : t.copy}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {download.codesPending > 0 && <p className="mt-2 text-xs text-ink-soft">{t.codesPending(download.codesPending)}</p>}
                  </div>
                )}
                <p className="text-xs text-ink-soft">
                  {download.downloadsLeft !== null && <span>{t.downloadsLeft(download.downloadsLeft)}</span>}
                  {download.downloadsLeft !== null && download.expiresAt && " · "}
                  {download.expiresAt && (
                    <span>{t.expires(new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(download.expiresAt)))}</span>
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
