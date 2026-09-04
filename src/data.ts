import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Action } from "./domain";
import type { BoardState, Profile, Workspace, AccessRevision, Card } from "./types";
import type { CardMove } from "./optimistic-card-moves";
import type { CardCreateAction } from "./optimistic-card-creates";
import {
  defaultEmailNotificationPreferences,
  type EmailNotificationPreferences,
  type EmailNotificationSettings,
} from "./email-preferences";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const demoMode =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.DEV && !url && !key);
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        global: {
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
        },
      })
    : null;

export async function apiRequest(path: string, method: string, body?: unknown, keepalive = false) {
  const session = (await supabase!.auth.getSession()).data.session;
  if (!session) throw new Error("Bitte erneut anmelden.");
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || ""}/api${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal: AbortSignal.timeout(60000),
    },
  );
  if (response.status === 204) return;
  const json = await response.json();
  if (!response.ok)
    throw new Error(json.error || "Die Anfrage ist fehlgeschlagen.");
  return json;
}

export type WorkspaceEmailEvent =
  | "comment.created"
  | "card.created"
  | "card.reviewed"
  | "card.completed"
  | "card.archived";

export function emailEventForAction(action: Action): WorkspaceEmailEvent | null {
  switch (action.type) {
    case "card.create": return "card.created";
    case "comment.create": return "comment.created";
    case "card.review": return action.reviewed ? "card.reviewed" : null;
    case "card.complete": return action.completed ? "card.completed" : null;
    case "card.archive": return "card.archived";
    default: return null;
  }
}

export function requestWorkspaceEmailDelivery(eventType: WorkspaceEmailEvent) {
  return apiRequest("/email/dispatch", "POST", { event_type: eventType }, true);
}

export function triggerWorkspaceEmailForAction(action: Action) {
  const eventType = emailEventForAction(action);
  if (!eventType) return;
  void requestWorkspaceEmailDelivery(eventType).catch(() => {
    // The committed outbox is durable. A later action, retry, or service restart
    // can resume delivery without delaying the visible UI action.
  });
}

export async function loadEmailNotificationPreferences(
  userId: string,
): Promise<EmailNotificationPreferences> {
  if (!supabase) return defaultEmailNotificationPreferences();
  const [settingsResult, workspaceResult, projectResult] = await Promise.all([
    supabase.from("email_notification_settings").select(
      "enabled,card_created,comment_created,card_reviewed,card_completed,card_archived",
    ).eq("user_id", userId).maybeSingle(),
    supabase.from("email_notification_workspace_preferences")
      .select("workspace_id,enabled").eq("user_id", userId),
    supabase.from("email_notification_project_preferences")
      .select("project_id,enabled").eq("user_id", userId),
  ]);
  const error = settingsResult.error || workspaceResult.error || projectResult.error;
  if (error) throw error;
  const defaults = defaultEmailNotificationPreferences();
  return {
    settings: settingsResult.data
      ? { ...defaults.settings, ...settingsResult.data }
      : defaults.settings,
    workspaces: Object.fromEntries(
      (workspaceResult.data || []).map((row) => [row.workspace_id, row.enabled]),
    ),
    projects: Object.fromEntries(
      (projectResult.data || []).map((row) => [row.project_id, row.enabled]),
    ),
  };
}

export async function saveEmailNotificationSettings(
  userId: string,
  settings: EmailNotificationSettings,
) {
  if (!supabase) return;
  const { error } = await supabase.from("email_notification_settings").upsert({
    user_id: userId,
    ...settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function saveWorkspaceEmailPreference(
  userId: string,
  workspaceId: string,
  enabled: boolean,
) {
  if (!supabase) return;
  const { error } = await supabase
    .from("email_notification_workspace_preferences")
    .upsert({
      user_id: userId,
      workspace_id: workspaceId,
      enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,workspace_id" });
  if (error) throw error;
}

export async function saveProjectEmailPreference(
  userId: string,
  projectId: string,
  enabled: boolean,
) {
  if (!supabase) return;
  const { error } = await supabase
    .from("email_notification_project_preferences")
    .upsert({
      user_id: userId,
      project_id: projectId,
      enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,project_id" });
  if (error) throw error;
}

export async function moveCardRemote(action: CardMove): Promise<Card[]> {
  // Only this tiny JSON request uses keepalive, never file uploads. Once received,
  // the long-running backend owns the transaction independently of this page.
  const result = await apiRequest(`/cards/${action.id}/move`, "POST", {
    column_id: action.column_id,
    before_id: action.before_id || null,
  }, true);
  if (!Array.isArray(result?.cards) || !result.cards.some((card: Card) => card.id === action.id))
    throw new Error("Verschieben konnte nicht bestätigt werden. Bitte Verbindung prüfen.");
  return result.cards;
}

export async function createCardRemote(action: CardCreateAction): Promise<Card> {
  if (!supabase) throw new Error("Supabase ist noch nicht eingerichtet.");
  const { data, error } = await supabase
    .from("cards")
    .insert({
      ...(action.id ? { id: action.id } : {}),
      title: action.title,
      description: action.description || "",
      column_id: action.column_id,
      project_id: action.project_id,
      assignee_id: action.assignee_id,
      label_ids: action.label_ids || [],
      checklists: action.checklists || [],
    })
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Die neue Karte konnte nicht bestätigt werden.");
  return data as Card;
}

async function allRows(table: string) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase!
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export async function accessContext(): Promise<{
  profile: Profile | null;
  workspaces: Workspace[];
  revision: AccessRevision | null;
}> {
  const { data, error } = await supabase!.rpc("workspace_access_context");
  if (error) throw error;
  return data;
}
export type AccountAccess = {
  security: {
    user_id: string;
    password_change_required: boolean;
    password_changed_at: string | null;
  } | null;
  ready: boolean;
};
export async function accountAccess(): Promise<AccountAccess> {
  const { data, error } = await supabase!.rpc("account_access_context");
  if (error) throw error;
  if (!data || typeof data.ready !== "boolean")
    throw new Error("Der Kontozugriff konnte nicht geprüft werden.");
  return data;
}
export async function changeInitialPassword(email: string, password: string, repeatPassword: string) {
  await apiRequest("/account/initial-password", "POST", { password, repeatPassword });
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) {
    await supabase!.auth.signOut({ scope: "local" });
    throw new Error("Passwort gespeichert. Bitte melde dich mit deinem neuen Passwort erneut an.");
  }
}
export async function loadBoard(
  onContext?: (revision: AccessRevision | null) => void,
): Promise<BoardState> {
  const tables = [
    "profiles",
    "columns",
    "labels",
    "cards",
    "comments",
    "notifications",
    "attachments",
  ] as const;
  for (let attempt = 0; attempt < 3; attempt++) {
    const context = await accessContext();
    onContext?.(context.revision);
    if (!context.profile)
      return {
        workspaces: [],
        profiles: [],
        columns: [],
        labels: [],
        cards: [],
        comments: [],
        notifications: [],
        attachments: [],
        workspace_blocks: [],
        access_revision: context.revision || undefined,
      };
    const [values, blocks] = await Promise.all([
      Promise.all(tables.map(allRows)),
      context.profile.role === "admin"
        ? allRows("workspace_blocks")
        : Promise.resolve([]),
    ]);
    // A rule/home assignment can change while these independent requests are running.
    const after = await accessContext();
    if (
      after.profile?.id !== context.profile.id ||
      after.revision?.authorization_version !==
        context.revision?.authorization_version
    ) {
      onContext?.(after.revision);
      continue;
    }
    return {
      ...Object.fromEntries(tables.map((key, i) => [key, values[i]])),
      workspaces: after.workspaces,
      workspace_blocks: blocks,
      access_revision: after.revision || undefined,
    } as unknown as BoardState;
  }
  throw new Error("Zugriffsrechte haben sich geändert. Bitte erneut laden.");
}
export async function runRemote(action: Action) {
  if (!supabase) throw new Error("Supabase ist noch nicht eingerichtet.");
  const db = supabase;
  let result;
  switch (action.type) {
    case "workspace.save":
      result = await db.rpc("save_workspace", {
        p_id: action.workspace.id,
        p_name: action.workspace.name,
        p_color: action.workspace.color,
        p_isolated: !!action.workspace.isolated,
        p_blocked: action.blocked_ids || [],
      });
      break;
    case "card.create":
      await createCardRemote(action);
      triggerWorkspaceEmailForAction(action);
      return;
    case "card.update":
      result = await db
        .from("cards")
        .update(action.patch)
        .eq("id", action.id)
        .select("id")
        .single();
      break;
    case "card.move":
      await moveCardRemote(action);
      return;
    case "card.complete":
      result = await db.rpc("set_card_completed", {
        p_card: action.id,
        p_completed: action.completed,
      });
      break;
    case "card.review":
      result = await db
        .from("cards")
        .update({
          reviewed_at: action.reviewed ? new Date().toISOString() : null,
          reviewed_by: action.reviewed
            ? (await db.auth.getUser()).data.user?.id
            : null,
        })
        .eq("id", action.id)
        .select("id")
        .single();
      break;
    case "card.archive":
      throw new Error("Archivieren ist nur in der geöffneten Karte möglich.");
    case "card.delete":
      await apiRequest(`/cards/${action.id}`, "DELETE");
      return;
    case "attachment.add":
      // Metadata was finalized by the authenticated upload API; refresh the board.
      return;
    case "attachment.delete":
      await apiRequest(`/attachments/${action.id}`, "DELETE");
      return;
    case "comment.create":
      result = await db
        .from("comments")
        .insert({
          card_id: action.card_id,
          body: action.body.trim(),
          attachment_ids: (action.attachments || []).map((a) => a.id),
        });
      break;
    case "notifications.seen": {
      let query = db
        .from("notifications")
        .update({ seen_at: new Date().toISOString() })
        .is("seen_at", null);
      if (action.id) query = query.eq("id", action.id);
      result = await query;
      break;
    }
    case "column.save":
      result = await db.from("columns").upsert(action.column);
      break;
    case "column.delete":
      result = await db
        .from("columns")
        .delete()
        .eq("id", action.id)
        .select("id")
        .single();
      break;
    case "label.save":
      result = await db.from("labels").upsert(action.label);
      break;
    case "profile.save": {
      const session = (await db.auth.getSession()).data.session;
      if (!session) throw new Error("Bitte erneut anmelden.");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/api/users${action.isNew ? "" : "/" + action.profile.id}`,
        {
          method: action.isNew ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...action.profile,
            password: action.password,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.error || "Zugang konnte nicht gespeichert werden.",
        );
      return;
    }
  }
  if (result?.error) throw result.error;
  triggerWorkspaceEmailForAction(action);
}
