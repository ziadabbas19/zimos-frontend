import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EMAIL_CAMPAIGNS_ENABLED } from "@/lib/features";
import checkout from "../../app/store/[workspaceId]/checkout/page.tsx?raw";
import { MarketingConsentField } from "./MarketingConsentField";

// "Email me offers" at checkout (NEXT_PUBLIC_EMAIL_CAMPAIGNS_ENABLED): unticked
// unless the merchant set it to start ticked, a large target, said in the
// store's language (or the merchant's words), and sent only when the switch is
// on, the box ticked and an email typed.

afterEach(() => cleanup());

describe("the consent box", () => {
  it("starts unticked and says what ticking it means", () => {
    const onChange = vi.fn();
    render(<MarketingConsentField checked={false} onChange={onChange} storeName="Nour" locale="en" />);
    const box = screen.getByRole("checkbox", { name: "Email me offers and news from Nour" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(document.getElementById(box.getAttribute("aria-describedby") ?? "")?.textContent).toBe("You can unsubscribe from any email, in one click.");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("speaks Arabic in an Arabic store", () => {
    render(<MarketingConsentField checked onChange={() => undefined} storeName="نور" locale="ar" />);
    expect((screen.getByRole("checkbox", { name: "ابعتلي العروض والأخبار من نور على الإيميل" }) as HTMLInputElement).checked).toBe(true);
  });

  it("is only in the checkout behind the switch, and sends consent only when ticked with an email", () => {
    expect(EMAIL_CAMPAIGNS_ENABLED).toBe(false);
    expect(checkout).toContain('const consentBoxShown = Boolean(signup?.checkout) && formOf(fields, { showAltPhone: true }).some((f) => f.key === "email");');
    expect(checkout).toContain("{EMAIL_CAMPAIGNS_ENABLED && consentBoxShown && (");
    expect(checkout).toContain("...(EMAIL_CAMPAIGNS_ENABLED && consentTicked && values.email.trim()");
    // Unticked unless the merchant set this place to start ticked (lib/emailSignup).
    expect(checkout).toContain("const marketingOptIn = ownConsent ?? carriedConsent ?? signup?.checkout?.preTicked === true;");
  });

  it("says the merchant's own words when they wrote some, with the incentive beside the label", () => {
    render(
      <MarketingConsentField checked={false} onChange={() => undefined} storeName="Nour" locale="en" label="Join our list" privacy="We never share it." incentive="10% off" />
    );
    const box = screen.getByRole("checkbox", { name: "Join our list 10% off" }) as HTMLInputElement;
    expect(document.getElementById(box.getAttribute("aria-describedby") ?? "")?.textContent).toBe("We never share it.");
  });
});
