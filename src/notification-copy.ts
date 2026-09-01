import type { NotificationEventType } from "./types";

const actions: Record<NotificationEventType, string> = {
  "comment.created": "hat kommentiert",
  "card.created": "hat eine Karte erstellt",
  "card.updated": "hat eine Karte aktualisiert",
  "card.moved": "hat eine Karte verschoben",
  "card.completed": "hat eine Karte erledigt",
  "card.reopened": "hat eine Karte wieder geöffnet",
  "card.archived": "hat eine Karte archiviert",
  "card.restored": "hat eine Karte wiederhergestellt",
  "card.reviewed": "hat eine Karte wahrgenommen",
  "card.unreviewed": "hat die Wahrnehmung entfernt",
  "card.deleted": "hat eine Karte gelöscht",
  "attachment.added": "hat eine Datei angehängt",
  "attachment.removed": "hat eine Datei entfernt",
};

export function notificationAction(event: NotificationEventType) {
  return actions[event] || "hat etwas geändert";
}
