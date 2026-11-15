import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Website, WebsiteDetail, WebsiteTemplateDetail, WebsiteTemplateSummary, Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { MAX_LOADING_PREVIEWS } from "@/lib/templatePreview";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { WebsitePage } from "./WebsitePage";

/** jsdom has no IntersectionObserver; this one lets a test decide what is on screen. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly elements = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.elements.add(el);
  }
  unobserve(el: Element) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
  }
  takeRecords() {
    return [];
  }
  /** One element scrolls in (or out) of view. */
  static report(target: Element, isIntersecting: boolean) {
    for (const observer of FakeIntersectionObserver.instances) {
      if (observer.elements.has(target)) {
        observer.callback([{ target, isIntersecting } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
      }
    }
  }
  static scrollAllIntoView() {
    for (const observer of FakeIntersectionObserver.instances) {
      const entries = [...observer.elements].map(
        (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry
      );
      if (entries.length > 0) {
        observer.callback(entries, observer as unknown as IntersectionObserver);
      }
    }
  }
}

function template(id: string, name: string, category: string | null) {
  return fake<WebsiteTemplateSummary>({
    id,
    name,
    category,
    thumbnailUrl: null,
    templateVersionId: `v_${id}`,
  });
}

const homeDetail = fake<WebsiteTemplateDetail>({
  pages: [
    {
      path: "/",
      title: "الرئيسية",
      pageType: "home",
      builderData: { version: 1, sections: [{ id: "hero", type: "section", rows: [] }] },
      seo: {},
    },
  ],
});

let submit: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  // jsdom can't navigate a frame; count the posts instead.
  submit = vi.fn<() => void>();
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(submit);
  api.listWebsites.mockResolvedValue([]);
  api.me.mockResolvedValue(fake({}));
  api.getWebsiteTemplate.mockResolvedValue(homeDetail);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebsitePage template gallery", () => {
  it("builds category chips from the templates and filters by category and name", async () => {
    api.listWebsiteTemplates.mockResolvedValue([
      template("t_1", "Nile Fashion", "fashion"),
      template("t_2", "Oud House", "perfume"),
      template("t_3", "Cairo Basics", null),
      template("t_4", "Zamalek Fashion", "fashion"),
    ]);

    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    const chips = await screen.findByRole("group", { name: "Filter templates by category" });
    // One chip per real category, plus All, each with how many it holds; a template without one adds none.
    expect(
      Array.from(chips.querySelectorAll("button")).map((b) => b.textContent)
    ).toEqual(["All4", "Fashion2", "Perfume1"]);
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(4);

    await user.click(within(chips).getByRole("button", { name: /^Perfume/ }));
    expect(within(chips).getByRole("button", { name: /^Perfume/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^Preview / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Preview Oud House",
    ]);

    await user.click(within(chips).getByRole("button", { name: /^Fashion/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "zamalek");
    expect(screen.getAllByRole("button", { name: /^Preview / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Preview Zamalek Fashion",
    ]);

    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "x");
    expect(screen.getByText("No templates match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all templates" }));
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(4);

    // Nothing scrolled into view, so no template was fetched for a preview.
    expect(api.getWebsiteTemplate).not.toHaveBeenCalled();
  });

  it("loads previews only for cards in view, a few at a time", async () => {
    api.listWebsiteTemplates.mockResolvedValue([
      template("lazy_1", "Store One", "general"),
      template("lazy_2", "Store Two", "general"),
      template("lazy_3", "Store Three", "general"),
      template("lazy_4", "Store Four", "general"),
    ]);

    renderWithProviders(<WebsitePage />, { route: "/website" });

    expect(await screen.findAllByRole("button", { name: /^Preview / })).toHaveLength(4);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(api.getWebsiteTemplate).not.toHaveBeenCalled();

    act(() => FakeIntersectionObserver.scrollAllIntoView());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS));
    expect(api.getWebsiteTemplate).toHaveBeenCalledTimes(4);
    expect(document.querySelectorAll("iframe")).toHaveLength(MAX_LOADING_PREVIEWS);

    // Each post goes to the storefront preview route with its own token.
    const forms = Array.from(document.querySelectorAll("form[target]"));
    expect(forms[0]).toHaveAttribute("action", `${STOREFRONT_URL}/store/ws_1/preview`);
    const tokens = forms.map((f) => (f.querySelector('input[name="token"]') as HTMLInputElement).value);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(JSON.parse((forms[0].querySelector('input[name="tree"]') as HTMLInputElement).value)).toEqual(
      (homeDetail.pages[0].builderData as object)
    );

    // A frame that finishes loading frees its slot for the next card. jsdom
    // fires its own loads for the blank documents; those must not count.
    const first = document.querySelectorAll("iframe")[0];
    fireEvent.load(first);
    expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS);
    Object.defineProperty(first, "contentWindow", {
      configurable: true,
      value: { location: { href: `${STOREFRONT_URL}/store/ws_1/preview/some-token` } },
    });
    fireEvent.load(first);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS + 1));
    expect(document.querySelectorAll("iframe")).toHaveLength(MAX_LOADING_PREVIEWS + 1);
    // Blank-document loads of the new frame don't free another slot either.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS + 1);
  });
});

/** One design in two languages, as the console holds them: «name», and «name عربي» right-to-left and tagged `ar`. */
function design(id: string, name: string, category: string) {
  return [
    fake<WebsiteTemplateSummary>({ id: `${id}_en`, name, category, thumbnailUrl: null, templateVersionId: `v_${id}_en`, rtl: false, tags: ["xs"] }),
    fake<WebsiteTemplateSummary>({
      id: `${id}_ar`,
      name: `${name} عربي`,
      category,
      thumbnailUrl: null,
      templateVersionId: `v_${id}_ar`,
      rtl: true,
      tags: ["xs", "ar"],
    }),
  ];
}

const cardNames = () => screen.getAllByRole("button", { name: /^(Preview|معاينة) / }).map((b) => b.textContent);

// Every test names its templates its own way: the page shows the last list it fetched (kept for the session)
// before the new one arrives.
describe("WebsitePage template languages", () => {
  it("shows one card per design, in the switch's language, and counts what shows", async () => {
    api.listWebsiteTemplates.mockResolvedValue([
      ...design("lang_a", "Lang A", "fashion"),
      ...design("lang_b", "Lang B", "perfume"),
      // A template in one language only, like a funnel: it shows whatever the switch says.
      template("lang_solo", "Lang Solo", "fashion"),
    ]);
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    const languages = await screen.findByRole("radiogroup", { name: "Template language" });
    // The dashboard is in English, so the switch starts there.
    expect(within(languages).getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(cardNames()).toEqual(["Lang A", "Lang B", "Lang Solo"]);
    expect(screen.getByText("3 templates")).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Filter templates by category" });
    const chipText = () => Array.from(chips.querySelectorAll("button")).map((b) => b.textContent);
    expect(chipText()).toEqual(["All3", "Fashion2", "Perfume1"]);

    await user.click(within(languages).getByRole("radio", { name: "عربي" }));
    // The same designs in the same places, now the Arabic templates; the one-language template stays.
    expect(cardNames()).toEqual(["Lang A عربي", "Lang B عربي", "Lang Solo"]);
    expect(screen.getByText("3 templates")).toBeInTheDocument();
    expect(chipText()).toEqual(["All3", "Fashion2", "Perfume1"]);

    // The previews are the Arabic templates'.
    act(() => FakeIntersectionObserver.scrollAllIntoView());
    await waitFor(() => expect(api.getWebsiteTemplate).toHaveBeenCalledWith("lang_a_ar"));
    expect(api.getWebsiteTemplate).not.toHaveBeenCalledWith("lang_a_en");

    // Search and the kinds still narrow what shows.
    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "lang b");
    expect(cardNames()).toEqual(["Lang B عربي"]);
    await user.clear(screen.getByRole("searchbox", { name: "Search templates" }));
    await user.click(within(chips).getByRole("button", { name: /^Fashion/ }));
    expect(cardNames()).toEqual(["Lang A عربي", "Lang Solo"]);
  });

  it("starts in Arabic on a dashboard in Arabic", async () => {
    api.listWebsiteTemplates.mockResolvedValue([...design("lang_c", "Lang C", "fashion"), ...design("lang_d", "Lang D", "fashion")]);
    renderWithProviders(<WebsitePage />, { route: "/website", locale: "ar" });

    const languages = await screen.findByRole("radiogroup", { name: "لغة القالب" });
    expect(within(languages).getByRole("radio", { name: "عربي" })).toHaveAttribute("aria-checked", "true");
    expect(cardNames()).toEqual(["Lang C عربي", "Lang D عربي"]);
  });

  it("uses the template of the language picked", async () => {
    api.listWebsiteTemplates.mockResolvedValue(design("lang_e", "Lang E", "fashion"));
    api.createWebsite.mockResolvedValue(fake({ website: { id: "site_e", name: "Nile Store" }, pages: [] }));
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    await user.click(await screen.findByRole("radio", { name: "عربي" }));
    await user.click(screen.getByRole("button", { name: "Preview Lang E عربي" }));
    await screen.findByText(/Comes with 1 page/);
    expect(api.getWebsiteTemplate).toHaveBeenCalledWith("lang_e_ar");
    await user.click(screen.getByRole("button", { name: "Use this template" }));
    await user.click(await screen.findByRole("button", { name: "Start with this template" }));

    await waitFor(() => expect(api.createWebsite).toHaveBeenCalled());
    expect(api.createWebsite.mock.calls[0][1]).toMatchObject({ templateVersionId: "v_lang_e_ar" });
  });

  it("marks the design the site started from, in either language, and puts it first", async () => {
    const live = fake<Website>({
      id: "site_f",
      name: "Nile Store",
      status: "published",
      subdomain: "site_f.zimos.test",
      publishedRevisionId: "rev_1",
      sourceTemplateVersionId: "v_lang_g_ar",
    });
    api.listWebsites.mockResolvedValue([live]);
    api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: live, pages: [], publishedRevision: null }));
    api.listWebsiteTemplates.mockResolvedValue([...design("lang_f", "Lang F", "fashion"), ...design("lang_g", "Lang G", "fashion")]);
    renderWithProviders(<WebsitePage />, { route: "/website" });

    // The site came from the Arabic template; the switch shows English, and the card is still the store's.
    const card = (await screen.findByRole("button", { name: "Preview Lang G" })).closest("li")!;
    expect(card).toHaveAttribute("data-current");
    expect(cardNames()).toEqual(["Lang G", "Lang F"]);
  });

  it("puts right-to-left templates first for a store in Arabic, which the API spells ar-EG", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", defaultLocale: "ar-EG" });
    api.listWebsiteTemplates.mockResolvedValue([
      fake<WebsiteTemplateSummary>({ id: "dir_ltr", name: "Dir Left", category: "fashion", thumbnailUrl: null, templateVersionId: "v_dir_ltr", rtl: false }),
      fake<WebsiteTemplateSummary>({ id: "dir_rtl", name: "Dir Right", category: "fashion", thumbnailUrl: null, templateVersionId: "v_dir_rtl", rtl: true }),
    ]);
    renderWithProviders(<WebsitePage />, { route: "/website" });

    await screen.findByRole("button", { name: "Preview Dir Right" });
    expect(cardNames()).toEqual(["Dir Right", "Dir Left"]);
    // No design comes in both languages here, so there is nothing to switch.
    expect(screen.queryByRole("radiogroup", { name: "Template language" })).toBeNull();
  });
});

describe("WebsitePage template previews while scrolling", () => {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  /** The box a card's live preview is drawn in (TemplateLivePreview's root), by the card's name. */
  const previewBox = (name: string) => screen.getByRole("button", { name: `Preview ${name}` }).closest("li")!.querySelector<HTMLElement>('[class*="aspect-"] > div')!;
  /** The cards whose preview box is watched for scrolling, by name: a card's observer exists once its effect has run. */
  const watchedCards = () =>
    FakeIntersectionObserver.instances
      .flatMap((observer) => [...observer.elements])
      .map((box) => box.closest("li")?.querySelector("button")?.textContent)
      .sort();

  it("starts only a little before a card scrolls in", async () => {
    api.listWebsiteTemplates.mockResolvedValue([template("perf_margin", "Perf Margin", "general")]);
    renderWithProviders(<WebsitePage />, { route: "/website" });
    await screen.findByRole("button", { name: "Preview Perf Margin" });
    const observer = FakeIntersectionObserver.instances.find((o) => o.elements.has(previewBox("Perf Margin")));
    expect(observer?.options?.rootMargin).toBe("48px 0px");
  });

  it("loads nothing for a card scrolled past before it settles, and loads it once it stays", async () => {
    api.listWebsiteTemplates.mockResolvedValue([template("perf_pass", "Perf Pass", "general")]);
    renderWithProviders(<WebsitePage />, { route: "/website" });
    await screen.findByRole("button", { name: "Preview Perf Pass" });
    const box = previewBox("Perf Pass");

    act(() => FakeIntersectionObserver.report(box, true));
    await wait(100);
    act(() => FakeIntersectionObserver.report(box, false));
    await wait(400);
    expect(api.getWebsiteTemplate).not.toHaveBeenCalled();
    expect(box.querySelector("iframe")).toBeNull();

    act(() => FakeIntersectionObserver.report(box, true));
    await waitFor(() => expect(box.querySelector("iframe")).not.toBeNull());
    expect(api.getWebsiteTemplate).toHaveBeenCalledWith("perf_pass");
  });

  it("loads the cards nearest the middle of the screen first, a couple at a time", async () => {
    api.listWebsiteTemplates.mockResolvedValue([
      template("perf_far", "Perf Far", "general"),
      template("perf_mid", "Perf Mid", "general"),
      template("perf_near", "Perf Near", "general"),
    ]);
    // The queue ranks the cards that wait for a slot together. Each card settles on its own timer,
    // and timers started a millisecond apart fire in different turns of the event loop: the first
    // card would then ask for a slot alone, and take it. So the templates come back together, once
    // all three cards have asked for theirs.
    let templatesBack!: () => void;
    api.getWebsiteTemplate.mockReturnValue(new Promise<WebsiteTemplateDetail>((resolve) => (templatesBack = () => resolve(homeDetail))));
    // Where each card is on a 768px-tall screen: Far well below it, Near in its middle.
    const centres: Record<string, number> = { "Perf Far": 1500, "Perf Mid": 650, "Perf Near": 384 };
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const name = this.closest("li")?.querySelector("button")?.textContent ?? "";
      const centre = centres[name] ?? 0;
      return { top: centre - 100, bottom: centre + 100, left: 0, right: 200, width: 200, height: 200, x: 0, y: centre - 100, toJSON: () => ({}) } as DOMRect;
    });
    renderWithProviders(<WebsitePage />, { route: "/website" });
    // The three cards on the page and watched for scrolling, before they scroll in: a card on
    // the page whose effect has not run yet would not be told.
    await waitFor(() => expect(watchedCards()).toEqual(["Perf Far", "Perf Mid", "Perf Near"]));

    act(() => FakeIntersectionObserver.scrollAllIntoView());
    await waitFor(() => expect(api.getWebsiteTemplate).toHaveBeenCalledTimes(3));
    await act(async () => templatesBack());
    await waitFor(() => expect(document.querySelectorAll("iframe")).toHaveLength(MAX_LOADING_PREVIEWS));
    const loading = Array.from(document.querySelectorAll("iframe")).map((frame) => frame.closest("li")!.querySelector("button")!.textContent);
    expect(loading.sort()).toEqual(["Perf Mid", "Perf Near"]);
    rect.mockRestore();
  });

  it("keeps the template's sketch until its frame has loaded, then fades the frame in", async () => {
    api.listWebsiteTemplates.mockResolvedValue([fake<WebsiteTemplateSummary>({ ...template("perf_fade", "Perf Fade", "general"), primaryColor: "#E53637" })]);
    renderWithProviders(<WebsitePage />, { route: "/website" });
    await screen.findByRole("button", { name: "Preview Perf Fade" });
    const box = previewBox("Perf Fade");
    act(() => FakeIntersectionObserver.report(box, true));
    const frame = await waitFor(() => {
      const found = box.querySelector("iframe");
      expect(found).not.toBeNull();
      return found!;
    });

    // Posted, not yet loaded: the frame is invisible and the sketch, in the template's colour, fills the box.
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(frame).toHaveClass("opacity-0");
    expect(box.querySelector('[style*="--tpl"]')).toHaveAttribute("style", expect.stringContaining("#E53637"));

    Object.defineProperty(frame, "contentWindow", { configurable: true, value: { location: { href: `${STOREFRONT_URL}/store/ws_1/preview/t` } } });
    fireEvent.load(frame);
    await waitFor(() => expect(frame).toHaveClass("opacity-100"), { timeout: 2000 });
    expect(box.querySelector('[style*="--tpl"]')).toBeNull();
  });
});

describe("WebsitePage template card shape", () => {
  const phoneMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = phoneMatchMedia;
  });

  /** A screen at least 1024px wide (Tailwind's `lg`): only that query matches. */
  function onDesktop() {
    window.matchMedia = ((query: string) => ({
      ...phoneMatchMedia(query),
      matches: query === "(min-width: 64rem)",
    })) as typeof window.matchMedia;
  }

  // A name of its own per test: the page shows the last list it fetched (kept
  // for the session) before the new one arrives, and that card is replaced.
  async function renderCard(id: string) {
    api.listWebsiteTemplates.mockResolvedValue([template(id, `Store ${id}`, "general")]);
    renderWithProviders(<WebsitePage />, { route: "/website" });
    const card = (await screen.findByRole("button", { name: `Preview Store ${id}` })).closest("li")!;
    act(() => FakeIntersectionObserver.scrollAllIntoView());
    await waitFor(() => expect(card.querySelector("iframe")).not.toBeNull());
    const frame = card.querySelector("iframe")!;
    return { card, frame, box: frame.closest('[class*="aspect-"]')! };
  }

  it("two columns on a phone, three from 640px, and two landscape ones from 1024px", async () => {
    const { card } = await renderCard("shape_grid");
    const grid = card.closest("ul")!;
    expect(grid).toHaveClass("grid-cols-2", "sm:grid-cols-3", "lg:grid-cols-2");
    expect(grid).not.toHaveClass("lg:grid-cols-4");
    // The picture's box: a portrait, a landscape from `lg`.
    expect(card.querySelector('[class~="aspect-[3/4]"]')).toHaveClass("lg:aspect-[16/10]");
  });

  it("keeps the phone page in a 3:4 box below 1024px", async () => {
    const { frame, box } = await renderCard("shape_phone");
    expect(frame.style.width).toBe("390px");
    expect(frame.style.height).toBe("520px");
    expect(box).toHaveClass("aspect-[3/4]");
  });

  it("shows the desktop page in a 16:10 box from 1024px", async () => {
    onDesktop();
    const { frame, box } = await renderCard("shape_desktop");
    expect(frame.style.width).toBe("1280px");
    expect(frame.style.height).toBe("800px");
    expect(box).toHaveClass("aspect-[16/10]");
    expect(box).not.toHaveClass("aspect-[3/4]");
  });
});

describe("WebsitePage template colour", () => {
  /** Opens the one template, lets its detail load, and creates the site from it. */
  async function createFromTemplate() {
    api.listWebsiteTemplates.mockResolvedValue([template("t_1", "Oud House", "perfume")]);
    api.getWebsiteTemplate.mockResolvedValue(fake<WebsiteTemplateDetail>({ ...homeDetail, globalStyles: { primaryColor: "#7C2D12" } }));
    api.createWebsite.mockResolvedValue(fake({ website: { id: "site_1", name: "Nile Store" }, pages: [] }));
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    // The card opens the template's sheet; "use" asks once, saying what will happen, and then creates.
    await user.click(await screen.findByRole("button", { name: "Preview Oud House" }));
    await screen.findByText(/Comes with 1 page/);
    await user.click(screen.getByRole("button", { name: "Use this template" }));
    await user.click(await screen.findByRole("button", { name: "Start with this template" }));
    await waitFor(() => expect(currentPath()).toMatch(/^\/website\/site_1\/edit/));
  }

  it("copies the template's colour, marked as the template's, onto a store with no look of its own", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
    // Another key saved from another tab after this one loaded: it must survive.
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: { productCountdownHours: 6 } })]);
    const saved = fake<Workspace>({
      id: "ws_1",
      themeSettings: { productCountdownHours: 6, primaryColor: "#7C2D12", primaryColorSource: "template" },
    });
    api.updateWorkspace.mockResolvedValue(saved);

    await createFromTemplate();

    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      themeSettings: { productCountdownHours: 6, primaryColor: "#7C2D12", primaryColorSource: "template" },
    });
    expect(workspaceMock.applySavedWorkspace).toHaveBeenCalledWith(saved);
  });

  it("leaves a store on a theme with the theme's own accent", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: { storeTheme: "warm" } });

    await createFromTemplate();

    expect(api.listWorkspaces).not.toHaveBeenCalled();
    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });

  it("leaves a theme picked in another tab alone", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: { storeTheme: "elegant" } })]);

    await createFromTemplate();

    expect(api.listWorkspaces).toHaveBeenCalledTimes(1);
    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });

  it("leaves a colour the store picked in another tab alone", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: { primaryColor: "#BE123C" } })]);

    await createFromTemplate();

    expect(api.listWorkspaces).toHaveBeenCalledTimes(1);
    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });

  it("still opens the new site when the store's latest settings can't be loaded", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
    api.listWorkspaces.mockRejectedValue(new TypeError("Failed to fetch"));

    await createFromTemplate();

    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });
});
