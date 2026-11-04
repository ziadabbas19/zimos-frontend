import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider } from "@/i18n/LocaleContext";
import type { HistoryEntry, PlatformSettingsState, SettingsValues } from "@/lib/platformSettingsApi";
import * as api from "@/lib/platformSettingsApi";
import { PlatformSettingsPage } from "./PlatformSettingsPage";

/**
 * The console's Platform settings page (pages/PlatformSettingsPage.tsx) with
 * the API mocked: its tabs, the checks before saving, the confirmation, the
 * defaults, the history, read-only access and Arabic.
 */

const auth = vi.hoisted(() => ({ held: ["platform_settings.view", "platform_settings.manage", "payments.record"] as string[] }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ can: (key: string | readonly string[]) => (typeof key === "string" ? [key] : key).some((k) => auth.held.includes(k)) }),
}));

vi.mock("@/lib/platformSettingsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platformSettingsApi")>();
  return { ...actual, getState: vi.fn(), saveGroup: vi.fn(), resetGroup: vi.fn(), getHistory: vi.fn(), revertChange: vi.fn() };
});

const DEFAULTS: SettingsValues = {
  contact: {
    supportEmail: "zimossupport@gmail.com",
    phone: "01023641956",
    address: { ar: "طنطا، محافظة الغربية، مصر", en: "Tanta, Gharbia, Egypt" },
    hours: { ar: "24/7", en: "24/7" },
  },
  social: {
    links: [
      { platform: "instagram", url: "https://instagram.com/zimos.co", enabled: true },
      { platform: "facebook", url: "https://facebook.com/zimos.co", enabled: true },
      { platform: "tiktok", url: "https://www.tiktok.com/@zimos.co", enabled: true },
      { platform: "whatsapp", url: "https://wa.me/201501921444", enabled: true },
      { platform: "x", url: "https://x.com/ZimosCo", enabled: true },
      { platform: "email", url: "mailto:zimossupport@gmail.com", enabled: true },
    ],
  },
  company: {
    platformName: "ZIMOS",
    legalName: { ar: "ZIMOS", en: "ZIMOS" },
    registration: { ar: "قيد الإصدار", en: "Being issued" },
    taxRegistration: "783-889-615",
  },
  footer: {
    tagline: { ar: "تجارة لغدٍ أكثر إشراقًا.", en: "Commerce for a brighter tomorrow." },
    rights: { ar: "جميع الحقوق محفوظة.", en: "All rights reserved." },
  },
  email: { senderName: "Zimos", signature: { ar: "", en: "" }, footer: { showSupportEmail: false, showSocialLinks: false } },
};

const ADMIN = { id: "u1", name: "Ziad", email: "ziad@zimos.test" };

function state(overrides: Partial<PlatformSettingsState> = {}): PlatformSettingsState {
  const fromDefault = <G extends keyof SettingsValues>(g: G) => ({ value: DEFAULTS[g], source: "default" as const, updatedAt: null, updatedBy: null });
  return {
    enabled: true,
    groups: { contact: fromDefault("contact"), social: fromDefault("social"), company: fromDefault("company"), footer: fromDefault("footer"), email: fromDefault("email") },
    defaults: DEFAULTS,
    rules: {
      socialPlatforms: ["instagram", "facebook", "tiktok", "youtube", "x", "linkedin", "whatsapp", "email"],
      socialDomains: {
        instagram: ["instagram.com"],
        facebook: ["facebook.com", "fb.com"],
        tiktok: ["tiktok.com"],
        youtube: ["youtube.com", "youtu.be"],
        x: ["x.com", "twitter.com"],
        linkedin: ["linkedin.com"],
        whatsapp: ["wa.me"],
      },
      limits: { email: 254, url: 500, address: 200, hours: 80, platformName: 60, legalName: 120, registration: 80, taxRegistration: 40, tagline: 160, rights: 120, senderName: 70, signature: 500 },
    },
    ...overrides,
  };
}

const mocked = vi.mocked(api);

function renderPage(tab?: string) {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/platform-settings${tab ? `?tab=${tab}` : ""}`]}>
          <PlatformSettingsPage />
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}

// Not exact: a required field's label ends with " *".
const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  auth.held = ["platform_settings.view", "platform_settings.manage", "payments.record"];
  vi.clearAllMocks();
  mocked.getState.mockResolvedValue(state());
  mocked.getHistory.mockResolvedValue({ group: "contact", entries: [] });
});

describe("the page and its tabs", () => {
  it("opens on Contact with the values the sites show today, and offers every group", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Platform settings" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Contact", "Social links", "Company", "Footer", "Emails", "Payment account"]);
    expect(field("Support email").value).toBe("zimossupport@gmail.com");
    expect(field("Address — Arabic").value).toBe("طنطا، محافظة الغربية، مصر");
    expect(field("Address — Arabic").getAttribute("dir")).toBe("rtl");
    expect(screen.getByText(/Never saved/)).toBeTruthy();
  });

  it("says the sites ignore the values while the flag is off", async () => {
    mocked.getState.mockResolvedValue(state({ enabled: false }));
    renderPage();
    expect(await screen.findByText(/PLATFORM_SETTINGS_ENABLED is off/)).toBeTruthy();
  });

  it("lists every platform on the social tab, the ones not saved off, with a preview of the icons", async () => {
    renderPage("social");
    await screen.findByLabelText("Instagram link");
    const order = screen.getAllByLabelText(/ link$/).map((input) => input.getAttribute("aria-label") ?? input.id);
    expect(order).toHaveLength(8);
    expect(field("YouTube link").value).toBe("");
    expect(screen.getByRole("switch", { name: "Show YouTube" }).getAttribute("aria-checked")).toBe("false");
    const preview = screen.getByRole("list", { name: "ZIMOS accounts" });
    expect(within(preview).getAllByRole("link")).toHaveLength(6);
  });

  it("points the payment account tab at the Payment methods page instead of repeating it", async () => {
    renderPage("payment");
    const link = await screen.findByRole("link", { name: "Open Payment methods" });
    expect(link.getAttribute("href")).toBe("/payment-methods");
  });
});

describe("checks before saving", () => {
  it("marks javascript:, a domain off the list and a bad WhatsApp number on their field, and saves nothing", async () => {
    renderPage("social");
    await screen.findByLabelText("Instagram link");
    type("Instagram link", "javascript:alert(1)");
    expect(screen.getByText(/Must start with https:\/\//)).toBeTruthy();
    type("Instagram link", "https://instagram.com.evil.example/x");
    expect(screen.getByText("Must be on instagram.com.")).toBeTruthy();
    type("WhatsApp link", "https://wa.me/+201501921444");
    expect(screen.getByText(/the number with its country code/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Fix the fields marked in red first.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocked.saveGroup).not.toHaveBeenCalled();
  });

  it("refuses an empty required text, HTML and a wrong email", async () => {
    renderPage();
    await screen.findByLabelText("Support email", { exact: false });
    type("Support email", "not-an-email");
    type("Working hours — English", "");
    type("Address — English", "<b>Cairo</b>");
    expect(screen.getByText("Enter one email address, e.g. support@zimos.co.")).toBeTruthy();
    expect(screen.getByText("Required.")).toBeTruthy();
    expect(screen.getByText("Plain text only: no HTML tags.")).toBeTruthy();
  });

  it("asks for a link when one is turned on with none", async () => {
    renderPage("social");
    await screen.findByLabelText("LinkedIn link");
    fireEvent.click(screen.getByRole("switch", { name: "Show LinkedIn" }));
    expect(screen.getByText("A link that is shown needs a URL.")).toBeTruthy();
  });
});

describe("saving", () => {
  it("confirms first, naming what changed, then sends the whole group", async () => {
    mocked.saveGroup.mockImplementation(async (group, value) => ({ group, changed: true, value, source: "saved", updatedAt: "2026-10-22T10:00:00Z", updatedBy: ADMIN }) as never);
    renderPage();
    await screen.findByLabelText("Working hours — English");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    type("Working hours — English", "9 to 5");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(within(dialog()).getByText(/Changed: Working hours/)).toBeTruthy();
    expect(mocked.saveGroup).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocked.saveGroup).toHaveBeenCalledWith("contact", { ...DEFAULTS.contact, hours: { ar: "24/7", en: "9 to 5" } }));
    expect(await screen.findByText("Saved. The change is in the history and the audit log.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Last saved .* by Ziad/)).toBeTruthy();
  });

  it("sends the links in the order set with the arrows", async () => {
    mocked.saveGroup.mockImplementation(async (group, value) => ({ group, changed: true, value, source: "saved", updatedAt: null, updatedBy: null }) as never);
    renderPage("social");
    await screen.findByLabelText("Instagram link");
    fireEvent.click(screen.getByRole("button", { name: "Move Instagram down" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocked.saveGroup).toHaveBeenCalled());
    const sent = mocked.saveGroup.mock.calls[0][1] as SettingsValues["social"];
    expect(sent.links.slice(0, 2).map((l) => l.platform)).toEqual(["facebook", "instagram"]);
    expect(sent.links).toHaveLength(8);
  });

  it("shows the API's field messages in the dialog when it refuses", async () => {
    mocked.saveGroup.mockRejectedValue(
      new ApiError("Platform settings never hold a secret, a key or a password", 422, "SECRET_NOT_ALLOWED", [{ field: "hours.en", message: "looks like a secret" }])
    );
    renderPage();
    await screen.findByLabelText("Working hours — English");
    type("Working hours — English", "changed");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(await within(dialog()).findByText(/hours\.en: looks like a secret/)).toBeTruthy();
  });

  it("puts a saved group back to the defaults after a confirmation", async () => {
    const saved = state();
    saved.groups.footer = { value: { ...DEFAULTS.footer, rights: { ar: "محفوظة", en: "Reserved" } }, source: "saved", updatedAt: "2026-10-22T10:00:00Z", updatedBy: ADMIN };
    mocked.getState.mockResolvedValue(saved);
    mocked.resetGroup.mockResolvedValue({ group: "footer", changed: true, value: DEFAULTS.footer, source: "default", updatedAt: null, updatedBy: null } as never);
    renderPage("footer");
    fireEvent.click(await screen.findByRole("button", { name: "Back to defaults" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Back to defaults" }));
    await waitFor(() => expect(mocked.resetGroup).toHaveBeenCalledWith("footer"));
    expect(await screen.findByText("Back to the defaults.")).toBeTruthy();
    expect(field("Rights line — English").value).toBe("All rights reserved.");
  });
});

describe("the history", () => {
  const entry: HistoryEntry = {
    id: "a1",
    action: "update",
    at: "2026-10-22T09:00:00Z",
    actor: ADMIN,
    before: { ...DEFAULTS.contact, hours: { ar: "٩-٥", en: "9-5" } },
    after: DEFAULTS.contact,
    fields: ["hours"],
  };

  it("lists the changes and puts back the value before one", async () => {
    mocked.getHistory.mockResolvedValue({ group: "contact", entries: [entry] });
    mocked.revertChange.mockResolvedValue({ group: "contact", changed: true, value: entry.before, source: "saved", updatedAt: null, updatedBy: ADMIN } as never);
    renderPage();
    expect(await screen.findByText(/Changed: Working hours/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Put back the value before this/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Put back the value before this/ }));
    await waitFor(() => expect(mocked.revertChange).toHaveBeenCalledWith("contact", "a1"));
    expect(await screen.findByText("The earlier value is back.")).toBeTruthy();
    await waitFor(() => expect(field("Working hours — English").value).toBe("9-5"));
  });
});

describe("who can change it", () => {
  it("shows the values read-only without the edit permission", async () => {
    auth.held = ["platform_settings.view"];
    mocked.getHistory.mockResolvedValue({
      group: "contact",
      entries: [{ id: "a1", action: "update", at: "2026-10-22T09:00:00Z", actor: null, before: null, after: DEFAULTS.contact, fields: [] }],
    });
    renderPage();
    expect(await screen.findByText(/You can look but not change/)).toBeTruthy();
    expect(field("Support email").closest("fieldset")?.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Put back/ })).toBeNull();
  });
});

describe("Arabic", () => {
  it("draws the page in Arabic, right to left", async () => {
    localStorage.setItem("zimos.console.locale", "ar");
    renderPage();
    expect(await screen.findByRole("heading", { name: "إعدادات المنصة" })).toBeTruthy();
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["التواصل", "روابط التواصل الاجتماعي", "الشركة", "تذييل الموقع", "الرسائل", "حساب الدفع"]);
    expect(field("بريد الدعم").value).toBe("zimossupport@gmail.com");
  });
});
