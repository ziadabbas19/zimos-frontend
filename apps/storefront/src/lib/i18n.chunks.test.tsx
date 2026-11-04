import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real thing, not the setup file's stand-in.
vi.unmock("@/lib/dictionaryChunks");

/**
 * In a browser each language is a chunk of its own (lib/dictionaryChunks.tsx). The setup
 * file has them all, as the server does; these cases load the module afresh,
 * so nothing is there until it is asked for, as in a browser's first render.
 */
async function fresh() {
  vi.resetModules();
  const [i18n, context, chunks] = await Promise.all([import("./i18n"), import("./StoreContext"), import("./dictionaryChunks")]);
  return { ...i18n, ...context, ...chunks };
}

const STORE = { workspaceId: "w", id: "w", slug: "w", name: "Store", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as never;

function Words({ useStore }: { useStore: () => { t: { common: { home: string } }; dir: string } }) {
  const { t, dir } = useStore();
  return (
    <p data-testid="words" dir={dir}>
      {t.common.home}
    </p>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(cleanup);

describe("a language's words in the browser", () => {
  it.each([
    ["ar", "الرئيسية", "rtl"],
    ["en", "Home", "ltr"],
    ["fr", "Accueil", "ltr"],
  ] as const)("%s: the first render waits for its chunk, then reads it, right to left where it should be", async (locale, word, dir) => {
    const { StoreContextProvider, useStore, loadedDictionary } = await fresh();
    expect(loadedDictionary(locale)).toBeNull();
    await act(async () => {
      render(
        <Suspense fallback={<p data-testid="waiting" />}>
          <StoreContextProvider locale={locale} store={STORE}>
            <Words useStore={useStore as never} />
          </StoreContextProvider>
        </Suspense>,
      );
    });
    const words = await screen.findByTestId("words");
    expect(words.textContent).toBe(word);
    expect(words.getAttribute("dir")).toBe(dir);
    expect(loadedDictionary(locale)).not.toBeNull();
  });

  it("loads only the language asked for", async () => {
    const { loadDictionary, loadedDictionary } = await fresh();
    await loadDictionary("ar");
    expect(loadedDictionary("ar")).not.toBeNull();
    expect(loadedDictionary("en")).toBeNull();
    expect(loadedDictionary("fr")).toBeNull();
  });

  it("asks once for a language, however many read it", async () => {
    const { loadDictionary } = await fresh();
    expect(loadDictionary("en")).toBe(loadDictionary("en"));
  });

  it("getDictionary never breaks a click: a language not here reads as the one that is", async () => {
    const { getDictionary, loadDictionary, loadedDictionary } = await fresh();
    const ar = await loadDictionary("ar");
    expect(getDictionary("ar")).toBe(ar);
    expect(getDictionary("en")).toBe(ar);
    // ...and fetches the one it was asked for, for the next time.
    await vi.waitFor(() => expect(loadedDictionary("en")).not.toBeNull());
    expect(getDictionary("en")).not.toBe(ar);
    expect(getDictionary("en").common.home).toBe("Home");
  });

  it("getDictionary with nothing here at all waits, as a render can", async () => {
    const { getDictionary, loadedDictionary } = await fresh();
    let thrown: unknown;
    try {
      getDictionary("en");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Promise);
    await thrown;
    expect(loadedDictionary("en")).not.toBeNull();
  });

});

describe("the dictionaries themselves", () => {
  it("have the same keys in every language", async () => {
    const { ALL_DICTIONARIES } = await import("./i18nAll");
    const shape = (value: unknown): unknown =>
      value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value as object)
              .sort()
              .map((key) => [key, shape((value as Record<string, unknown>)[key])]),
          )
        : typeof value === "function"
          ? "fn"
          : "text";
    const en = shape(ALL_DICTIONARIES.en);
    expect(shape(ALL_DICTIONARIES.ar)).toEqual(en);
    expect(shape(ALL_DICTIONARIES.fr)).toEqual(en);
  });

  it("with every language here, as on the server, nothing waits in a server render", async () => {
    const { getDictionary, registerDictionary } = await import("./i18n");
    const { ALL_DICTIONARIES } = await import("./i18nAll");
    for (const locale of ["ar", "en", "fr"] as const) registerDictionary(locale, ALL_DICTIONARIES[locale]);
    expect(getDictionary("ar").common.home).toBe("الرئيسية");
    expect(getDictionary("en").common.home).toBe("Home");
    expect(getDictionary("fr").common.home).toBe("Accueil");
    const { StoreContextProvider, useStore } = await import("./StoreContext");
    const html = renderToStaticMarkup(
      <StoreContextProvider locale="ar" store={STORE}>
        <Words useStore={useStore as never} />
      </StoreContextProvider>,
    );
    expect(html).toContain("الرئيسية");
    expect(html).toContain('dir="rtl"');
  });
});
