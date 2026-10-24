import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import type { PageSection, PageTree } from "@store-builder/api-client";
import type { StorefrontPreview } from "@/components/StorefrontPreview";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BLOCK_PRESETS, createSection, sectionElements, sectionLabel } from "../website/editor/blocks";
import type { UiStep } from "./funnelAdapter";
import { FunnelStepPageEditor } from "./FunnelStepPageEditor";

type PreviewProps = Parameters<typeof StorefrontPreview>[0];

// The preview is the real storefront in a frame: nothing for jsdom to draw. Its props are kept, so a test
// can see what the editor selected and press on the page the way the frame does.
const preview = vi.hoisted(() => ({ props: null as unknown as PreviewProps }));
vi.mock("@/components/StorefrontPreview", async (original) => ({
  ...(await original<typeof import("@/components/StorefrontPreview")>()),
  StorefrontPreview: (props: PreviewProps) => {
    preview.props = props;
    return null;
  },
}));

/** A funnel step's page: a section holding one element opens it, and Delete still asks to delete the section. */

const onePreset = BLOCK_PRESETS.find((preset) => sectionElements(createSection(preset, "en")).length === 1);
if (!onePreset) throw new Error("no block preset holds a single element");
const band: PageSection = { ...createSection(onePreset, "en"), id: "s_band" };
const bandElement = sectionElements(band)[0].id;
const other: PageSection = { ...createSection(BLOCK_PRESETS[0], "en"), id: "s_other" };

/** The funnel editor around a step's page: it keeps the tree each edit hands back. */
function Harness({ onTree }: { onTree: (tree: PageTree) => void }) {
  const [tree, setTree] = useState<PageTree>({ version: 1, sections: [band, other] });
  const step: UiStep = { id: "step_1", key: "landing", name: "Landing", type: "landing", offerId: null, bumpOfferId: null, experimentId: null, seo: {}, tree, x: 0, y: 0 };
  return (
    <FunnelStepPageEditor
      workspaceId="ws_1"
      steps={[step]}
      step={step}
      offerProduct={null}
      onSelectStep={() => undefined}
      onTreeChange={(next) => {
        setTree(next);
        onTree(next);
      }}
      onBack={() => undefined}
    />
  );
}

function renderStep() {
  const onTree = vi.fn<(tree: PageTree) => void>();
  return { ...renderWithProviders(<Harness onTree={onTree} />), onTree };
}

async function pickBandFromList(user: ReturnType<typeof renderStep>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Sections" }));
  const list = await screen.findByRole("dialog");
  await user.click(within(list).getByRole("button", { name: new RegExp(`^${sectionLabel(band, "en")}`) }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

describe("a funnel step's section holding one element", () => {
  it("opens that element, and Delete asks to delete the whole section", async () => {
    const { user, onTree } = renderStep();
    await pickBandFromList(user);
    expect(preview.props.selectedElementId).toBe(bandElement);
    await user.keyboard("{Delete}");
    const confirm = await screen.findByRole("dialog", { name: "Delete this section?" });
    await user.click(within(confirm).getByRole("button", { name: "Delete section" }));
    await waitFor(() => expect(onTree).toHaveBeenCalled());
    expect(onTree.mock.lastCall?.[0].sections.map((s) => s.id)).toEqual(["s_other"]);
  });

  it("leaves the section alone on Delete once its element is picked on the page", async () => {
    const { user, onTree } = renderStep();
    await screen.findByRole("button", { name: "Sections" });
    act(() => preview.props.onSelectElement?.({ sectionId: "s_band", elementId: bandElement, elementType: "" }));
    await user.keyboard("{Delete}");
    expect(screen.queryByText("Delete this section?")).toBeNull();
    expect(onTree).not.toHaveBeenCalled();
  });
});
