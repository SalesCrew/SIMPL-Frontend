import { describe, expect, it } from "vitest";
import {
  defaultEmailNotificationPreferences,
  projectEmailEnabled,
  workspaceEmailEnabled,
} from "./email-preferences";

describe("email notification preferences", () => {
  it("keeps existing email behaviour enabled by default", () => {
    const preferences = defaultEmailNotificationPreferences();
    expect(workspaceEmailEnabled(preferences, "workspace-a")).toBe(true);
    expect(projectEmailEnabled(preferences, "workspace-a", "project-a")).toBe(true);
  });

  it("applies the master, workspace and project switches hierarchically", () => {
    const preferences = defaultEmailNotificationPreferences();
    preferences.projects["project-a"] = false;
    expect(projectEmailEnabled(preferences, "workspace-a", "project-a")).toBe(false);
    preferences.projects["project-a"] = true;
    preferences.workspaces["workspace-a"] = false;
    expect(projectEmailEnabled(preferences, "workspace-a", "project-a")).toBe(false);
    preferences.workspaces["workspace-a"] = true;
    preferences.settings.enabled = false;
    expect(workspaceEmailEnabled(preferences, "workspace-a")).toBe(false);
  });
});
