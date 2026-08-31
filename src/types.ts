export type Role = "admin" | "mitarbeiter";
export const colors = [
  "green",
  "blue",
  "purple",
  "orange",
  "rose",
  "slate",
  "mint",
  "sage",
  "teal",
  "sky",
  "periwinkle",
  "lavender",
  "pink",
  "peach",
  "butter",
  "sand",
] as const;
export type Color = (typeof colors)[number];
export const colorNames: Record<Color, string> = {
  green: "Grün",
  blue: "Blau",
  purple: "Lila",
  orange: "Aprikose",
  rose: "Altrosa",
  slate: "Blaugrau",
  mint: "Minze",
  sage: "Salbei",
  teal: "Türkis",
  sky: "Himmelblau",
  periwinkle: "Fliederblau",
  lavender: "Lavendel",
  pink: "Rosé",
  peach: "Pfirsich",
  butter: "Vanille",
  sand: "Sand",
};
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  default_column_id: string | null;
  default_workspace_id: string;
  color: Color;
  active: boolean;
}
export interface Column {
  id: string;
  workspace_id: string;
  name: string;
  color: Color;
  kind: "project" | "work" | "done";
  position: number;
}
export interface Label {
  id: string;
  workspace_id?: string; // Legacy device-local demos are upgraded on load.
  name: string;
  color: Color;
}
export interface Card {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  column_id: string;
  project_id: string | null; // Null only for imported archives with no single original project.
  return_column_id?: string | null;
  return_before_id?: string | null;
  return_after_id?: string | null;
  return_index?: number | null;
  created_by: string;
  assignee_id: string | null;
  position: number;
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  label_ids: string[];
  edit_revision?: number;
  deleted_at?: string | null;
  archived_at?: string | null;
  due_at?: string | null;
  checklists?: Checklist[];
}
export interface Checklist {
  id: string;
  name: string;
  items: { id: string; name: string; completed: boolean }[];
}
export interface Comment {
  id: string;
  card_id: string;
  author_id: string;
  body: string;
  created_at: string;
  attachment_ids?: string[];
}
export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  card_id: string;
  comment_id: string;
  body: string;
  created_at: string;
  seen_at: string | null;
}
export interface BoardState {
  workspace_blocks?: WorkspaceBlock[];
  access_revision?: AccessRevision;
  attachments: Attachment[];
  workspaces: Workspace[];
  profiles: Profile[];
  columns: Column[];
  labels: Label[];
  cards: Card[];
  comments: Comment[];
  notifications: Notification[];
}
export interface Workspace {
  id: string;
  name: string;
  color: Color;
  isolated?: boolean;
}
export interface WorkspaceBlock {
  id: string;
  workspace_a: string;
  workspace_b: string;
}
export interface AccessRevision {
  id: string;
  authorization_version: number;
  board_version: number;
}
export interface Attachment {
  id: string;
  card_id: string;
  comment_id?: string | null;
  comment_draft_id?: string | null;
  uploaded_by: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  object_path: string;
  status: "pending" | "ready" | "deleting";
  created_at: string;
  expires_at: string;
}
export const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const timestamp = (date: string) =>
  new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
