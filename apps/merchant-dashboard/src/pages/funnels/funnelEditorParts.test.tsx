import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { UiFunnel, UiStep, UiStepType } from "./funnelAdapter";
import { stepPageTree } from "./funnelPages";
import { StepDetailsForm } from "./StepDetailsForm";
import { StepInspector } from "./editor/StepInspector";

/**
 * Two parts of the funnel editor whose rules come from this API: a step's
 * address is taken once, when the step is created, and only a checkout step
 * carries an add-on offer.
 */

const pathOf = (key: string) => `/f/headphones/${key}`;

function details(props: Partial<Parameters<typeof StepDetailsForm>[0]> = {}, locale: "en" | "ar" = "en") {
  const onApply = vi.fn();
  const view = renderWithProviders(
    <StepDetailsForm name="Contact" stepKey="contact" type="custom" generic taken={["about"]} pathOf={pathOf} onApply={onApply} {...props} />,
    { locale }
  );
  return { ...view, onApply };
}

describe("a step's details", () => {
  it("lets a page that is not saved yet take another address, tidied as it is typed", async () => {
    const { user, onApply } = details();
    const address = screen.getByLabelText("Address");
    expect(address).not.toHaveAttribute("readonly");

    await user.clear(address);
    await user.type(address, "Contact Us");
    expect(address).toHaveValue("contact-us");
    expect(screen.getByText("/f/headphones/contact-us")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ name: "Contact", key: "contact-us" });
  });

  it("refuses an address another page of the funnel already has", async () => {
    const { user, onApply } = details();
    const address = screen.getByLabelText("Address");
    await user.clear(address);
    await user.type(address, "about");

    expect(screen.getByText("Another page of this funnel already uses this address.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("keeps the address of a page that is saved or on the map, and still renames it", async () => {
    const { user, onApply } = details({ generic: false });
    const address = screen.getByLabelText("Address");
    expect(address).toHaveAttribute("readonly");
    expect(screen.getByText(/This page keeps its address/)).toBeInTheDocument();

    const title = screen.getByLabelText("Page title");
    await user.clear(title);
    await user.type(title, "Talk to us");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ name: "Talk to us", key: "contact" });
  });

  it("reads in the dashboard's own Arabic", () => {
    details({ generic: false }, "ar");
    expect(screen.getByLabelText("العنوان")).toHaveAttribute("readonly");
    expect(screen.getByText(/هذه الصفحة تحتفظ بعنوانها/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تطبيق" })).toBeDisabled();
  });
});

function uiStep(key: string, type: UiStepType, name: string): UiStep {
  return { id: `step_${key}`, key, name, type, offerId: null, bumpOfferId: null, experimentId: null, seo: {}, tree: stepPageTree(type, "en"), x: 40, y: 64 };
}

function inspect(step: UiStep) {
  const funnel: UiFunnel = {
    id: "f1",
    name: "Headphones COD",
    subdomain: "headphones",
    status: "draft",
    publishedRevisionId: null,
    publishedRevisionNumber: null,
    steps: [step],
    edges: [],
    createdAt: "",
    updatedAt: "",
  };
  return renderWithProviders(
    <StepInspector
      funnel={funnel}
      step={step}
      problems={[]}
      catalog={[]}
      catalogLoading={false}
      catalogError={null}
      onChange={vi.fn()}
      onEdgesChange={vi.fn()}
      onEditPage={vi.fn()}
      onAddNext={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
      runningTest={null}
    />
  );
}

describe("the step inspector", () => {
  it("offers the add-on offer on a checkout step", () => {
    inspect(uiStep("checkout", "checkout", "COD checkout"));
    expect(screen.getByRole("heading", { name: "Checkout add-on offer" })).toBeInTheDocument();
  });

  it("offers no add-on on a sales page: this API keeps it on checkout steps only", () => {
    inspect(uiStep("sales", "sales", "Sales page"));
    expect(screen.getByRole("heading", { name: "After this step" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Checkout add-on offer" })).not.toBeInTheDocument();
  });
});
