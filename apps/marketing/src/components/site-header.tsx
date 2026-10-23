"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { isPlainClick, keepTop, notePlaceBeforeMenu, restorePlace } from "@/lib/keep-place";
import { LOGIN_URL, REGISTER_URL } from "@/lib/urls";
import { List, X } from "./duo-icons";
import { LocalePill } from "./locale-pill";
import { LocaleSegment } from "./locale-segment";
import { ThemeToggle, restoreTheme } from "./theme-toggle";
import { ZimosLogo } from "./zimos-logo";

/**
 * The bar on every page: a white card floating a little below the top of the
 * window (owner, 2026-10-22, after lightfunnels.com) — logo, the section links
 * in the middle, sign in outlined and the way in in the brand blue. It keeps
 * floating as the page scrolls, with a deeper shadow. The language switch
 * and the theme switch wait side by side at the bottom corner of the screen
 * (the footer has both too). Below 1081px the links, the language and the
 * theme move into a sheet that opens inside the card, from the menu button,
 * and closes on a choice, Esc, a click outside, or the screen growing back.
 *
 * The logo goes to the top of the home page: on the home page it scrolls
 * up; from another page it opens the home page at its top. The page this
 * header mounts on puts back, before it is painted, the light/dark theme
 * and a place kept by the logo or the language switch (lib/keep-place.ts).
 */
export function SiteHeader() {
  const { locale, dict } = useI18n();
  const { nav } = dict;
  const pathname = usePathname();
  const home = `/${locale}`;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [footerShown, setFooterShown] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sheetId = useId();

  // The theme first: measuring the page for the place would otherwise draw
  // it once in the wrong theme, and the colour transitions would show.
  useLayoutEffect(() => {
    restoreTheme();
    if (pathname) restorePlace(pathname);
  }, [pathname]);

  // Next's own scroll on these links lands the page in the middle (the
  // sticky header sits above `scroll-padding-top`, so Next scrolls each part
  // of the page into view in turn, smoothly, and the header's turn wins), and
  // the home page's own address does not scroll at all. The logo does it.
  const onLogo = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    if (!isPlainClick(event)) return;
    if (pathname === home) {
      event.preventDefault();
      if (window.location.hash) window.history.replaceState(null, "", home);
      window.scrollTo({ top: 0 });
    } else {
      keepTop(home);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // From 601px to 1080px the footer's row wraps under the corner buttons,
  // which would cover its links. The footer has both switches, so while it
  // is on screen the corner steps aside.
  useEffect(() => {
    const foot = document.querySelector("footer");
    if (!foot || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => setFooterShown(entry.isIntersecting));
    io.observe(foot);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    const onClick = (event: MouseEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 1080) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Sections of the home page, and the pricing page: whole addresses, so
  // they work from every page, not only the home page.
  const sections = [
    { href: `/${locale}#templates`, label: nav.templates },
    { href: `/${locale}#benefits`, label: nav.benefits },
    { href: `/${locale}#how`, label: nav.howItWorks },
    { href: `/${locale}/pricing`, label: nav.pricing },
    { href: `/${locale}#faq`, label: nav.faq },
  ];

  return (
    <>
      <header ref={bar} className={`lz-top${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`}>
        <a className="lz-skip" href="#main">
          {nav.skipToContent}
        </a>

        <div className="lz-top__card">
          <div className="lz-top__in">
            <Link href={home} scroll={false} aria-label={nav.homeAria} className="lz-top__brand" onClick={onLogo}>
              <ZimosLogo height={36} />
            </Link>

            <nav className="lz-top__links" aria-label={nav.primaryLabel}>
              {sections.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="lz-top__end">
              <a href={LOGIN_URL} className="lz-top__login">
                {nav.signIn}
              </a>
              <a href={REGISTER_URL} className="lz-top__cta">
                {nav.startFree}
              </a>
              <button
                ref={menuButton}
                type="button"
                className="lz-top__menu"
                aria-expanded={open}
                aria-controls={sheetId}
                aria-label={open ? nav.closeMenu : nav.openMenu}
                onClick={() => {
                  // The sheet moves the page; a language picked in it keeps this place.
                  if (!open) notePlaceBeforeMenu();
                  setOpen((v) => !v);
                }}
              >
                <List size={22} className="lz-menu-open" />
                <X size={22} className="lz-menu-close" />
              </button>
            </div>
          </div>

          <div className="lz-sheet" id={sheetId} hidden={!open}>
            <nav aria-label={nav.primaryLabel}>
              {sections.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="lz-sheet__row">
              <span>{nav.languageLabel}</span>
              <LocaleSegment />
            </div>
            <div className="lz-sheet__row">
              <span>{nav.themeLabel}</span>
              <ThemeToggle />
            </div>
            <a href={LOGIN_URL} className="lz-sheet__login">
              {nav.signIn}
            </a>
          </div>
        </div>
      </header>
      <div className={`lz-corner${footerShown ? " is-away" : ""}`}>
        <LocalePill />
        <ThemeToggle className="lz-corner__theme" />
      </div>
    </>
  );
}
