"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { isPlainClick, notePlaceBeforeMenu, restorePlace } from "@/lib/keep-place";
import { LOGIN_URL, REGISTER_URL } from "@/lib/urls";
import { List, X } from "./duo-icons";
import { LocalePill } from "./locale-pill";
import { LocaleSegment } from "./locale-segment";
import { ThemeToggle, restoreTheme } from "./theme-toggle";
import { ZimosLogo } from "./zimos-logo";

/** Wider than this, the sections are in the bar; narrower, in the sheet. */
const SHEET_BELOW = 1024;

/**
 * The home page's bar (site-header.tsx is every other page's): a pill
 * floating over the page — logo, the page's sections, then the language,
 * the theme, sign in and the way in. Nothing in it wraps: from 1024px up it
 * is one line in both languages (home.css), and below that the sections
 * fold into a sheet that opens inside the pill from the menu button and
 * closes on a choice, Esc, a click outside, or the screen growing back. The
 * link to the section being read is lit by the page's effects
 * (home-effects.tsx), which read `data-nav`.
 *
 * As the shared header does, it puts back the light/dark theme and a place
 * kept by the language switch before the page is painted, and the logo
 * goes back to the top of the page.
 */
export function HomeHeader() {
  const { locale, dict } = useI18n();
  const { nav } = dict;
  const pathname = usePathname();
  const home = `/${locale}`;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sheetId = useId();

  useLayoutEffect(() => {
    restoreTheme();
    if (pathname) restorePlace(pathname);
  }, [pathname]);

  const onLogo = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (window.location.hash) window.history.replaceState(null, "", home);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
      if (window.innerWidth >= SHEET_BELOW) setOpen(false);
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

  // The sections' own ids, the ones every other page's header links to.
  const sections = [
    { id: "templates", label: nav.templates },
    { id: "benefits", label: nav.benefits },
    { id: "how", label: nav.howItWorks },
    { id: "growth", label: nav.growth },
    { id: "pricing", label: nav.pricing },
    { id: "faq", label: nav.faq },
  ];

  return (
    <header ref={bar} className={`zm-hdr${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`}>
      <a className="zm-skip" href="#main">
        {nav.skipToContent}
      </a>

      <div className="zm-hdr-in">
        {/* The page itself: nothing to fetch ahead, the logo only goes back to the top. */}
        <Link href={home} prefetch={false} scroll={false} aria-label={nav.homeAria} className="zm-logo" onClick={onLogo}>
          <ZimosLogo height={32} />
        </Link>

        <nav className="zm-nav" aria-label={nav.primaryLabel}>
          {sections.map((item) => (
            <a key={item.id} href={`#${item.id}`} data-nav={item.id}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="zm-hact">
          {/* The other language's page is fetched on the click, not with this one (its pictures came with it). */}
          <LocalePill prefetch={false} />
          <ThemeToggle className="zm-ic" />
          <a href={LOGIN_URL} className="zm-signin">
            {nav.signIn}
          </a>
          <a href={REGISTER_URL} className="zm-btn zm-btn--blue zm-btn--sm" data-mag="">
            {nav.startFree}
          </a>
          <button
            ref={menuButton}
            type="button"
            className="zm-menu"
            aria-expanded={open}
            aria-controls={sheetId}
            aria-label={open ? nav.closeMenu : nav.openMenu}
            onClick={() => {
              if (!open) notePlaceBeforeMenu();
              setOpen((v) => !v);
            }}
          >
            <List size={22} className="zm-menu-open" />
            <X size={22} className="zm-menu-close" />
          </button>
        </div>

        <div className="zm-sheet" id={sheetId} hidden={!open}>
          <nav aria-label={nav.primaryLabel}>
            {sections.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="zm-sheet__row">
            <span>{nav.languageLabel}</span>
            <LocaleSegment />
          </div>
          <div className="zm-sheet__row">
            <span>{nav.themeLabel}</span>
            <ThemeToggle className="zm-ic" />
          </div>
          <a href={LOGIN_URL} className="zm-sheet__login">
            {nav.signIn}
          </a>
        </div>
      </div>
    </header>
  );
}
