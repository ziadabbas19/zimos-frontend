import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EditorLocaleContext } from "./editorLocale";
import { FooterLayoutBlock } from "./ShellLayoutBlocks";

/**
 * The bottom line of an imported template's footer (Footer panel): its parts move and go, except ZIMOS's line,
 * which the plan hides (Store settings → General), not the arrangement — the store draws it back anyway.
 */

function renderBlock(bottom: unknown = null) {
  const onChange = vi.fn();
  renderWithProviders(
    <EditorLocaleContext.Provider value="en">
      <FooterLayoutBlock columns={null} bottom={bottom} groups={[]} showBrand onChange={onChange} />
    </EditorLocaleContext.Provider>,
    { workspace: { currentWorkspace: { ...testWorkspace, themeSettings: { xsLook: "05" } } } }
  );
  return onChange;
}

describe("the footer's bottom line", () => {
  it("offers no way to remove ZIMOS's line, and says where it is hidden", () => {
    renderBlock();
    expect(screen.getByText("Powered by Zimos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove: Powered by Zimos" })).toBeNull();
    expect(screen.getByText(/Hide ZIMOS branding/)).toBeTruthy();
  });

  it("still removes the other parts", async () => {
    const onChange = renderBlock([
      { id: "rights", type: "rights" },
      { id: "powered", type: "powered" },
      { id: "text-ab12cd", type: "text", label: "Open daily" },
    ]);
    screen.getByRole("button", { name: "Remove: Rights line" }).click();
    expect(onChange).toHaveBeenLastCalledWith({ bottom: [{ id: "powered", type: "powered" }, { id: "text-ab12cd", type: "text", label: "Open daily" }] }, undefined);
    expect(screen.getByRole("button", { name: "Remove: Words" })).toBeTruthy();
  });
});
