import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function Page({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        title="Dialog"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<button>Last</button>}
      >
        <button>First</button>
      </Modal>
    </>
  );
}

describe("a dialog and the keyboard", () => {
  it("takes focus when it opens and gives it back when it closes", () => {
    render(<Page />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("keeps Tab inside, in both directions", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("skips a disabled button when going round", () => {
    render(
      <Modal open title="Dialog" onClose={() => {}} footer={<button tabIndex={0} disabled>Save</button>}>
        <button>First</button>
        <button>Second</button>
      </Modal>
    );
    const second = screen.getByRole("button", { name: "Second" });
    second.focus();
    fireEvent.keyDown(second, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  });

  it("gives focus back to a menu's button when it was opened from that menu", () => {
    function FromMenu() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button aria-haspopup="menu" aria-expanded={!open}>Actions</button>
          {!open && (
            <div role="menu">
              <button role="menuitem" onClick={() => setOpen(true)}>Details</button>
            </div>
          )}
          <Modal open={open} title="Dialog" onClose={() => setOpen(false)}>
            <button>First</button>
          </Modal>
        </>
      );
    }
    render(<FromMenu />);
    const item = screen.getByRole("menuitem", { name: "Details" });
    item.focus();
    fireEvent.click(item);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
