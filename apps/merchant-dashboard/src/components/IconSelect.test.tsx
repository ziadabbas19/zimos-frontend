import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { Field } from "./Field";
import { IconSelect, type IconSelectOption } from "./IconSelect";
import { Modal } from "./Modal";

type Platform = "meta" | "tiktok" | "snapchat" | "google" | "gtm" | "clarity";

const OPTIONS: IconSelectOption<Platform>[] = [
  { value: "meta", label: "Meta" },
  { value: "tiktok", label: "TikTok" },
  { value: "snapchat", label: "Snapchat" },
  { value: "google", label: "Google" },
  { value: "gtm", label: "Google Tag Manager" },
  { value: "clarity", label: "Microsoft Clarity" },
].map((option) => ({ ...option, icon: <span data-icon={option.value} /> })) as IconSelectOption<Platform>[];

function Harness({ onChange, disabled = false }: { onChange: (value: Platform) => void; disabled?: boolean }) {
  const [value, setValue] = useState<Platform>("meta");
  return (
    <>
      <Field label="Platform">
        {({ id }) => (
          <IconSelect
            id={id}
            label="Platform"
            value={value}
            options={OPTIONS}
            disabled={disabled}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
          />
        )}
      </Field>
      <button type="button">After</button>
    </>
  );
}

function setup(props: { disabled?: boolean; locale?: "en" | "ar" } = {}) {
  const onChange = vi.fn();
  const view = renderWithProviders(<Harness onChange={onChange} disabled={props.disabled} />, { locale: props.locale });
  const field = screen.getByRole("combobox", { name: "Platform" });
  return { ...view, onChange, field };
}

const list = () => screen.queryByRole("listbox", { name: "Platform" });
/** The option the keys are on: the one the button points at. */
const highlighted = (field: HTMLElement) => {
  const id = field.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("IconSelect", () => {
  it("is a labelled combobox that shows the chosen option with its icon", () => {
    const { field } = setup();

    expect(field).toHaveAttribute("aria-haspopup", "listbox");
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(field).toHaveTextContent("Meta");
    expect(field.querySelector('[data-icon="meta"]')).not.toBeNull();
    expect(list()).not.toBeInTheDocument();
  });

  it("opens on a click on the chosen option, and closes on a second click, a press outside or Escape", async () => {
    const { user, field, onChange } = setup();

    await user.click(field);
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(field).toHaveAttribute("aria-controls", list()?.id);
    expect(screen.getAllByRole("option")).toHaveLength(OPTIONS.length);
    expect(screen.getByRole("option", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
    expect(highlighted(field)).toHaveTextContent("Meta");
    // Every option carries its icon.
    for (const option of OPTIONS) expect(document.querySelector(`[role="option"] [data-icon="${option.value}"]`)).not.toBeNull();

    await user.click(field);
    expect(list()).not.toBeInTheDocument();
    expect(field).toHaveAttribute("aria-expanded", "false");

    await user.click(field);
    await user.click(screen.getByRole("button", { name: "Close the list" }));
    expect(list()).not.toBeInTheDocument();
    expect(field).toHaveFocus();

    await user.click(field);
    await user.keyboard("{Escape}");
    expect(list()).not.toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chooses an option with a click and gives the focus back to the field", async () => {
    const { user, field, onChange } = setup();

    await user.click(field);
    await user.click(screen.getByRole("option", { name: "Snapchat" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("snapchat");
    expect(list()).not.toBeInTheDocument();
    expect(field).toHaveTextContent("Snapchat");
    expect(field.querySelector('[data-icon="snapchat"]')).not.toBeNull();
    expect(field).toHaveFocus();
  });

  it("moves with the arrows, Home and End, and chooses with Enter", async () => {
    const { user, field, onChange } = setup();

    await user.tab();
    expect(field).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(list()).toBeInTheDocument();
    // Opening does not move off the chosen option.
    expect(highlighted(field)).toHaveTextContent("Meta");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(highlighted(field)).toHaveTextContent("Snapchat");
    expect(highlighted(field)).toHaveAttribute("data-active");
    await user.keyboard("{End}");
    expect(highlighted(field)).toHaveTextContent("Microsoft Clarity");
    await user.keyboard("{ArrowDown}");
    expect(highlighted(field)).toHaveTextContent("Microsoft Clarity");
    await user.keyboard("{Home}{ArrowUp}");
    expect(highlighted(field)).toHaveTextContent("Meta");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("tiktok");
    expect(list()).not.toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  it("opens with Space or Enter, and Space chooses too", async () => {
    const { user, field, onChange } = setup();

    field.focus();
    await user.keyboard(" ");
    expect(list()).toBeInTheDocument();
    await user.keyboard("{ArrowDown} ");
    expect(onChange).toHaveBeenLastCalledWith("tiktok");
    expect(list()).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(list()).toBeInTheDocument();
    expect(highlighted(field)).toHaveTextContent("TikTok");
    await user.keyboard("{Escape}");
    expect(list()).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("jumps to the option a typed letter starts, and to the next one on the same letter again", async () => {
    const { user, field, onChange } = setup();

    field.focus();
    await user.keyboard("g");
    expect(list()).toBeInTheDocument();
    expect(highlighted(field)).toHaveTextContent("Google");
    await user.keyboard("g");
    expect(highlighted(field)).toHaveTextContent("Google Tag Manager");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("gtm");
  });

  it("chooses the highlighted option on Tab and lets the focus move on", async () => {
    const { user, field, onChange } = setup();

    await user.click(field);
    await user.keyboard("{ArrowDown}");
    await user.tab();

    expect(onChange).toHaveBeenCalledExactlyOnceWith("tiktok");
    expect(list()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("does not open while disabled", async () => {
    const { user, field } = setup({ disabled: true });

    expect(field).toBeDisabled();
    await user.click(field);
    expect(list()).not.toBeInTheDocument();
  });

  it("closes only itself on Escape inside a dialog", async () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Modal open onClose={onClose} title="Add a pixel">
        <Harness onChange={onChange} />
      </Modal>
    );

    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    expect(list()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(list()).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // A press inside the list is not a press outside the dialog.
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "Google" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("google");
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("speaks Arabic", async () => {
    const { user, field } = setup({ locale: "ar" });

    await user.click(field);
    expect(screen.getByRole("button", { name: "إغلاق القائمة" })).toBeInTheDocument();
  });
});
