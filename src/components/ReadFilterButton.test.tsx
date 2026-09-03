import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReadFilter } from "../read-filter";
import { ReadFilterButton } from "./ReadFilterButton";
import { TooltipProvider } from "./ui/Tooltip";

function render(value: ReadFilter) {
  return renderToStaticMarkup(
    <TooltipProvider>
      <ReadFilterButton value={value} onValueChange={vi.fn()} />
    </TooltipProvider>,
  );
}

describe("ReadFilterButton", () => {
  it.each([
    ["", "all", "Gelesen und ungelesen", "read-filter-combined-icon"],
    ["unread", "unread", "Nur ungelesene Karten", "lucide-check-check"],
    ["read", "read", "Nur gelesene Karten", "lucide-check-check"],
  ] as const)("renders the %s state accessibly", (value, state, label, icon) => {
    const html = render(value);
    expect(html).toContain(`data-filter-state="${state}"`);
    expect(html).toContain(`aria-label="${label}.`);
    expect(html).toContain(icon);
  });

  it("puts the unread checks inside the neutral ring", () => {
    const html = render("");
    expect(html).toContain('class="read-filter-combined-icon"');
    expect(html).toContain("lucide-check-check");
  });
});
