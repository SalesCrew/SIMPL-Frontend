import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmailPreferences } from "./EmailPreferences";

describe("EmailPreferences", () => {
  it("renders every event and the workspace-project hierarchy", () => {
    const html = renderToStaticMarkup(
      <EmailPreferences
        userId="person-1"
        activeWorkspaceId="workspace-1"
        demo
        workspaces={[{ id: "workspace-1", name: "Development", color: "green" }]}
        columns={[
          {
            id: "project-1",
            workspace_id: "workspace-1",
            name: "SPARK",
            color: "orange",
            kind: "project",
            position: 0,
          },
          {
            id: "done-1",
            workspace_id: "workspace-1",
            name: "Fertig",
            color: "green",
            kind: "done",
            position: 1,
          },
        ]}
      />,
    );

    expect(html).toContain("E-Mail-Benachrichtigungen");
    expect(html).toContain("Neue Karten");
    expect(html).toContain("Kommentare");
    expect(html).toContain("Wahrgenommen");
    expect(html).toContain("Erledigte Karten");
    expect(html).toContain("Archivierte Karten");
    expect(html).toContain("Development");
    expect(html).toContain("SPARK");
    expect(html).not.toContain("Fertig");
  });
});
