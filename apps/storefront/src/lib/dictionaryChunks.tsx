"use client";

import { use, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_LOCALE, isLocale, loadedDictionary, registerDictionary, setDictionaryLoader, type Dictionary, type Locale } from "./i18n";

/*
 * A visit downloads its own language only: in the browser each dictionary is a
 * chunk of its own (lib/i18n.ts has the server's side).
 *
 * <DictionaryChunk> is what fetches it: drawn on the server, next/dynamic names
 * the chunk in the page's <head>, so the browser fetches it beside the page's
 * other scripts; drawn in the browser, it holds the render until the chunk is
 * here. There is no Suspense boundary above it on purpose, so hydration just
 * waits with the server's HTML on screen, and a language switch (a transition)
 * keeps the old language until the new one arrives. A boundary there would let a
 * page's notFound() or redirect answer 200 after the shell has gone out.
 *
 * next/dynamic and a plain import() of one module make two chunks with the same
 * words in them, and a page would download both. So DictionaryChunk is the way
 * in, and the plain import() below is only for whoever asks with no
 * DictionaryChunk around it: never a page under the store layout.
 */

/** The dictionaries that have arrived, or are awaited, as promises React can wait on. */
const waiting: Partial<Record<Locale, { promise: Promise<Dictionary>; resolve: (dictionary: Dictionary) => void }>> = {};

function waitFor(locale: Locale) {
  let entry = waiting[locale];
  if (!entry) {
    let resolve: (dictionary: Dictionary) => void = () => undefined;
    const promise = new Promise<Dictionary>((done) => {
      resolve = done;
    });
    entry = { promise, resolve };
    waiting[locale] = entry;
  }
  return entry;
}

function arrived(locale: Locale, dictionary: Dictionary): Dictionary {
  registerDictionary(locale, dictionary);
  waitFor(locale).resolve(dictionary);
  return dictionary;
}

const Nothing = () => null;

const CHUNKS: Record<Locale, ComponentType> = {
  ar: dynamic(() =>
    import("./i18nAr").then((m) => {
      arrived("ar", m.ar);
      return Nothing;
    }),
  ),
  en: dynamic(() =>
    import("./i18nEn").then((m) => {
      arrived("en", m.en);
      return Nothing;
    }),
  ),
  fr: dynamic(() =>
    import("./i18nFr").then((m) => {
      arrived("fr", m.fr);
      return Nothing;
    }),
  ),
};

/** Draws nothing; see above. Goes before whatever reads the language with useArrivedDictionary. */
export function DictionaryChunk({ locale }: { locale: Locale }) {
  const Chunk = CHUNKS[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return <Chunk />;
}

const LOADERS: Record<Locale, () => Promise<Dictionary>> = {
  ar: () => import("./i18nAr").then((m) => m.ar),
  en: () => import("./i18nEn").then((m) => m.en),
  fr: () => import("./i18nFr").then((m) => m.fr),
};
const loading: Partial<Record<Locale, Promise<Dictionary>>> = {};

/** The language's dictionary with no DictionaryChunk around: the same promise every time, so React can wait on it. */
export function loadDictionary(locale: Locale): Promise<Dictionary> {
  const key = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const existing = loading[key];
  if (existing) return existing;
  const started = LOADERS[key]().then(
    (dictionary) => arrived(key, dictionary),
    (err: unknown) => {
      // A chunk that failed to arrive: the next ask tries again.
      delete loading[key];
      throw err;
    },
  );
  loading[key] = started;
  return started;
}

setDictionaryLoader(loadDictionary);

/** What React reads without waiting: a thenable that says it is already fulfilled. */
const ready = new WeakMap<Dictionary, PromiseLike<Dictionary>>();

function readyThenable(dictionary: Dictionary): PromiseLike<Dictionary> {
  let thenable = ready.get(dictionary);
  if (!thenable) {
    thenable = Object.assign(Promise.resolve(dictionary), { status: "fulfilled", value: dictionary });
    ready.set(dictionary, thenable);
  }
  return thenable;
}

/*
 * Both hooks call `use` every time, also when the dictionary is here: a render
 * that suspended is replayed, and React needs the same `use` again on that replay
 * to go on to the hooks after it ("Update hook called on initial render", seen on
 * a first visit whose chunk arrived during the wait).
 */

/** Under a <DictionaryChunk> of that language: waits for it to arrive. */
export function useArrivedDictionary(locale: Locale): Dictionary {
  const dictionary = loadedDictionary(locale);
  return use(dictionary ? readyThenable(dictionary) : waitFor(isLocale(locale) ? locale : DEFAULT_LOCALE).promise);
}

/** With none around: fetches it if it has to. */
export function useDictionary(locale: Locale): Dictionary {
  const dictionary = loadedDictionary(locale);
  return use(dictionary ? readyThenable(dictionary) : loadDictionary(locale));
}
