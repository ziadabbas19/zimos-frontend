import { useSyncExternalStore } from "react";

/**
 * How the dashboard looks on this device: one of three looks, the tone of the
 * dark one, the glass surfaces and the colours they glow in.
 *
 * Everything is kept in localStorage and drawn from <html>: the `dark` class
 * (Black and Dark are both dark schemes), `data-look`, `data-tone`,
 * `data-glass="off"` and a few `--zimos-*` variables that theme/looks.css and
 * theme/liquid-glass.css read. The pre-paint script in index.html sets the
 * same things from the same keys before the first frame; a test runs both
 * over the same storage and compares what they leave on <html>.
 *
 * The same choices are also kept on the signed-in account, so they follow it
 * to another device: that is lib/appearanceSync.ts, which reads and writes
 * through this file and never draws anything itself.
 */

/** Light as ever, Black for OLED screens, Dark with a tone. */
export type Look = "light" | "black" | "dark";
export type DarkLook = Exclude<Look, "light">;

/**
 * "on": glass shows. "off": the merchant turned it off. "system": the device
 * asks for solid surfaces, whatever was chosen. "black": the Black look has no glass.
 */
export type GlassState = "on" | "off" | "system" | "black";

export const LOOK_KEY = "zimos.look";
/** The dark look the toolbar's sun / moon switch goes back to. */
export const DARK_LOOK_KEY = "zimos.darkLook";
export const TONE_KEY = "zimos.darkTone";
/** "off" is the only value kept here. */
export const GLASS_KEY = "zimos.glass";
export const GLOW_LEFT_KEY = "zimos.glowLeft";
export const GLOW_RIGHT_KEY = "zimos.glowRight";
export const GLOW_INTENSITY_KEY = "zimos.glowIntensity";
/**
 * Where light / dark was kept before there were three looks. Still read (a
 * merchant who chose dark opens in Dark) and still written, so an older copy
 * of the page opens in the same scheme.
 */
export const LEGACY_THEME_KEY = "theme";

export const TONE_MIDNIGHT = 0;
/** The dark look as it always was: nothing is kept and nothing is written on <html> at this tone. */
export const TONE_DEFAULT = 50;
export const TONE_SLATE = 100;
/** Glows at full strength, as they always were: nothing is kept at this value either. */
export const GLOW_FULL = 100;

export interface Appearance {
  look: Look;
  darkLook: DarkLook;
  /** 0 (midnight blue) … 100 (slate). Only the Dark look draws it. */
  tone: number;
  glass: GlassState;
  /** null: the colours the backdrop always had on that side. */
  glowLeft: string | null;
  glowRight: string | null;
  /** 0 (no glows) … 100. */
  glowIntensity: number;
}

// What the browser refused to keep (site data blocked): held for this visit, so every control still works.
const unsaved = new Map<string, string | null>();

function read(key: string): string | null {
  if (unsaved.has(key)) return unsaved.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, value);
  }
}

/** A whole number from 0 to 100, as it is kept; anything else is no value. */
function parsePercent(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n <= 100 ? n : null;
}

/** `#rrggbb`, in lower case; anything else is no colour. */
export function parseHexColour(value: string | null | undefined): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The device asked for less transparency or forced colours: the panes stay solid whatever was chosen. */
function systemWantsSolid(): boolean {
  return (
    window.matchMedia("(prefers-reduced-transparency: reduce)").matches ||
    window.matchMedia("(forced-colors: active)").matches
  );
}

/** The look that was chosen here, or null while the dashboard follows the device. */
function chosenLook(): Look | null {
  const look = read(LOOK_KEY);
  if (look === "light" || look === "black" || look === "dark") return look;
  const legacy = read(LEGACY_THEME_KEY);
  return legacy === "light" || legacy === "dark" ? legacy : null;
}

function chosenDarkLook(): DarkLook {
  return read(DARK_LOOK_KEY) === "black" ? "black" : "dark";
}

function current(): Appearance {
  const darkLook = chosenDarkLook();
  const look = chosenLook() ?? (systemDark() ? darkLook : "light");
  const glassOff = read(GLASS_KEY) === "off";
  return {
    look,
    darkLook,
    tone: parsePercent(read(TONE_KEY)) ?? TONE_DEFAULT,
    glass: systemWantsSolid() ? "system" : look === "black" ? "black" : glassOff ? "off" : "on",
    glowLeft: parseHexColour(read(GLOW_LEFT_KEY)),
    glowRight: parseHexColour(read(GLOW_RIGHT_KEY)),
    glowIntensity: parsePercent(read(GLOW_INTENSITY_KEY)) ?? GLOW_FULL,
  };
}

function setVariable(name: string, value: string | null) {
  const style = document.documentElement.style;
  if (value === null) style.removeProperty(name);
  else style.setProperty(name, value);
}

/** Draws a state on <html>. The same writes, in the same cases, as the pre-paint script in index.html. */
function apply(state: Appearance = current()) {
  const el = document.documentElement;
  const dark = state.look !== "light";
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  el.setAttribute("data-look", state.look);

  // The tone is two shares looks.css mixes with: of the dark look as it always
  // was (against midnight), then of slate. At the default tone nothing is set.
  if (state.look === "dark" && state.tone !== TONE_DEFAULT) {
    el.setAttribute("data-tone", String(state.tone));
    setVariable("--zimos-tone-mid", `${Math.min(100, state.tone * 2)}%`);
    setVariable("--zimos-tone-slate", `${Math.max(0, (state.tone - TONE_DEFAULT) * 2)}%`);
  } else {
    el.removeAttribute("data-tone");
    setVariable("--zimos-tone-mid", null);
    setVariable("--zimos-tone-slate", null);
  }

  // liquid-glass.css is written under :root:not([data-glass="off"]).
  if (state.glass === "on") el.removeAttribute("data-glass");
  else el.setAttribute("data-glass", "off");

  setVariable("--zimos-glow-left", state.glowLeft);
  setVariable("--zimos-glow-right", state.glowRight);
  setVariable("--zimos-glow-strength", state.glowIntensity < GLOW_FULL ? `${state.glowIntensity}%` : null);
}

// useSyncExternalStore needs the same object back while nothing changed.
let cached: Appearance | null = null;
let cachedKey = "";

function snapshot(): Appearance {
  const next = current();
  const key = JSON.stringify(next);
  if (cached === null || key !== cachedKey) {
    cached = next;
    cachedKey = key;
  }
  return cached;
}

// Subscribers in this tab — `storage` events only fire in *other* tabs.
const listeners = new Set<() => void>();
const KEYS = new Set<string>([
  LOOK_KEY,
  DARK_LOOK_KEY,
  TONE_KEY,
  GLASS_KEY,
  GLOW_LEFT_KEY,
  GLOW_RIGHT_KEY,
  GLOW_INTENSITY_KEY,
  LEGACY_THEME_KEY,
]);

function changed() {
  apply();
  listeners.forEach((fn) => fn());
}

/** Follows the other tabs and the device's settings while anything on the page reads the look. */
function watch(): () => void {
  // The device's scheme counts only while nothing was chosen here; `current` already reads it that way.
  const queries = [
    window.matchMedia("(prefers-color-scheme: dark)"),
    window.matchMedia("(prefers-reduced-transparency: reduce)"),
    window.matchMedia("(forced-colors: active)"),
  ];
  const onStorage = (event: StorageEvent) => {
    // A null key is a cleared storage.
    if (event.key === null || KEYS.has(event.key)) changed();
  };
  queries.forEach((mq) => mq.addEventListener("change", changed));
  window.addEventListener("storage", onStorage);
  return () => {
    queries.forEach((mq) => mq.removeEventListener("change", changed));
    window.removeEventListener("storage", onStorage);
  };
}

let unwatch: (() => void) | null = null;

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Another tab, or the device setting, may have changed since this page drew itself at load.
  apply();
  unwatch ??= watch();
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      unwatch?.();
      unwatch = null;
    }
  };
}

/** The look of the dashboard on this device, followed live: this tab, another tab and the device's own settings. */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// Told of each choice made on this page: not of one that came from another tab, the device or the account.
const editListeners = new Set<() => void>();

function edited() {
  changed();
  editListeners.forEach((fn) => fn());
}

/** Calls back after each choice made on this page (lib/appearanceSync saves it to the account). */
export function onAppearanceEdit(listener: () => void): () => void {
  editListeners.add(listener);
  return () => {
    editListeners.delete(listener);
  };
}

function keepLook(look: Look) {
  write(LOOK_KEY, look);
  if (look !== "light") write(DARK_LOOK_KEY, look);
  write(LEGACY_THEME_KEY, look === "light" ? "light" : "dark");
}

export function setLook(look: Look) {
  keepLook(look);
  edited();
}

/** The toolbar's sun / moon switch: Light, or the dark look that was chosen last (Black or Dark). */
export function toggleScheme() {
  const now = current();
  setLook(now.look === "light" ? now.darkLook : "light");
}

function keepTone(tone: number) {
  const next = clampPercent(tone);
  write(TONE_KEY, next === TONE_DEFAULT ? null : String(next));
}

/** 0 (midnight blue) … 100 (slate); the default tone is kept as nothing at all. */
export function setTone(tone: number) {
  keepTone(tone);
  edited();
}

function keepGlass(on: boolean) {
  write(GLASS_KEY, on ? null : "off");
}

export function setGlass(on: boolean) {
  keepGlass(on);
  edited();
}

export interface GlowChange {
  /** A `#rrggbb` colour, or null for the colours that side always had. Anything else is ignored. */
  left?: string | null;
  right?: string | null;
  /** 0 … 100. */
  intensity?: number;
}

function keepGlow(change: GlowChange) {
  if (change.left !== undefined && (change.left === null || parseHexColour(change.left))) {
    write(GLOW_LEFT_KEY, parseHexColour(change.left));
  }
  if (change.right !== undefined && (change.right === null || parseHexColour(change.right))) {
    write(GLOW_RIGHT_KEY, parseHexColour(change.right));
  }
  if (change.intensity !== undefined) {
    const next = clampPercent(change.intensity);
    write(GLOW_INTENSITY_KEY, next === GLOW_FULL ? null : String(next));
  }
}

export function setGlow(change: GlowChange) {
  keepGlow(change);
  edited();
}

/** Back to the glows the backdrop always had. */
export function resetGlow() {
  setGlow({ left: null, right: null, intensity: GLOW_FULL });
}

/**
 * The choices as they are kept here, whatever this device makes of them: what
 * an account carries from one device to another (lib/appearanceSync).
 */
export interface KeptAppearance {
  /** null while nothing was chosen and the dashboard follows the device. */
  look: Look | null;
  tone: number;
  /** The glass switch itself, not what the Black look or the device does with it. */
  glass: boolean;
  glowLeft: string | null;
  glowRight: string | null;
  glowIntensity: number;
}

export function keptAppearance(): KeptAppearance {
  return {
    look: chosenLook(),
    tone: parsePercent(read(TONE_KEY)) ?? TONE_DEFAULT,
    glass: read(GLASS_KEY) !== "off",
    glowLeft: parseHexColour(read(GLOW_LEFT_KEY)),
    glowRight: parseHexColour(read(GLOW_RIGHT_KEY)),
    glowIntensity: parsePercent(read(GLOW_INTENSITY_KEY)) ?? GLOW_FULL,
  };
}

/** Whether anything about the look was ever kept on this device. */
export function hasKeptAppearance(): boolean {
  return [LOOK_KEY, DARK_LOOK_KEY, TONE_KEY, GLASS_KEY, GLOW_LEFT_KEY, GLOW_RIGHT_KEY, GLOW_INTENSITY_KEY].some((key) => read(key) !== null);
}

/**
 * Takes the choices kept on the account: kept and drawn here like a choice
 * made on this page, without being one. A look that was never chosen there
 * leaves the one here as it is.
 */
export function adoptAppearance(next: KeptAppearance) {
  if (next.look) keepLook(next.look);
  keepTone(next.tone);
  keepGlass(next.glass);
  keepGlow({ left: next.glowLeft, right: next.glowRight, intensity: next.glowIntensity });
  changed();
}

/**
 * Run once as the app starts (and by the tests): a choice kept under the old
 * "theme" key becomes the look of the same name, then the state is drawn.
 */
export function restoreAppearance() {
  const look = read(LOOK_KEY);
  if (look !== "light" && look !== "black" && look !== "dark") {
    const legacy = read(LEGACY_THEME_KEY);
    if (legacy === "light" || legacy === "dark") write(LOOK_KEY, legacy);
  }
  apply();
}

if (typeof document !== "undefined") restoreAppearance();
