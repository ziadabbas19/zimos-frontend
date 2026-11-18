"use client";

import { useState } from "react";
import {
  naturalAspect,
  parseVideoSource,
  videoPoster,
  videoSandbox,
  VIDEO_ASPECTS,
  type VideoAspect,
} from "@store-builder/api-client/video-embed";

export interface VideoSectionProps {
  url: string;
  title?: string;
  caption?: string;
  aspect?: string;
  autoplay?: boolean;
  maxWidth?: string;
  rounded?: boolean;
  /** The words for the play button and for a video with no title, in the store's language. */
  playLabel: string;
  videoLabel: string;
  noVideoLabel: string;
}

/**
 * A merchant's video. The address is read again here, whatever was saved: only a
 * known host's player or a direct video file is ever drawn. YouTube and Vimeo wait
 * for a press before their player loads, so a page with a video stays light.
 */
export function VideoSection({ url, title, caption, aspect, autoplay, maxWidth, rounded = true, playLabel, videoLabel, noVideoLabel }: VideoSectionProps) {
  const [playing, setPlaying] = useState(false);
  const video = parseVideoSource(url);
  if (!video.ok) return null;

  const heading = title?.trim() ?? "";
  const note = caption?.trim() ?? "";
  const name = heading || videoLabel;
  const chosen = VIDEO_ASPECTS.includes(aspect as VideoAspect) ? (aspect as VideoAspect) : naturalAspect(video);
  const tall = chosen === "9:16";
  const facade = video.kind === "iframe" && (video.provider === "youtube" || video.provider === "vimeo") && !playing;
  const poster = videoPoster(video);

  return (
    <figure data-slot="video-section" data-width={maxWidth === "full" ? "full" : "container"} className={`m-0 w-full ${maxWidth === "full" ? "" : "mx-auto max-w-4xl"}`}>
      {heading && <h3 className="mb-3 text-lg font-semibold text-[var(--store-text,inherit)]">{heading}</h3>}
      <div
        data-slot="video-frame"
        style={{ aspectRatio: chosen.replace(":", " / "), maxHeight: tall ? "80vh" : undefined }}
        className={`relative mx-auto w-full overflow-hidden border border-[var(--store-border,transparent)] bg-[var(--store-surface,#000)] ${rounded ? "rounded-2xl" : ""} ${tall ? "max-w-sm" : "max-w-full"}`}
      >
        {video.kind === "file" ? (
          <video
            src={video.src}
            title={name}
            controls={!autoplay}
            autoPlay={autoplay}
            muted={autoplay}
            loop={autoplay}
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          >
            {noVideoLabel}
          </video>
        ) : facade ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${playLabel}: ${name}`}
            className="group absolute inset-0 flex size-full cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--store-primary,currentColor)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the video host's own small poster */}
            {poster && <img src={poster} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />}
            <span
              aria-hidden
              className="relative flex size-16 items-center justify-center rounded-full bg-[var(--store-primary,#111)] text-[var(--store-on-primary,#fff)] shadow-lg transition-transform group-hover:scale-105 motion-reduce:transition-none"
            >
              <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
          </button>
        ) : (
          <iframe
            src={video.src}
            title={name}
            loading="lazy"
            sandbox={videoSandbox(video.provider)}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        )}
      </div>
      {note && <figcaption className="mt-2 text-center text-sm text-[var(--store-muted,inherit)]">{note}</figcaption>}
    </figure>
  );
}
