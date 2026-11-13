import { useEffect, useState } from "react";
import { cn } from "@store-builder/ui";
import { emailCampaignPreview, type EmailCampaignBlock, type EmailCampaignLocale } from "@store-builder/api-client";
import { SkeletonBar } from "@/components/DataState";
import { Segmented } from "@/components/Segmented";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT } from "@/i18n/LocaleContext";
import { CAMPAIGN_STRINGS } from "./campaignStrings";

type Width = "desktop" | "mobile";

/**
 * The email as the server renders it — the same HTML customers get — in a
 * sandboxed frame (no scripts, no access to the dashboard), at a desktop
 * width or a phone's. Redrawn a moment after the merchant stops typing.
 */
export function EmailPreview({
  subject,
  preheader,
  blocks,
  locale,
}: {
  subject: string;
  preheader: string;
  blocks: EmailCampaignBlock[];
  locale: EmailCampaignLocale;
}) {
  const t = useT(CAMPAIGN_STRINGS);
  const workspaceId = useWorkspaceId();
  const [width, setWidth] = useState<Width>("desktop");
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify({ subject, preheader, blocks, locale });

  useEffect(() => {
    if (blocks.length === 0) {
      setHtml(null);
      return;
    }
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      emailCampaignPreview(apiClient, workspaceId, { subject, preheader: preheader || null, blocks, locale })
        .then((p) => {
          if (!live) return;
          setHtml(p.html);
          setFailed(false);
        })
        .catch(() => live && setFailed(true))
        .finally(() => live && setLoading(false));
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // The key holds every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t.preview}</h3>
        <Segmented
          label={t.preview}
          size="sm"
          value={width}
          onChange={(v) => setWidth(v)}
          options={[
            { value: "desktop", label: t.desktop },
            { value: "mobile", label: t.mobile },
          ]}
        />
      </div>
      <div className="flex justify-center overflow-x-auto rounded-xl border border-line bg-paper-sunken p-3" aria-busy={loading || undefined}>
        {blocks.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">{t.previewEmpty}</p>
        ) : failed && !html ? (
          <p role="alert" className="py-16 text-center text-sm text-danger">
            {t.previewError}
          </p>
        ) : html ? (
          <iframe
            title={t.previewFrame}
            srcDoc={html}
            sandbox=""
            className={cn(
              "h-[36rem] rounded-lg border-0 bg-white motion-safe:transition-[width] motion-safe:duration-200",
              width === "desktop" ? "w-full max-w-[40rem]" : "w-[23.4375rem] max-w-full"
            )}
          />
        ) : (
          <div className="w-full max-w-[40rem] space-y-3 rounded-lg bg-paper-raised p-6" role="status" aria-label={t.preview}>
            <SkeletonBar className="mx-auto h-8 w-32" />
            <SkeletonBar className="h-5 w-2/3" />
            <SkeletonBar className="w-full" />
            <SkeletonBar className="w-5/6" />
            <SkeletonBar className="h-10 w-40" />
          </div>
        )}
      </div>
    </div>
  );
}
