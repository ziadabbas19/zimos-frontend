import { useId, useState } from "react";
import { Button } from "@store-builder/ui";
import { parseVideoSource, type VideoProblem, type VideoProvider } from "@store-builder/api-client/video-embed";
import { Field } from "@/components/Field";
import { IconCheck, IconUpload, IconWarning } from "@/components/icons";
import { MediaPicker } from "@/components/MediaPicker";
import { Textarea } from "@/components/Textarea";
import { useEditorLocale, type EditorLocale } from "./editorLocale";
import { SwitchRow } from "./inspector/controls";

const HOSTS_EN = "YouTube, Vimeo, Facebook, Instagram, TikTok, Wistia, Loom, Google Drive or an MP4 link";
const HOSTS_AR = "يوتيوب أو فيميو أو فيسبوك أو إنستجرام أو تيك توك أو ويستيا أو لوم أو جوجل درايف أو رابط MP4";

const STRINGS = {
  en: {
    placeholder: "Paste a video link or embed code",
    hint: `Works with ${HOSTS_EN}.`,
    upload: "Upload an MP4",
    replace: "Upload another video",
    pickerTitle: "Choose a video",
    ready: (name: string) => `${name} is ready.`,
    autoplay: "Play by itself, muted, on a loop",
    autoplayHint: "For uploaded videos and MP4 links.",
    problems: {
      empty: "",
      unsafe: "This code can't be used. Paste the video's link, or the embed code from the video site.",
      "unknown-host": `This site isn't supported. Use ${HOSTS_EN}.`,
      "short-link": "This is a short link. Open the video and copy its full address.",
      unreadable: "We couldn't find a video in this link. Check it and paste it again.",
    } satisfies Record<VideoProblem, string>,
    names: {
      youtube: "YouTube video",
      vimeo: "Vimeo video",
      facebook: "Facebook video",
      instagram: "Instagram video",
      tiktok: "TikTok video",
      wistia: "Wistia video",
      loom: "Loom video",
      drive: "Google Drive video",
      file: "Video file",
    } satisfies Record<VideoProvider, string>,
  },
  ar: {
    placeholder: "الصق رابط الفيديو أو كود التضمين",
    hint: `يعمل مع ${HOSTS_AR}.`,
    upload: "رفع ملف MP4",
    replace: "رفع فيديو آخر",
    pickerTitle: "اختيار فيديو",
    ready: (name: string) => `${name} جاهز.`,
    autoplay: "تشغيل تلقائي بدون صوت وبشكل متكرر",
    autoplayHint: "للفيديوهات المرفوعة وروابط MP4.",
    problems: {
      empty: "",
      unsafe: "لا يمكن استخدام هذا الكود. الصق رابط الفيديو أو كود التضمين من موقع الفيديو.",
      "unknown-host": `هذا الموقع غير مدعوم. استخدم ${HOSTS_AR}.`,
      "short-link": "هذا رابط مختصر. افتح الفيديو وانسخ رابطه الكامل.",
      unreadable: "لم نجد فيديو في هذا الرابط. راجعه والصقه مرة أخرى.",
    } satisfies Record<VideoProblem, string>,
    names: {
      youtube: "فيديو يوتيوب",
      vimeo: "فيديو فيميو",
      facebook: "فيديو فيسبوك",
      instagram: "فيديو إنستجرام",
      tiktok: "فيديو تيك توك",
      wistia: "فيديو ويستيا",
      loom: "فيديو لوم",
      drive: "فيديو جوجل درايف",
      file: "ملف الفيديو",
    } satisfies Record<VideoProvider, string>,
  },
} satisfies Record<EditorLocale, unknown>;

/**
 * Where a Video section's video comes from: a pasted link, pasted embed code or an
 * uploaded file. Only the clean address is stored; what was pasted stays in this box
 * until it is replaced, and something the store can't play is never stored.
 */
export function VideoSourceField({
  label,
  value,
  autoplay,
  onChange,
}: {
  label: string;
  /** The stored address; "" when there is none. */
  value: string;
  autoplay: boolean;
  onChange: (key: "url" | "autoplay", value: string | boolean) => void;
}) {
  const t = STRINGS[useEditorLocale()];
  const noteId = useId();
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);
  // Undo, or another section's video: the box follows what is stored. What was just pasted stays as pasted.
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) setDraft(value);
  }

  const parsed = parseVideoSource(draft);
  const problem = !parsed.ok && parsed.problem !== "empty" ? t.problems[parsed.problem] : "";

  function paste(text: string) {
    setDraft(text);
    const next = parseVideoSource(text);
    if (next.ok) {
      setSent(next.src);
      onChange("url", next.src);
    } else if (next.problem === "empty") {
      setSent("");
      onChange("url", "");
    }
  }

  return (
    <div data-slot="video-source" className="space-y-3">
      <Field label={label} hint={t.hint}>
        {({ id }) => (
          <Textarea
            id={id}
            dir="ltr"
            rows={3}
            value={draft}
            placeholder={t.placeholder}
            aria-invalid={problem ? true : undefined}
            aria-describedby={noteId}
            onChange={(event) => paste(event.target.value)}
          />
        )}
      </Field>

      <div id={noteId} aria-live="polite">
        {problem && (
          <p role="alert" data-slot="video-source-problem" className="flex items-start gap-2 text-sm leading-6 text-danger">
            <IconWarning className="mt-1 size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{problem}</span>
          </p>
        )}
        {parsed.ok && (
          <p data-slot="video-source-ready" className="flex items-start gap-2 text-sm leading-6 text-ink">
            <IconCheck className="mt-1 size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{t.ready(t.names[parsed.provider])}</span>
          </p>
        )}
      </div>

      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setPicking(true)}>
        <IconUpload className="size-4" aria-hidden />
        {parsed.ok && parsed.kind === "file" ? t.replace : t.upload}
      </Button>

      {parsed.ok && parsed.kind === "file" && (
        <SwitchRow label={t.autoplay} hint={t.autoplayHint} checked={autoplay} onChange={(checked) => onChange("autoplay", checked)} />
      )}

      <MediaPicker open={picking} onOpenChange={setPicking} accept="video" title={t.pickerTitle} onPick={(file) => paste(file.url)} />
    </div>
  );
}
