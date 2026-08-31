import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoardViewport } from "./BoardViewport";

describe("BoardViewport layers", () => {
  const render = () =>
    renderToStaticMarkup(
      <BoardViewport
        heading={<h1>Taskboard</h1>}
        controls={<button>Filter</button>}
      >
        <section aria-label="Projekt">Karten</section>
      </BoardViewport>,
    );

  it("uses one scroll surface for the intro, controls and cards", () => {
    const html = render();
    expect(html.match(/class="board-scroll"/g)).toHaveLength(1);
    expect(html.indexOf('class="board-intro"')).toBeLessThan(
      html.indexOf('class="board-controls"'),
    );
    expect(html.indexOf('class="board-controls"')).toBeLessThan(
      html.indexOf('aria-label="Projekt"'),
    );
  });

  it("keeps the stationary artwork decorative and separate from content", () => {
    const html = render();
    expect(html).toContain('<div class="board-hero" aria-hidden="true"></div>');
    expect(html).toContain('<div class="board-intro"><h1>Taskboard</h1></div>');
    expect(html).toContain(
      '<div class="board-controls"><button>Filter</button></div>',
    );
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
  });

  it("does not duplicate the heading or interactive controls", () => {
    const html = render();
    expect(html.match(/<button>/g)).toHaveLength(1);
    expect(html.match(/<h1>/g)).toHaveLength(1);
  });
});
