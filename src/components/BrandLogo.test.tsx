import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("SIMPL brand logo", () => {
  it("uses one shared symbol and wordmark for every brand link", () => {
    const html = renderToStaticMarkup(<BrandLogo />);
    expect(html).toContain('src="/images/simple-mark.png"');
    expect(html).toContain('<span class="brand-name">simpl</span>');
    expect(html).not.toContain('<span class="brand-name">simple</span>');
    expect(html).not.toContain("Trello");
  });

  it("reserves the icon dimensions without duplicating the accessible name", () => {
    const html = renderToStaticMarkup(
      <a href="/" aria-label="SIMPL Taskboard">
        <BrandLogo />
      </a>,
    );
    expect(html).toContain('aria-label="SIMPL Taskboard"');
    expect(html).toContain('alt=""');
    expect(html).toContain('width="36" height="36"');
    expect(html).toContain('draggable="false"');
  });
});
