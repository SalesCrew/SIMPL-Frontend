import { Bell } from "lucide-react";

export function NotificationBell({
  unreadCount,
  open,
  onClick,
}: {
  unreadCount: number;
  open: boolean;
  onClick: () => void;
}) {
  const hasUnread = unreadCount > 0;
  return (
    <button
      type="button"
      className={`icon-button notification-bell${hasUnread ? " has-unread" : ""}`}
      aria-label={`Neuigkeiten (${unreadCount} ungelesen)`}
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="notification-bell-swing" aria-hidden="true">
        <Bell size={21} strokeWidth={1.8} />
      </span>
      {hasUnread && <i className="notification-bell-dot" aria-hidden="true" />}
    </button>
  );
}
