import { afterEach, describe, expect, it, vi } from "vitest";
import { initialAppView, writeAppViewLocation, type AppView } from "./app-navigation";

function browserAt(href: string) {
  const location = new URL(href);
  const history = { state: { preserved: true }, replaceState: vi.fn((_state: unknown, _unused: string, next: string) => { location.href = new URL(next, location).href; }) };
  vi.stubGlobal("window", { location, history });
  return { location, history };
}
afterEach(() => vi.unstubAllGlobals());

describe("taskboard default and refresh navigation", () => {
  it("starts a plain URL or server render on the board without stored account preferences", () => {
    expect(initialAppView()).toBe("board");
    expect(() => writeAppViewLocation("analytics")).not.toThrow();
    browserAt("https://example.invalid/");
    expect(initialAppView()).toBe("board");
  });

  it.each<AppView>(["board", "mine", "done", "archive", "docs", "team", "analytics"])("restores %s from its own URL after a reload", view => {
    const { location } = browserAt("https://example.invalid/?source=mail#section");
    writeAppViewLocation(view);
    expect(initialAppView()).toBe(view);
    expect(location.searchParams.get("source")).toBe("mail");
    expect(location.hash).toBe("#section");
  });

  it.each(["unknown", "constructor", "__proto__"])("falls back safely for unsupported view %s", value => {
    browserAt(`https://example.invalid/?view=${value}`);
    expect(initialAppView()).toBe("board");
  });

  it("preserves explicit insight meeting links, card links and browser history state", () => {
    const { history } = browserAt("https://example.invalid/?card=card-id&view=insights&meeting=m&meeting_section=s&meeting_reader=1&meeting_label=l#section");
    expect(initialAppView()).toBe("analytics");
    writeAppViewLocation("analytics");
    expect(history.replaceState).not.toHaveBeenCalled();
    writeAppViewLocation("archive");
    expect(history.replaceState).toHaveBeenLastCalledWith({ preserved: true }, "", "/?card=card-id&view=archive#section");
  });

  it("returning to the taskboard removes the old private page and its meeting state", () => {
    const { location, history } = browserAt("https://example.invalid/?view=insights&meeting=m&meeting_reader=1&source=mail");
    Object.assign(history.state, { personalMeetingDepth: 2 });
    writeAppViewLocation("board");
    expect(location.search).toBe("?source=mail");
    expect(history.replaceState).toHaveBeenLastCalledWith({ preserved: true, personalMeetingDepth: 0 }, "", "/?source=mail");
    expect(initialAppView()).toBe("board");
  });
});
