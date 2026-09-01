import { applyDemoAction, canAccessWorkspace, type Action } from "./domain";
import type { BoardState, Card, Profile } from "./types";
import type { EditOperation, EditReceipt } from "./card-edit-session";

type Session = EditReceipt & {
  owner: string;
  initial: BoardState;
  fingerprint: string;
  conflicted: boolean;
  addedComments: string[];
  addedAttachments: string[];
  removedAttachments: string[];
  addedNotifications: string[];
};
const fields = [
  "title",
  "description",
  "assignee_id",
  "label_ids",
  "checklists",
  "column_id",
  "completed_at",
  "reviewed_at",
] as const;
const fingerprint = (state: BoardState, id: string) =>
  JSON.stringify([
    state.cards.find((c) => c.id === id),
    state.comments.filter((c) => c.card_id === id),
    state.attachments.filter((a) => a.card_id === id),
  ]);

// Device-only parity for the demo, deliberately not a security boundary.
export class DemoCardSessions {
  sessions = new Map<string, Session>();
  operate(
    state: BoardState,
    actor: Profile,
    id: string,
    operation: EditOperation,
    cardId: string,
    action?: Action,
  ) {
    let next = state;
    let garbage: string[] = [];
    const now = new Date().toISOString();
    if (operation === "begin" && !this.sessions.has(id)) {
      const card = state.cards.find((c) => c.id === cardId);
      if (!card || !canAccessWorkspace(state, actor, card.workspace_id))
        throw new Error("Karte nicht verfügbar.");
      this.sessions.set(id, {
        id,
        card_id: cardId,
        title: card.title,
        owner: actor.id,
        opened_at: now,
        initial: structuredClone(state),
        fingerprint: fingerprint(state, cardId),
        conflicted: false,
        events: [],
        addedComments: [],
        addedAttachments: [],
        removedAttachments: [],
        addedNotifications: [],
      });
    }
    const s = this.sessions.get(id);
    const initialCard = s?.initial.cards.find((c) => c.id === cardId);
    if (
      !s ||
      s.owner !== actor.id ||
      s.card_id !== cardId ||
      !initialCard ||
      !canAccessWorkspace(state, actor, initialCard.workspace_id)
    )
      throw new Error("Diese Änderungssitzung ist nicht verfügbar.");
    if (operation === "mutate" && action) {
      if (s.closed_at) throw new Error("Diese Kartenansicht ist geschlossen.");
      if (fingerprint(state, cardId) !== s.fingerprint) s.conflicted = true;
      const before = state.cards.find((c) => c.id === cardId)!;
      next = applyDemoAction(state, actor, action);
      s.addedNotifications.push(
        ...next.notifications
          .filter((item) => !state.notifications.some((old) => old.id === item.id))
          .map((item) => item.id),
      );
      const after = next.cards.find((c) => c.id === cardId);
      for (const field of fields) {
        if (
          after &&
          JSON.stringify(before[field]) !== JSON.stringify(after[field])
        )
          s.events.push({
            field,
            before: before[field],
            after: after[field],
            at: now,
          });
      }
      if (action.type === "comment.create") {
        const added = next.comments.filter(
          (c) => !state.comments.some((old) => old.id === c.id),
        );
        s.addedComments.push(...added.map((c) => c.id));
        for (const file of action.attachments || [])
          s.events.push({
            field: "comment_attachment",
            before: null,
            after: file.filename,
            at: now,
          });
        s.addedAttachments.push(...(action.attachments || []).map((a) => a.id));
        s.events.push({
          field: "comment",
          before: null,
          after: action.body,
          at: now,
        });
      }
      if (action.type === "attachment.add") {
        s.addedAttachments.push(action.attachment.id);
        s.events.push({
          field: "attachment",
          before: null,
          after: action.attachment.filename,
          at: now,
        });
      }
      if (action.type === "attachment.delete") {
        s.removedAttachments.push(action.id);
        s.events.push({
          field: "attachment",
          before: state.attachments.find((a) => a.id === action.id)?.filename,
          after: null,
          at: now,
        });
      }
      if (action.type === "card.delete")
        s.events.push({
          field: "deleted_at",
          before: null,
          after: now,
          at: now,
        });
      s.fingerprint = fingerprint(next, cardId);
    }
    if (operation === "close") {
      s.closed_at ||= now;
      if (!s.events.length) this.sessions.delete(id);
    }
    if (operation === "undo") {
      if (!s.closed_at) throw new Error("Karte zuerst schließen.");
      if (s.conflicted || fingerprint(state, cardId) !== s.fingerprint)
        throw new Error(
          "Die Karte wurde inzwischen anderweitig geändert. Zum Schutz dieser Änderungen ist Rückgängigmachen nicht möglich.",
        );
      next = structuredClone(state);
      next.cards = [
        ...next.cards.filter((c) => c.id !== cardId),
        { ...initialCard, updated_at: now } as Card,
      ];
      next.comments = [
        ...next.comments.filter((c) => c.card_id !== cardId),
        ...s.initial.comments.filter((c) => c.card_id === cardId),
      ];
      next.attachments = [
        ...next.attachments.filter((a) => a.card_id !== cardId),
        ...s.initial.attachments.filter((a) => a.card_id === cardId),
      ];
      const initialNotifications = s.initial.notifications.filter(
        (notification) => notification.card_id === cardId,
      );
      const initialNotificationIds = new Set(
        initialNotifications.map((notification) => notification.id),
      );
      next.notifications = next.notifications.filter(
        (notification) =>
          !s.addedNotifications.includes(notification.id) &&
          !initialNotificationIds.has(notification.id),
      );
      next.notifications.push(...structuredClone(initialNotifications));
      garbage = s.addedAttachments;
      this.sessions.delete(id);
    }
    if (operation === "discard") {
      garbage = [
        ...s.removedAttachments,
        ...s.addedAttachments.filter(
          (id) => !next.attachments.some((a) => a.id === id),
        ),
      ];
      if (!next.cards.some((c) => c.id === cardId))
        garbage.push(
          ...s.initial.attachments
            .filter((a) => a.card_id === cardId)
            .map((a) => a.id),
        );
      this.sessions.delete(id);
    }
    return {
      state: next,
      receipt: {
        id: s.id,
        card_id: s.card_id,
        title: s.title,
        opened_at: s.opened_at,
        closed_at: s.closed_at,
        events: s.events,
      },
      garbage,
    };
  }
}
