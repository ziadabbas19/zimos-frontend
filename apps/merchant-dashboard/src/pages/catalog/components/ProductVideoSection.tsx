import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Button, Card, CardContent, ZLoader } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Video",
    help: "An MP4 or WebM video of the product, up to {mb} MB. It plays on the product page under the pictures.",
    upload: "Upload a video",
    uploading: "Uploading…",
    remove: "Remove video",
    tooBig: "The video is larger than {mb} MB.",
    wrongType: "Choose an MP4 or WebM video.",
    saved: "Video saved.",
    removed: "Video removed.",
    empty: "No video yet.",
  },
  ar: {
    title: "الفيديو",
    help: "فيديو للمنتج MP4 أو WebM، لحد {mb} ميجا. بيشتغل في صفحة المنتج تحت الصور.",
    upload: "ارفع فيديو",
    uploading: "جارٍ الرفع…",
    remove: "شيل الفيديو",
    tooBig: "الفيديو أكبر من {mb} ميجا.",
    wrongType: "اختار فيديو MP4 أو WebM.",
    saved: "تم حفظ الفيديو.",
    removed: "تم شيل الفيديو.",
    empty: "مفيش فيديو لسه.",
  },
} satisfies Messages;

const MAX_MB = 30;
const ACCEPT = "video/mp4,video/webm";

/** A media entry that is a video (uploaded through the media library: mimeType video/*). */
export const isVideoMedia = (m: ProductMedia) => typeof (m as { mimeType?: unknown }).mimeType === "string" && String((m as { mimeType?: string }).mimeType).startsWith("video/");

/**
 * The product's video (SPEC §7.1): kept in `product.media` beside the
 * pictures, told apart by its video/* type, so the pictures section leaves it
 * alone and the storefront plays it under the gallery. Saved at once.
 */
export function ProductVideoSection({ productId, media, onChanged }: { productId: string; media: ProductMedia[]; onChanged: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const images = media.filter((m) => !isVideoMedia(m));
  const videos = media.filter(isVideoMedia);

  async function save(next: ProductMedia[], message: string) {
    await apiClient.updateProduct(workspaceId, productId, { media: [...images, ...next] });
    toast.success(message);
    onChanged();
  }

  async function upload(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) return toast.error(t.wrongType);
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(fmt(t.tooBig, { mb: MAX_MB }));
    setBusy(true);
    try {
      const uploaded = await apiClient.uploadMedia(workspaceId, file);
      await save([...videos, uploaded as ProductMedia], t.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(index: number) {
    setBusy(true);
    try {
      await save(videos.filter((_, i) => i !== index), t.removed);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{fmt(t.help, { mb: MAX_MB })}</p>
        </div>
        {videos.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {videos.map((v, i) => (
              <li key={v.url} className="space-y-2">
                <video src={v.url} controls preload="metadata" className="aspect-video w-full rounded-[0.5rem] border border-line bg-black" />
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy} onClick={() => void remove(i)}>
                  <Trash2 className="size-4" aria-hidden /> {t.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border border-line px-4 text-sm font-medium text-ink hover:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40">
          {busy ? <ZLoader size="sm" /> : <Upload className="size-4" aria-hidden />}
          {busy ? t.uploading : t.upload}
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}
