import { useState, type ReactNode } from "react";
import type { PageTree } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconDesktop, IconPhoneDevice } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import { useT, type Messages } from "@/i18n/LocaleContext";
import type { ColorMode, PreviewTheme } from "@/lib/previewBridge";

const STRINGS = {
  en: { device: "Preview size", mobile: "Phone", desktop: "Computer" },
  ar: { device: "حجم المعاينة", mobile: "الهاتف", desktop: "الحاسوب" },
} satisfies Messages;

export type PreviewDeviceChoice = "mobile" | "desktop";

/**
 * The live store in a device, for a sheet: a switch (phone first — that is how
 * shoppers arrive), then the storefront itself (TemplateLivePreview, the large
 * variant: it scrolls and can be pressed) inside a dark bezel on a flat, quiet
 * ground. The ground and the bezel are not glass and neither is the store: it
 * looks the way its theme says.
 *
 * The stage needs a height: give one through `stageClassName` (the frame
 * fills it). `controls` sit beside the device switch (the theme gallery's
 * light / dark buttons).
 */
export function DevicePreview({
  workspaceId,
  templateId,
  page,
  theme = null,
  colorMode = null,
  title,
  fallback,
  defaultDevice = "mobile",
  controls,
  stageClassName,
  className,
}: {
  workspaceId: string;
  /** The template whose home page to show, or — with `page` — the key its preview slot is kept under. */
  templateId: string;
  /** A page tree to show instead of the template's own. */
  page?: PageTree | null;
  theme?: PreviewTheme | null;
  colorMode?: ColorMode | null;
  /** Names the frame for screen readers. */
  title: string;
  fallback: ReactNode;
  defaultDevice?: PreviewDeviceChoice;
  controls?: ReactNode;
  stageClassName?: string;
  className?: string;
}) {
  const t = useT(STRINGS);
  const [device, setDevice] = useState<PreviewDeviceChoice>(defaultDevice);
  const phone = device === "mobile";

  return (
    <div data-slot="device-preview" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <Segmented
          size="sm"
          value={device}
          onChange={setDevice}
          label={t.device}
          options={[
            { value: "mobile", label: t.mobile, icon: IconPhoneDevice },
            { value: "desktop", label: t.desktop, icon: IconDesktop },
          ]}
        />
        {controls}
      </div>
      <div
        data-slot="device-stage"
        className={cn(
          "zimos-device-stage flex justify-center overflow-hidden rounded-[1.25rem] bg-paper-sunken p-3 sm:p-4",
          stageClassName
        )}
      >
        {/* The bezel: near-black whatever the theme, like the device it stands for. */}
        <div
          data-slot="device-frame"
          data-device={device}
          className={cn(
            // A hairline of light in the dark theme, where a near-black bezel would sink into the ground.
            "h-full min-w-0 bg-[#14161a] shadow-[var(--shadow-raised)] dark:ring-1 dark:ring-white/15",
            phone ? "w-full max-w-[20rem] rounded-[2.25rem] p-[5px]" : "w-full rounded-[0.875rem] p-[3px]"
          )}
        >
          <div className={cn("h-full overflow-hidden bg-paper-raised", phone ? "rounded-[1.95rem]" : "rounded-[0.7rem]")}>
            <TemplateLivePreview
              variant="full"
              device={device}
              workspaceId={workspaceId}
              templateId={templateId}
              page={page}
              theme={theme}
              colorMode={colorMode}
              title={title}
              fallback={fallback}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
