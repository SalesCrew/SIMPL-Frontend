import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationBell } from "./NotificationBell";

describe("notification bell", () => {
  const render = (unreadCount: number, open = false) =>
    renderToStaticMarkup(
      <NotificationBell unreadCount={unreadCount} open={open} onClick={() => {}} />,
    );

  it("stays neutral without unread notifications", () => {
    const html = render(0);
    expect(html).toContain('aria-label="Neuigkeiten (0 ungelesen)"');
    expect(html).not.toContain("has-unread");
    expect(html).not.toContain("notification-bell-dot");
  });

  it("enables the yellow ringing state while there are unread messages", () => {
    const html = render(3);
    expect(html).toContain('class="icon-button notification-bell has-unread"');
    expect(html).toContain('aria-label="Neuigkeiten (3 ungelesen)"');
    expect(html).toContain('class="notification-bell-dot" aria-hidden="true"');
    expect(html).toContain('class="notification-bell-swing" aria-hidden="true"');
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it("opening the panel does not imply messages were read", () => {
    expect(render(2, true)).toContain('aria-expanded="true"');
    expect(render(2, true)).toContain("has-unread");
    expect(render(0, true)).not.toContain("has-unread");
    expect(render(0)).toContain('type="button"');
  });
});
