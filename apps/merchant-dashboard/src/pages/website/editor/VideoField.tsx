import { useState } from "react";
import { Button, Label } from "@store-builder/ui";
import { IconDelete, IconVideo, IconWarning } from "@/components/icons";
import { MediaPicker } from "@/components/MediaPicker";
import { imageSrc } from "@/lib/media";
import { useEditorLocale, type EditorLocale } from "./editorLocale";

/**
 * A background video for something that already has a picture (a slide of the
 * picture slider). The video is chosen from the store's media library, in its
 * video mode (MP4 or WebM, uploaded there or picked from what is there); no
 * address is typed.
 *
 * The file's size is kept beside its address so the field can go on saying
 * that a heavy one loads slowly. It only says so: nothing is refused here.
 * The store shows the video on a wide screen with a good connection, and the
 * picture alone everywhere else — which is why a picture is asked for too.
 */

/** From here up a background video is called heavy. The media library itself takes up to 30 MB. */
export const HEAVY_VIDEO_BYTES = 8 * 1024 * 1024;

const STRINGS = {
  en: {
    choose: "Choose a video",
    change: "Change the video",
    remove: "Remove the video",
    pickerTitle: "Choose a background video",
    heavy: (mb: string) => `This video is ${mb} MB. Over 8 MB it loads slowly for shoppers: a shorter or smaller file starts sooner.`,
    posterNeeded: "Add the picture too: it shows before the video starts, and it is all that shows on a phone.",
  },
  ar: {
    choose: "اختيار مقطع فيديو",
    change: "تغيير الفيديو",
    remove: "إزالة الفيديو",
    pickerTitle: "اختيار فيديو الخلفية",
    heavy: (mb: string) => `حجم هذا الفيديو ${mb} ميجابايت. ما يزيد على 8 ميجابايت يتأخر تحميله عند العملاء؛ الملف الأقصر أو الأصغر يبدأ أسرع.`,
    posterNeeded: "أضف الصورة أيضًا: تظهر قبل أن يبدأ الفيديو، وهي كل ما يظهر على الموبايل.",
  },
} satisfies Record<EditorLocale, unknown>;

/** "9.4": megabytes with one decimal, in the language's own digits. */
function megabytes(bytes: number, locale: EditorLocale): string {
  const mb = bytes / (1024 * 1024);
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 }).format(mb);
  } catch {
    return mb.toFixed(1);
  }
}

function Warning({ children }: { children: string }) {
  return (
    <p role="status" className="flex items-start gap-1.5 text-xs leading-5 text-accent-dark">
      <IconWarning className="mt-[3px] size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function VideoField({
  label,
  hint,
  value,
  bytes,
  posterMissing,
  onChange,
}: {
  label: string;
  hint?: string;
  /** The video's address; "" when there is none. */
  value: string;
  /** The file's size, when it was known at the time it was chosen. */
  bytes: number | null;
  /** The picture that stands in for the video is still empty. */
  posterMissing: boolean;
  /** A chosen video with its size (when the library knows it), or `null` to take the video away. */
  onChange: (next: { url: string; bytes: number | null } | null) => void;
}) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const [picking, setPicking] = useState(false);
  const src = value ? (imageSrc(value) ?? value) : "";

  return (
    <div data-slot="inspector-video" className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[0.5rem] border border-line bg-paper text-ink-soft">
          {src ? (
            // The first frame is the thumbnail; nothing more of the file is fetched for it.
            <video src={`${src}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
          ) : (
            <IconVideo className="size-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
              <IconVideo className="size-4" aria-hidden />
              {value ? t.change : t.choose}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <IconDelete className="size-4" aria-hidden />
                {t.remove}
              </Button>
            )}
          </div>
          {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
        </div>
      </div>
      {value && posterMissing && <Warning>{t.posterNeeded}</Warning>}
      {value && bytes !== null && bytes > HEAVY_VIDEO_BYTES && <Warning>{t.heavy(megabytes(bytes, locale))}</Warning>}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        accept="video"
        title={t.pickerTitle}
        onPick={(file) => onChange({ url: file.url, bytes: typeof file.size === "number" ? file.size : null })}
      />
    </div>
  );
}
