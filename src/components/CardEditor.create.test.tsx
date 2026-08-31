import { Children, isValidElement, type FormEvent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardEditor } from "./Editors";
import { TooltipProvider } from "./ui/Tooltip";
import { createSeed } from "../seed";

const form = vi.hoisted(() => ({ submit: undefined as undefined | ((event: FormEvent) => Promise<void>) }));
vi.mock("../data", () => ({ demoMode: true, supabase: null }));
// Capture the rendered form's real submit handler without running a browser.
vi.mock("./ui/Dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => {
    const visit = (nodes: ReactNode) => Children.forEach(nodes, (node) => {
      if (!isValidElement<{ children?: ReactNode; onSubmit?: typeof form.submit }>(node)) return;
      if (node.type === "form") form.submit = node.props.onSubmit;
      else visit(node.props.children);
    });
    visit(children);
    return children;
  },
}));

beforeEach(() => { form.submit = undefined; });

function setup(mutate: () => Promise<boolean>, existing = false) {
  const state = createSeed();
  const close = vi.fn();
  renderToStaticMarkup(<TooltipProvider><CardEditor
    state={state} current={state.profiles[0]} workspaceId="salescrew"
    card={existing ? state.cards[0] : undefined}
    busy={false} mutate={mutate} close={close} editLabels={() => {}}
  /></TooltipProvider>);
  expect(form.submit).toBeTypeOf("function");
  const event = { preventDefault: vi.fn() } as unknown as FormEvent;
  return { close, submit: () => form.submit!(event), event };
}

describe("New card submission closes the creation dialog", () => {
  it("waits for creation to succeed, then closes exactly once", async () => {
    let finish!: (ok: boolean) => void;
    const mutate = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const { close, submit, event } = setup(mutate);
    const pending = submit();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ type: "card.create" }));
    expect(close).not.toHaveBeenCalled();
    finish(true);
    await pending;
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the form open if creation fails", async () => {
    const { close, submit } = setup(vi.fn(async () => false));
    await submit();
    expect(close).not.toHaveBeenCalled();
  });

  it("does not change existing-card edit behavior", async () => {
    const mutate = vi.fn(async () => true);
    const { close, submit } = setup(mutate, true);
    await submit();
    expect(mutate).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
