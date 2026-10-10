"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { HERO_PHONE_QUERY, REDUCED_MOTION_QUERY, connectionOf, heroVideoAllowed, videoTypeOf } from "./videoRules";

/**
 * A slide's background video, over the slide's picture.
 *
 * The picture stays underneath and is the poster: it is what the server
 * sends, what shows until the first frame arrives, and all there ever is on a
 * phone-wide screen, with less motion asked for, with data saving on or on a
 * slow connection (videoRules.ts). In those cases no <video> element exists,
 * so nothing of the file is fetched.
 *
 * Otherwise the element is there with preload="none" and nothing is fetched
 * until the hero is on (or near) the screen; then it plays, muted and in a
 * loop, while its slide is the one showing and the tab is visible. It has no
 * controls and can never make a sound: it is muted when made, before every
 * play, and again if anything turns its volume up.
 */

function subscribe(onChange: () => void): () => void {
  const phone = window.matchMedia(HERO_PHONE_QUERY);
  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  const connection = connectionOf(navigator);
  phone.addEventListener("change", onChange);
  motion.addEventListener("change", onChange);
  connection?.addEventListener?.("change", onChange);
  return () => {
    phone.removeEventListener("change", onChange);
    motion.removeEventListener("change", onChange);
    connection?.removeEventListener?.("change", onChange);
  };
}

function allowedNow(): boolean {
  const connection = connectionOf(navigator);
  return heroVideoAllowed({
    phone: window.matchMedia(HERO_PHONE_QUERY).matches,
    reducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  });
}

/** The server, and the first paint in the browser, draw the picture alone. */
const allowedOnServer = () => false;

/** Whether the box is on the screen or close to it. Watched only while `watch` is true. */
function useNear(box: RefObject<HTMLElement | null>, watch: boolean): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    // A browser too old to say what is on the screen keeps the picture.
    if (!watch || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setNear(entries.some((entry) => entry.isIntersecting)), { rootMargin: "200px 0px" });
    observer.observe(el);
    return () => {
      observer.disconnect();
      setNear(false);
    };
  }, [box, watch]);
  return watch && near;
}

function Clip({ src, play }: { src: string; play: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  // The video is see-through until its first frame, so the picture never gives way to an empty box.
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sync = () => {
      if (play && !document.hidden) {
        silence(video);
        // A refused play (a browser's own rule) leaves the picture showing.
        void Promise.resolve(video.play()).catch(() => undefined);
      } else {
        video.pause();
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [play]);

  return (
    <video
      ref={ref}
      data-showing={showing ? "" : undefined}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
      onPlaying={() => setShowing(true)}
      onVolumeChange={(event) => silence(event.currentTarget)}
    >
      <source src={src} type={videoTypeOf(src)} />
    </video>
  );
}

/** Muted and at no volume, whatever the file holds and whatever asked for sound. */
function silence(video: HTMLVideoElement) {
  video.defaultMuted = true;
  if (!video.muted) video.muted = true;
  if (video.volume !== 0) video.volume = 0;
}

export function HeroVideo({ src, active }: { src: string; active: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const allowed = useSyncExternalStore(subscribe, allowedNow, allowedOnServer);
  const near = useNear(box, allowed);

  return (
    <div ref={box} className="zs-hero__video" aria-hidden>
      {allowed ? <Clip src={src} play={near && active} /> : null}
    </div>
  );
}
