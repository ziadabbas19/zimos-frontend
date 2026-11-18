import { useState } from "react";
import { cn } from "@store-builder/ui";
import { Segmented } from "@/components/Segmented";
import { storePictureSrc } from "@/lib/media";
import { ImageField } from "../ImageField";
import { useEditorLocale } from "../editorLocale";
import { lookUi } from "./themeLocale";
import { LOGO_ACCEPT, LOGO_HEIGHTS, logoFileProblem, type LogoProblem, type LogoSize } from "./logoFile";

/**
 * The store's logo: the file, the size it is drawn at, and the header bar it
 * sits in, shown at the real size so there is no surprise on the store.
 */
export function LogoField({
  value,
  size,
  onChange,
  onSize,
}: {
  value: string | null;
  size: LogoSize;
  onChange: (url: string | null) => void;
  onSize: (size: LogoSize) => void;
}) {
  const ui = lookUi(useEditorLocale());
  const heights = LOGO_HEIGHTS[size];

  const problemText = (problem: LogoProblem) =>
    problem.kind === "type"
      ? ui.logoBadType
      : problem.kind === "heavy"
        ? ui.logoTooHeavy
        : problem.kind === "small"
          ? ui.logoTooSmall(problem.width, problem.height)
          : ui.logoUnreadable;

  return (
    <div data-slot="logo-field" className="space-y-3">
      <ImageField
        label={ui.logo}
        labelHidden
        hint={ui.logoHint}
        value={value ?? ""}
        accept={LOGO_ACCEPT}
        validateFile={async (file) => {
          const problem = await logoFileProblem(file);
          return problem ? problemText(problem) : null;
        }}
        onChange={(url) => onChange(url || null)}
      />
      {value && <LogoBar src={value} height={heights.desktop} label={ui.logoPreviewDesktop(heights.desktop)} />}
      {value && <LogoBar src={value} height={heights.phone} label={ui.logoPreviewPhone(heights.phone)} narrow />}
      <div className="space-y-1.5">
        <p className="text-sm leading-6 font-medium text-ink">{ui.logoSize}</p>
        <Segmented<LogoSize>
          value={size}
          onChange={onSize}
          options={(["sm", "md", "lg"] as const).map((key) => ({ value: key, label: ui.logoSizeName(key) }))}
          label={ui.logoSize}
          size="sm"
          className="w-full"
        />
      </div>
    </div>
  );
}

/** A strip of header with the logo in it, at the height the store draws it. */
function LogoBar({ src, height, label, narrow = false }: { src: string; height: number; label: string; narrow?: boolean }) {
  const shown = storePictureSrc(src);
  const [natural, setNatural] = useState<{ src: string; width: number; height: number } | null>(null);
  const known = natural?.src === shown ? natural : null;
  if (!shown) return null;
  return (
    <figure className="space-y-1">
      <div className={cn("flex h-16 items-center overflow-hidden rounded-[0.625rem] bg-white px-3 ring-1 ring-line", narrow && "max-w-52")}>
        <img
          src={shown}
          alt=""
          style={{ height }}
          className="block w-auto max-w-full object-contain"
          onLoad={(e) => setNatural({ src: shown, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        />
      </div>
      <figcaption className="text-sm leading-6 text-ink-soft">
        {label}
        {known && (
          <>
            {" "}
            <bdi dir="ltr">{`(${known.width}×${known.height})`}</bdi>
          </>
        )}
      </figcaption>
    </figure>
  );
}
