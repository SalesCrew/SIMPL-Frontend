import type {
  BoardState,
  Card,
  Column,
  Label,
  Profile,
  Workspace,
  Attachment,
} from "./types";
import { validateFile } from "./attachment-files";

export type Action =
  | { type: "workspace.save"; workspace: Workspace; blocked_ids?: string[] }
  | {
      type: "card.create";
      id?: string;
      title: string;
      column_id: string;
      project_id: string;
      description?: string;
      assignee_id?: string | null;
      label_ids?: string[];
      checklists?: Card["checklists"];
    }
  | {
      type: "card.update";
      id: string;
      patch: Partial<
        Pick<Card, "title" | "description" | "assignee_id" | "label_ids" | "checklists">
      >;
    }
  | {
      type: "card.move";
      id: string;
      column_id: string;
      before_id?: string | null;
    }
  | { type: "card.review"; id: string; reviewed: boolean }
  | { type: "card.complete"; id: string; completed: boolean }
  | { type: "card.delete"; id: string }
  | { type: "attachment.add"; attachment: Attachment }
  | { type: "attachment.delete"; id: string }
  | {
      type: "comment.create";
      card_id: string;
      body: string;
      attachments?: Attachment[];
    }
  | { type: "notifications.seen"; id?: string }
  | { type: "column.save"; column: Column }
  | { type: "column.delete"; id: string }
  | { type: "label.save"; label: Label }
  | {
      type: "profile.save";
      profile: Profile;
      password?: string;
      isNew: boolean;
    };

export function orderedCards(state: BoardState, columnId: string) {
  return state.cards
    .filter((c) => c.column_id === columnId && !c.archived_at)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
export function orderedColumns(columns: Column[]) {
  const rank = { project: 0, work: 1, done: 2 };
  return [...columns].sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  );
}

// Upgrade old device-local demos without resetting tasks, comments or custom projects.
export function restoreFixedBuckets(state: BoardState): BoardState {
  const next = structuredClone(state);
  next.attachments ||= [];
  next.workspace_blocks ||= [];
  next.workspaces ||= [{ id: "salescrew", name: "SalesCrew", color: "green" }];
  const first =
    next.workspaces.find((w) => w.id === "salescrew")?.id ||
    next.workspaces[0].id;
  // Preserve legacy labels used in several workspaces with workspace-local copies.
  for (const label of [...next.labels]) {
    if (label.workspace_id) continue;
    label.workspace_id = first;
    for (const workspace of next.workspaces.filter((w) => w.id !== first)) {
      const cards = next.cards.filter(
        (c) =>
          c.workspace_id === workspace.id && c.label_ids.includes(label.id),
      );
      if (!cards.length) continue;
      const id = `${label.id}-${workspace.id}`;
      next.labels.push({ ...label, id, workspace_id: workspace.id });
      cards.forEach((c) => {
        c.label_ids = c.label_ids.map((value) =>
          value === label.id ? id : value,
        );
      });
    }
  }
  next.columns.forEach((c) => {
    c.workspace_id ||= first;
  });
  next.cards.forEach((c) => {
    c.workspace_id ||=
      next.columns.find((col) => col.id === c.column_id)?.workspace_id || first;
  });
  next.profiles.forEach((p) => {
    p.default_workspace_id ||=
      next.columns.find((col) => col.id === p.default_column_id)
        ?.workspace_id || first;
  });
  for (const workspace of next.workspaces)
    for (const kind of ["work", "done"] as const) {
      const name = kind === "work" ? "In Arbeit" : "Fertig";
      const existing = next.columns.find(
        (column) =>
          column.kind === kind && column.workspace_id === workspace.id,
      );
      if (existing) existing.name = name;
      else {
        let id = kind as string;
        while (next.columns.some((column) => column.id === id))
          id = `fixed-${id}`;
        next.columns.push({
          id,
          workspace_id: workspace.id,
          kind,
          name,
          color: kind === "done" ? "green" : "orange",
          position: next.columns.length,
        });
      }
    }
  return next;
}
export function startingWorkspaceId(state: BoardState, profile: Profile) {
  return (
    state.workspaces.find((w) => w.id === profile.default_workspace_id)?.id ||
    state.workspaces[0]?.id ||
    ""
  );
}
export function workspaceBoard(state: BoardState, id: string): BoardState {
  const cards = state.cards.filter((c) => c.workspace_id === id);
  const ids = new Set(cards.map((c) => c.id));
  return {
    ...state,
    columns: state.columns.filter((c) => c.workspace_id === id),
    labels: state.labels.filter(
      (l) => (l.workspace_id || state.workspaces[0]?.id) === id,
    ),
    cards,
    comments: state.comments.filter((c) => ids.has(c.card_id)),
    attachments: state.attachments.filter((a) => ids.has(a.card_id)),
  };
}
// Local preview only. Production authorization is enforced independently by database RLS.
export function canAccessWorkspace(
  state: BoardState,
  actor: Profile,
  id: string,
) {
  const home = state.workspaces.find(
    (w) => w.id === actor.default_workspace_id,
  );
  const target = state.workspaces.find((w) => w.id === id);
  return !!(
    actor.active &&
    home &&
    target &&
    (actor.role === "admin" ||
      home.id === id ||
      (!home.isolated &&
        !target.isolated &&
        !(state.workspace_blocks || []).some(
          (b) =>
            (b.workspace_a === home.id && b.workspace_b === id) ||
            (b.workspace_b === home.id && b.workspace_a === id),
        )))
  );
}
export function visibleBoardForActor(
  state: BoardState,
  actor: Profile,
): BoardState {
  const allowed = (id: string) => canAccessWorkspace(state, actor, id);
  const cards = state.cards.filter((c) => allowed(c.workspace_id));
  const ids = new Set(cards.map((c) => c.id));
  return {
    ...state,
    workspaces: state.workspaces.filter((w) => allowed(w.id)),
    workspace_blocks:
      actor.role === "admin" ? state.workspace_blocks || [] : [],
    profiles: state.profiles.filter(
      (p) => p.id === actor.id || allowed(p.default_workspace_id),
    ),
    columns: state.columns.filter((c) => allowed(c.workspace_id)),
    labels: state.labels.filter((l) =>
      allowed(l.workspace_id || state.workspaces[0].id),
    ),
    cards,
    comments: state.comments.filter((c) => ids.has(c.card_id)),
    attachments: state.attachments.filter(
      (a) =>
        ids.has(a.card_id) &&
        ((a.status === "ready" && !a.comment_draft_id) ||
          a.uploaded_by === actor.id ||
          actor.role === "admin"),
    ),
    notifications: state.notifications.filter(
      (n) => n.recipient_id === actor.id && ids.has(n.card_id),
    ),
  };
}
export function movePosition(
  state: BoardState,
  id: string,
  column: string,
  before?: string | null,
) {
  const cards = orderedCards(state, column).filter((c) => c.id !== id);
  const index = before ? cards.findIndex((c) => c.id === before) : -1;
  return index < 0
    ? (cards.at(-1)?.position ?? 0) + 1024
    : ((cards[index - 1]?.position ?? cards[index].position - 2048) +
        cards[index].position) /
        2;
}
function returnLocation(state: BoardState, card: Card) {
  const column =
    state.columns.find(
      (c) =>
        c.id === card.return_column_id &&
        c.kind === "project" &&
        c.workspace_id === card.workspace_id,
    )?.id || card.project_id;
  if (!column) throw new Error("Diese archivierte Karte hat kein eindeutiges Ursprungsprojekt.");
  const cards = orderedCards(state, column).filter((c) => c.id !== card.id);
  if (cards.some((c) => c.id === card.return_before_id))
    return { column_id: column, before_id: card.return_before_id };
  const previous = cards.findIndex((c) => c.id === card.return_after_id);
  return {
    column_id: column,
    before_id:
      previous >= 0
        ? cards[previous + 1]?.id
        : card.return_index != null
          ? cards[card.return_index]?.id
          : undefined,
  };
}
export function applyDemoAction(
  original: BoardState,
  actor: Profile,
  action: Action,
): BoardState {
  if (!actor.active) throw new Error("Dein Zugang ist deaktiviert.");
  const s = structuredClone(original);
  const access = (id: string) => {
    if (!canAccessWorkspace(s, actor, id))
      throw new Error("Kein Zugriff auf diesen Workspace.");
  };
  const now = new Date().toISOString();
  const admin = () => {
    if (actor.role !== "admin")
      throw new Error("Nur Administratoren können diese Aktion ausführen.");
  };
  const card = (id: string) => {
    const value = s.cards.find((c) => c.id === id);
    if (!value) throw new Error("Karte nicht gefunden.");
    access(value.workspace_id);
    return value;
  };
  switch (action.type) {
    case "workspace.save": {
      admin();
      if (!action.workspace.name.trim())
        throw new Error("Bitte einen Workspace-Namen eingeben.");
      if (
        s.workspaces.some(
          (w) =>
            w.id !== action.workspace.id &&
            w.name.trim().toLowerCase() ===
              action.workspace.name.trim().toLowerCase(),
        )
      )
        throw new Error("Dieser Workspace-Name wird bereits verwendet.");
      const exists = s.workspaces.some((w) => w.id === action.workspace.id);
      const savedWorkspace = {
        ...action.workspace,
        name: action.workspace.name.trim(),
      };
      s.workspaces = exists
        ? s.workspaces.map((w) =>
            w.id === savedWorkspace.id ? savedWorkspace : w,
          )
        : [...s.workspaces, savedWorkspace];
      const blocked = action.blocked_ids || [];
      if (
        blocked.some(
          (id) =>
            id === action.workspace.id ||
            !s.workspaces.some((w) => w.id === id),
        )
      )
        throw new Error("Ungültige Workspace-Auswahl.");
      s.workspace_blocks = (s.workspace_blocks || []).filter(
        (b) =>
          b.workspace_a !== action.workspace.id &&
          b.workspace_b !== action.workspace.id,
      );
      if (!action.workspace.isolated)
        for (const target of new Set(blocked)) {
          const [workspace_a, workspace_b] = [
            action.workspace.id,
            target,
          ].sort();
          s.workspace_blocks.push({
            id: crypto.randomUUID(),
            workspace_a,
            workspace_b,
          });
        }
      if (!exists) {
        for (const [name, color] of [
          ["Feature", "green"],
          ["Verbesserung", "blue"],
          ["Bug", "rose"],
          ["Feedback", "purple"],
          ["Priorität", "orange"],
        ] as const)
          s.labels.push({
            id: crypto.randomUUID(),
            workspace_id: action.workspace.id,
            name,
            color,
          });
        s.columns.push(
          ...(
            [
              { name: "Allgemein", kind: "project", color: "blue" },
              { name: "In Arbeit", kind: "work", color: "orange" },
              { name: "Fertig", kind: "done", color: "green" },
            ] as const
          ).map((c, position) => ({
            ...c,
            position,
            id: crypto.randomUUID(),
            workspace_id: action.workspace.id,
          })),
        );
      }
      break;
    }
    case "card.create": {
      if (!action.title.trim())
        throw new Error("Bitte gib einen Kartentitel ein.");
      if (
        !s.columns.some(
          (c) => c.id === action.column_id && c.kind === "project",
        ) ||
        !s.columns.some(
          (c) => c.id === action.project_id && c.kind === "project",
        )
      )
        throw new Error("Bitte ein gültiges Projekt wählen.");
      const workspaceId = s.columns.find(
        (c) => c.id === action.column_id,
      )!.workspace_id;
      access(workspaceId);
      if (
        !s.columns.some(
          (c) => c.id === action.project_id && c.workspace_id === workspaceId,
        )
      )
        throw new Error(
          "Projekt und Karte müssen zum gleichen Workspace gehören.",
        );
      s.cards.push({
        id: action.id || crypto.randomUUID(),
        workspace_id: workspaceId,
        title: action.title.trim(),
        description: action.description || "",
        column_id: action.column_id,
        project_id: action.project_id,
        created_by: actor.id,
        assignee_id:
          action.assignee_id === undefined ? actor.id : action.assignee_id,
        label_ids: action.label_ids || [],
        checklists: action.checklists || [],
        position: movePosition(s, "", action.column_id),
        completed_at:
          s.columns.find((c) => c.id === action.column_id)?.kind === "done"
            ? now
            : null,
        reviewed_at: null,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      });
      break;
    }
    case "card.complete": {
      const c = card(action.id);
      const done = s.columns.find(
        (column) =>
          column.kind === "done" && column.workspace_id === c.workspace_id,
      );
      if (!done)
        throw new Error(
          "Die feste Fertig-Spalte fehlt. Bitte das Board neu laden.",
        );
      if (
        (!action.completed && c.column_id !== done.id) ||
        (action.completed && c.column_id === done.id)
      )
        break;
      return applyDemoAction(s, actor, {
        type: "card.move",
        id: c.id,
        ...(action.completed ? { column_id: done.id } : returnLocation(s, c)),
      });
    }
    case "card.update":
      Object.assign(card(action.id), action.patch, { updated_at: now });
      break;
    case "card.move": {
      const c = card(action.id);
      const target = s.columns.find((col) => col.id === action.column_id);
      if (!target) throw new Error("Spalte nicht gefunden.");
      if (target.workspace_id !== c.workspace_id)
        throw new Error(
          "Bitte eine Spalte aus dem Workspace dieser Karte wählen.",
        );
      if (action.before_id === action.id) break;
      const source = s.columns.find((col) => col.id === c.column_id);
      if (source?.kind === "project" && target.kind !== "project") {
        const siblings = orderedCards(s, source.id);
        const index = siblings.findIndex((sibling) => sibling.id === c.id);
        c.return_column_id = source.id;
        c.return_before_id = siblings[index + 1]?.id || null;
        c.return_after_id = siblings[index - 1]?.id || null;
        c.return_index = index;
      } else if (target.kind === "project") {
        c.return_column_id = c.return_before_id = c.return_after_id = null;
        c.return_index = null;
      }
      c.position = movePosition(s, c.id, target.id, action.before_id);
      c.column_id = target.id;
      if (target.kind === "project") c.project_id = target.id;
      c.completed_at = target.kind === "done" ? c.completed_at || now : null;
      c.updated_at = now;
      break;
    }
    case "card.review": {
      const c = card(action.id);
      c.reviewed_at = action.reviewed ? now : null;
      c.reviewed_by = action.reviewed ? actor.id : null;
      break;
    }
    case "card.delete":
      card(action.id);
      s.attachments = s.attachments.filter((a) => a.card_id !== action.id);
      s.cards = s.cards.filter((c) => c.id !== action.id);
      s.comments = s.comments.filter((c) => c.card_id !== action.id);
      s.notifications = s.notifications.filter((n) => n.card_id !== action.id);
      break;
    case "attachment.add": {
      const a = action.attachment;
      card(a.card_id);
      validateFile(a.filename, a.size_bytes);
      if (s.attachments.some((existing) => existing.id === a.id)) break;
      if (
        s.attachments.filter(
          (existing) =>
            existing.card_id === a.card_id &&
            !existing.comment_id &&
            !existing.comment_draft_id,
        ).length >= 20
      )
        throw new Error("Pro Karte sind höchstens 20 Anhänge möglich.");
      s.attachments.push({ ...a, uploaded_by: actor.id, status: "ready" });
      break;
    }
    case "attachment.delete":
      card(s.attachments.find((a) => a.id === action.id)?.card_id || "");
      s.attachments = s.attachments.filter((a) => a.id !== action.id);
      break;
    case "comment.create": {
      const files = action.attachments || [];
      if (
        (!action.body.trim() && !files.length) ||
        action.body.trim().length > 5000
      )
        throw new Error(
          "Bitte einen Kommentar oder eine Datei hinzufügen (max. 5000 Zeichen).",
        );
      const c = card(action.card_id);
      if (
        files.length > 10 ||
        new Set(files.map((a) => a.id)).size !== files.length ||
        files.some(
          (a) =>
            a.card_id !== c.id ||
            a.uploaded_by !== actor.id ||
            a.status !== "ready" ||
            !a.comment_draft_id ||
            a.comment_id ||
            s.attachments.some((old) => old.id === a.id),
        )
      )
        throw new Error("Diese Nachrichtenanhänge sind nicht verfügbar.");
      files.forEach((a) => validateFile(a.filename, a.size_bytes));
      const comment = {
        id: crypto.randomUUID(),
        card_id: c.id,
        author_id: actor.id,
        body: action.body.trim(),
        created_at: now,
        attachment_ids: files.map((a) => a.id),
      };
      const recipients = new Set([
        c.created_by,
        c.assignee_id,
        ...s.comments.filter((m) => m.card_id === c.id).map((m) => m.author_id),
      ]);
      s.comments.push(comment);
      s.attachments.push(
        ...files.map((a) => ({
          ...a,
          comment_id: comment.id,
          comment_draft_id: null,
        })),
      );
      recipients.forEach((id) => {
        if (
          id &&
          id !== actor.id &&
          s.profiles.some(
            (p) => p.id === id && canAccessWorkspace(s, p, c.workspace_id),
          )
        )
          s.notifications.unshift({
            id: crypto.randomUUID(),
            recipient_id: id,
            actor_id: actor.id,
            card_id: c.id,
            comment_id: comment.id,
            body:
              comment.body ||
              `${files.length} ${files.length === 1 ? "Datei" : "Dateien"} angehängt`,
            created_at: now,
            seen_at: null,
          });
      });
      break;
    }
    case "notifications.seen":
      s.notifications.forEach((n) => {
        if (n.recipient_id === actor.id && (!action.id || action.id === n.id))
          n.seen_at = now;
      });
      break;
    case "column.save":
      admin();
      if (
        !s.workspaces.some((w) => w.id === action.column.workspace_id) ||
        s.columns.some(
          (c) =>
            c.id === action.column.id &&
            c.workspace_id !== action.column.workspace_id,
        )
      )
        throw new Error(
          "Der Workspace einer Spalte kann nicht geändert werden.",
        );
      if (
        action.column.kind !== "project" ||
        s.columns.some((c) => c.id === action.column.id && c.kind !== "project")
      )
        throw new Error(
          "In Arbeit und Fertig sind feste Spalten und können nicht bearbeitet werden.",
        );
      if (
        ["fertig", "in arbeit"].includes(
          action.column.name.trim().toLowerCase(),
        )
      )
        throw new Error(
          "Dieser Name ist für eine feste Status-Spalte reserviert.",
        );
      if (!action.column.name.trim()) throw new Error("Ein Name fehlt.");
      s.columns = [
        ...s.columns.filter((c) => c.id !== action.column.id),
        action.column,
      ].sort((a, b) => a.position - b.position);
      break;
    case "column.delete":
      admin();
      if (s.columns.some((c) => c.id === action.id && c.kind !== "project"))
        throw new Error(
          "In Arbeit und Fertig sind feste Spalten und können nicht gelöscht werden.",
        );
      if (
        s.cards.some(
          (c) =>
            c.column_id === action.id ||
            c.project_id === action.id ||
            c.return_column_id === action.id,
        ) ||
        s.profiles.some((p) => p.default_column_id === action.id)
      )
        throw new Error(
          "Die Spalte wird noch von Karten oder Mitgliedern verwendet.",
        );
      s.columns = s.columns.filter((c) => c.id !== action.id);
      break;
    case "label.save":
      if (!action.label.name.trim()) throw new Error("Ein Name fehlt.");
      access(action.label.workspace_id || actor.default_workspace_id);
      if (
        s.labels.some(
          (l) =>
            l.id === action.label.id &&
            (l.workspace_id || s.workspaces[0].id) !==
              (action.label.workspace_id || actor.default_workspace_id),
        )
      )
        throw new Error(
          "Der Workspace eines Labels kann nicht geändert werden.",
        );
      s.labels = [
        ...s.labels.filter((l) => l.id !== action.label.id),
        {
          ...action.label,
          workspace_id: action.label.workspace_id || actor.default_workspace_id,
        },
      ];
      break;
    case "profile.save":
      admin();
      if (
        !s.workspaces.some(
          (w) => w.id === action.profile.default_workspace_id,
        ) ||
        (action.profile.default_column_id &&
          !s.columns.some(
            (c) =>
              c.id === action.profile.default_column_id &&
              c.kind === "project" &&
              c.workspace_id === action.profile.default_workspace_id,
          ))
      )
        throw new Error(
          "Bitte Workspace und passendes Standardprojekt wählen.",
        );
      if (
        action.profile.id === actor.id &&
        (!action.profile.active || action.profile.role !== "admin")
      )
        throw new Error(
          "Du kannst deinen eigenen Admin-Zugang nicht entfernen.",
        );
      if (
        s.profiles.some(
          (p) =>
            p.id !== action.profile.id &&
            p.email.toLowerCase() === action.profile.email.toLowerCase(),
        )
      )
        throw new Error("Diese E-Mail wird bereits verwendet.");
      s.profiles = [
        ...s.profiles.filter((p) => p.id !== action.profile.id),
        action.profile,
      ];
      break;
  }
  return s;
}
