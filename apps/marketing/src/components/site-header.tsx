"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { CloseIcon, MenuIcon } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

const REGISTER_URL = "https://app.zimos.co/register";
const LOGIN_URL = "https://app.zimos.co/login";

export function SiteHeader() {
  const { locale, dict } = useI18n();
  const { nav } = dict;
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const sections = [
    { href: "#features", label: nav.features },
    { href: "#pricing", label: nav.pricing },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-ink"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden className="size-2.5 rounded-[3px] bg-primary" />
          {nav.brand}
        </Link>

        <nav
          aria-label={nav.brand}
          className="hidden items-center gap-7 text-sm text-ink-soft md:flex"
        >
          {sections.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <a
            href={LOGIN_URL}
            className="hidden h-9 items-center rounded-full px-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            {nav.login}
          </a>
          <a
            href={REGISTER_URL}
            className="hidden h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark sm:inline-flex"
          >
            {nav.startStore}
          </a>
          <button
            type="button"
            className="cursor-pointer inline-flex size-9 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft transition-colors hover:text-ink md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? nav.closeMenu : nav.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-[1.15rem]">{open ? <CloseIcon /> : <MenuIcon />}</span>
          </button>
        </div>
      </div>

      {open && (
        <div
          id={menuId}
          className="border-t border-line bg-paper-raised px-4 py-4 sm:px-6 md:hidden"
        >
          <nav className="flex flex-col gap-1 text-sm">
            {sections.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2.5 text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary-dark"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a
              href={LOGIN_URL}
              className="rounded-lg px-2 py-2.5 text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary-dark"
            >
              {nav.login}
            </a>
          </nav>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={REGISTER_URL}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {nav.startStore}
            </a>
            <LocaleSwitcher className="h-10 sm:hidden" />
          </div>
        </div>
      )}
    </header>
  );
}
