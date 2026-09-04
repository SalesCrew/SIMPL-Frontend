export const emailEventKeys = [
  "card_created",
  "comment_created",
  "card_reviewed",
  "card_completed",
  "card_archived",
] as const;

export type EmailEventKey = (typeof emailEventKeys)[number];

export interface EmailNotificationSettings {
  enabled: boolean;
  card_created: boolean;
  comment_created: boolean;
  card_reviewed: boolean;
  card_completed: boolean;
  card_archived: boolean;
}

export interface EmailNotificationPreferences {
  settings: EmailNotificationSettings;
  workspaces: Record<string, boolean>;
  projects: Record<string, boolean>;
}

export const defaultEmailNotificationPreferences = (): EmailNotificationPreferences => ({
  settings: {
    enabled: true,
    card_created: true,
    comment_created: true,
    card_reviewed: true,
    card_completed: true,
    card_archived: true,
  },
  workspaces: {},
  projects: {},
});

export const workspaceEmailEnabled = (
  preferences: EmailNotificationPreferences,
  workspaceId: string,
) => preferences.settings.enabled && (preferences.workspaces[workspaceId] ?? true);

export const projectEmailEnabled = (
  preferences: EmailNotificationPreferences,
  workspaceId: string,
  projectId: string,
) => workspaceEmailEnabled(preferences, workspaceId) &&
  (preferences.projects[projectId] ?? true);
