import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TeamAvatars } from "./TeamAvatars";
import { TooltipProvider } from "./ui/Tooltip";
import { Avatar } from "./Board";
import { createSeed } from "../seed";

vi.mock("../data", () => ({ demoMode: true, supabase: null }));

const profiles = (count: number) => Array.from({ length: count }, (_, i) => ({
  ...createSeed().profiles[0], id: `member-${i}`, name: `Mitglied ${i + 1}`,
}));
const render = (count: number) => renderToStaticMarkup(<TooltipProvider><TeamAvatars profiles={profiles(count)} /></TooltipProvider>);

describe("Header team avatars", () => {
  it("keeps six or fewer members visible and adds no fake overflow", () => {
    const html = render(6);
    expect(html.match(/role="img"/g)).toHaveLength(6);
    expect(html).not.toContain("avatar-more");
    expect(html).toContain('aria-label="Mitglied 6"');
  });
  it("replaces one slot with the precise hidden count, at the left edge", () => {
    const html = render(9);
    expect(html.match(/role="img"/g)).toHaveLength(5);
    expect(html).toContain('aria-label="4 weitere Mitglieder anzeigen"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-hidden="true">+4</span>');
    expect(html.indexOf('class="avatar avatar-more"')).toBeLessThan(html.indexOf('aria-label="Mitglied 1"'));
    expect(html).not.toContain('aria-label="Mitglied 6"');
  });
  it("does not truncate large overflow counts", () => {
    const html = render(105);
    expect(html).toContain('aria-hidden="true">+100</span>');
    expect(html).toContain('data-compact="true"');
  });
  it("keeps member names available to keyboard and assistive technology", () => {
    const html = render(9);
    expect(html).toContain('role="group" aria-label="Teammitglieder"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(5);
    for (let i = 1; i <= 5; i++) expect(html).toContain(`aria-label="Mitglied ${i}"`);
  });
  it("does not add tab stops to avatars elsewhere in the app", () => {
    const html = renderToStaticMarkup(<Avatar profile={profiles(1)[0]} tooltip={false} />);
    expect(html).not.toContain("tabindex");
  });
  it("renders nothing when there are no active people", () => {
    expect(render(0)).toBe("");
    const inactive = profiles(1).map((profile) => ({ ...profile, active: false }));
    expect(renderToStaticMarkup(<TeamAvatars profiles={inactive} />)).toBe("");
  });
});
