import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Eye,
  Mail,
  MessageSquare,
  Plus,
} from "lucide-react";
import {
  loadEmailNotificationPreferences,
  saveEmailNotificationSettings,
  saveProjectEmailPreference,
  saveWorkspaceEmailPreference,
} from "../data";
import {
  defaultEmailNotificationPreferences,
  emailEventKeys,
  type EmailEventKey,
  type EmailNotificationPreferences,
} from "../email-preferences";
import type { Column, Workspace } from "../types";
import { Toggle } from "./ui/Toggle";

const eventDetails: Record<EmailEventKey, {
  title: string;
  description: string;
  icon: ReactNode;
}> = {
  card_created: {
    title: "Neue Karten",
    description: "Wenn eine Karte erstellt wird",
    icon: <Plus size={15} />,
  },
  comment_created: {
    title: "Kommentare",
    description: "Wenn jemand etwas schreibt",
    icon: <MessageSquare size={14} />,
  },
  card_reviewed: {
    title: "Wahrgenommen",
    description: "Wenn eine Karte gelesen wird",
    icon: <Eye size={15} />,
  },
  card_completed: {
    title: "Erledigte Karten",
    description: "Wenn eine Karte fertig ist",
    icon: <CheckCheck size={15} />,
  },
  card_archived: {
    title: "Archivierte Karten",
    description: "Wenn eine Karte archiviert wird",
    icon: <Archive size={14} />,
  },
};

export function EmailPreferences({
  userId,
  workspaces,
  columns,
  activeWorkspaceId,
  demo,
}: {
  userId: string;
  workspaces: Workspace[];
  columns: Column[];
  activeWorkspaceId: string;
  demo: boolean;
}) {
  const [preferences, setPreferences] = useState<EmailNotificationPreferences>(
    defaultEmailNotificationPreferences,
  );
  const [loading, setLoading] = useState(!demo);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expanded, setExpanded] = useState(() => new Set([activeWorkspaceId]));
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!activeWorkspaceId) return;
    setExpanded((current) => {
      if (current.has(activeWorkspaceId)) return current;
      const next = new Set(current);
      next.add(activeWorkspaceId);
      return next;
    });
  }, [activeWorkspaceId]);
  useEffect(() => {
    if (demo) return;
    let active = true;
    setLoading(true);
    loadEmailNotificationPreferences(userId)
      .then((next) => {
        if (!active) return;
        preferencesRef.current = next;
        setPreferences(next);
      })
      .catch(() => { if (active) setSaveState("error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, userId]);

  const queueSave = (operation: () => Promise<void>) => {
    if (demo) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(operation)
      .then(() => {
        if (!mounted.current) return;
        setSaveState("saved");
      })
      .catch(() => {
        if (!mounted.current) return;
        setSaveState("error");
      });
  };

  const setSettings = (patch: Partial<EmailNotificationPreferences["settings"]>) => {
    const next = { ...preferencesRef.current.settings, ...patch };
    const nextPreferences = { ...preferencesRef.current, settings: next };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    queueSave(() => saveEmailNotificationSettings(userId, next));
  };

  const setWorkspace = (workspaceId: string, enabled: boolean) => {
    const next = {
      ...preferencesRef.current,
      workspaces: { ...preferencesRef.current.workspaces, [workspaceId]: enabled },
    };
    preferencesRef.current = next;
    setPreferences(next);
    queueSave(() => saveWorkspaceEmailPreference(userId, workspaceId, enabled));
  };

  const setProject = (projectId: string, enabled: boolean) => {
    const next = {
      ...preferencesRef.current,
      projects: { ...preferencesRef.current.projects, [projectId]: enabled },
    };
    preferencesRef.current = next;
    setPreferences(next);
    queueSave(() => saveProjectEmailPreference(userId, projectId, enabled));
  };

  return (
    <section className="email-preferences" aria-labelledby="email-preferences-title">
      <header className="email-preferences-heading">
        <span className="email-preferences-mark"><Mail size={16} /></span>
        <div>
          <h3 id="email-preferences-title">E-Mail-Benachrichtigungen</h3>
          <p>Nur das, was für dich wichtig ist.</p>
        </div>
        <Toggle
          label="Alle E-Mail-Benachrichtigungen"
          checked={preferences.settings.enabled}
          disabled={loading}
          onCheckedChange={(enabled) => setSettings({ enabled })}
        />
      </header>

      {loading ? (
        <div className="email-preferences-loading" aria-label="E-Mail-Einstellungen werden geladen">
          <span /><span /><span />
        </div>
      ) : (
        <div className={!preferences.settings.enabled ? "email-preferences-content is-muted" : "email-preferences-content"}>
          <div className="email-preferences-section">
            <div className="email-preferences-label">
              <span>EREIGNISSE</span>
              <small>Was darf eine E-Mail auslösen?</small>
            </div>
            <div className="email-event-list">
              {emailEventKeys.map((key) => (
                <div className="email-event-row" key={key}>
                  <span className="email-event-icon">{eventDetails[key].icon}</span>
                  <div>
                    <b>{eventDetails[key].title}</b>
                    <small>{eventDetails[key].description}</small>
                  </div>
                  <Toggle
                    label={eventDetails[key].title}
                    checked={preferences.settings[key]}
                    disabled={!preferences.settings.enabled}
                    onCheckedChange={(enabled) => setSettings({ [key]: enabled })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="email-preferences-section">
            <div className="email-preferences-label">
              <span>BEREICHE</span>
              <small>Feinsteuerung nach Workspace und Projekt</small>
            </div>
            <div className="email-scope-list">
              {workspaces.map((workspace) => {
                const open = expanded.has(workspace.id);
                const workspaceEnabled = preferences.workspaces[workspace.id] ?? true;
                const projects = columns
                  .filter((column) => column.workspace_id === workspace.id && column.kind === "project")
                  .sort((a, b) => a.position - b.position);
                return (
                  <section className="email-scope" key={workspace.id}>
                    <div className="email-scope-heading">
                      <button
                        type="button"
                        className="email-scope-expand"
                        aria-expanded={open}
                        onClick={() => setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(workspace.id)) next.delete(workspace.id);
                          else next.add(workspace.id);
                          return next;
                        })}
                      >
                        <i className={`dot ${workspace.color}`} />
                        <span><b>{workspace.name}</b><small>{projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}</small></span>
                        <ChevronDown size={15} />
                      </button>
                      <Toggle
                        label={`E-Mails für ${workspace.name}`}
                        checked={workspaceEnabled}
                        disabled={!preferences.settings.enabled}
                        onCheckedChange={(enabled) => setWorkspace(workspace.id, enabled)}
                      />
                    </div>
                    <div
                      className={`email-projects${open ? " is-open" : ""}`}
                      aria-hidden={!open}
                      inert={!open}
                    >
                      <div>
                        {projects.length ? projects.map((project) => (
                          <div className="email-project-row" key={project.id}>
                            <i className={`dot ${project.color}`} />
                            <span>{project.name}</span>
                            <Toggle
                              label={`E-Mails für ${project.name}`}
                              checked={preferences.projects[project.id] ?? true}
                              disabled={!preferences.settings.enabled || !workspaceEnabled}
                              onCheckedChange={(enabled) => setProject(project.id, enabled)}
                            />
                          </div>
                        )) : <p>Keine Projekte in diesem Workspace.</p>}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <footer className={`email-preferences-status is-${saveState}`}>
        {saveState === "error" ? <CircleAlert size={13} /> : <span className="live-dot" />}
        {saveState === "saving"
          ? "Wird gespeichert …"
          : saveState === "saved"
            ? demo ? "Vorschau gespeichert" : "Einstellungen gespeichert"
            : saveState === "error"
              ? "Speichern fehlgeschlagen. Bitte erneut versuchen."
              : "In-App-Neuigkeiten bleiben immer aktiv."}
      </footer>
    </section>
  );
}
