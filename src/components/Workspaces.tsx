import { useEffect, useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Settings2,
  ShieldCheck,
  LockKeyhole,
  Network,
  Globe2,
} from "lucide-react";
import { Dialog } from "./ui/Dialog";
import { ColorPicker } from "./Editors";
import {
  initials,
  type BoardState,
  type Profile,
  type Workspace,
} from "../types";
import type { Action } from "../domain";
function workspaceSummary(state: BoardState, id: string) {
  const projects = state.columns.filter(
    (c) => c.workspace_id === id && c.kind === "project",
  ).length;
  const cards = state.cards.filter((c) => c.workspace_id === id).length;
  return `${projects} ${projects === 1 ? "Projekt" : "Projekte"} · ${cards} ${cards === 1 ? "Karte" : "Karten"}`;
}

export function WorkspaceSwitcher({
  state,
  current,
  activeId,
  select,
  edit,
}: {
  state: BoardState;
  current: Profile;
  activeId: string;
  select: (id: string) => void;
  edit: (workspace?: Workspace) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [activeId]);
  const active = state.workspaces.find((w) => w.id === activeId)!;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="workspace-switch"
          aria-label={`Workspace wechseln: ${active.name}`}
        >
          <span className={`workspace-icon ${active.color}`}>
            {initials(active.name)}
          </span>
          <span className="workspace-switch-copy">
            <b>{active.name}</b>
            <small>Unser Workspace</small>
          </span>
          <ChevronsUpDown size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="workspace-popover"
          side="bottom"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Workspace auswählen"
        >
          <header>
            <span className="eyebrow">ZUSAMMEN ARBEITEN</span>
            <h2>Deine Workspaces</h2>
            <p>Ein eigener Platz für jedes Team.</p>
          </header>
          <div className="workspace-options">
            {state.workspaces.map((workspace) => (
              <button
                key={workspace.id}
                className={`workspace-option ${workspace.id === activeId ? "selected" : ""}`}
                aria-pressed={workspace.id === activeId}
                onClick={() => {
                  select(workspace.id);
                  setOpen(false);
                }}
              >
                <span className={`workspace-icon ${workspace.color}`}>
                  {initials(workspace.name)}
                </span>
                <span className="workspace-option-copy">
                  <b>{workspace.name}</b>
                  {workspace.isolated && (
                    <em>
                      <LockKeyhole size={11} /> Isolierter Workspace
                    </em>
                  )}
                  <small>{workspaceSummary(state, workspace.id)}</small>
                  {workspace.id === current.default_workspace_id && (
                    <em>Dein Start-Workspace</em>
                  )}
                </span>
                {workspace.id === activeId && <Check size={16} />}
              </button>
            ))}
          </div>
          {current.role === "admin" && (
            <footer>
              <button
                onClick={() => {
                  setOpen(false);
                  edit();
                }}
              >
                <Plus size={16} />
                Workspace erstellen
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  edit(active);
                }}
              >
                <Settings2 size={15} />
                Workspace bearbeiten
              </button>
            </footer>
          )}
          <p className="workspace-access-note">
            <ShieldCheck size={13} />
            {current.role === "admin"
              ? "Als Admin hast du Zugriff auf alle Workspaces."
              : "Hier siehst du nur deine freigegebenen Workspaces."}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function WorkspaceEditor({
  workspace,
  state,
  mutate,
  busy,
  close,
  created,
}: {
  workspace?: Workspace;
  state: BoardState;
  mutate: (action: Action) => Promise<boolean>;
  busy: boolean;
  close: () => void;
  created: (id: string) => void;
}) {
  const [id] = useState(() => workspace?.id || crypto.randomUUID());
  const [name, setName] = useState(workspace?.name || "");
  const [color, setColor] = useState(workspace?.color || "sage");
  const [blocked, setBlocked] = useState(() =>
    (state.workspace_blocks || [])
      .filter((b) => b.workspace_a === id || b.workspace_b === id)
      .map((b) => (b.workspace_a === id ? b.workspace_b : b.workspace_a)),
  );
  const [mode, setMode] = useState<"open" | "selected" | "isolated">(
    workspace?.isolated ? "isolated" : blocked.length ? "selected" : "open",
  );
  const others = state.workspaces.filter((w) => w.id !== id);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await mutate({
        type: "workspace.save",
        workspace: {
          id,
          name: name.trim(),
          color,
          isolated: mode === "isolated",
        },
        blocked_ids: mode === "selected" ? blocked : [],
      })
    ) {
      if (!workspace) created(id);
      close();
    }
  }
  return (
    <Dialog
      title={workspace ? "Workspace bearbeiten" : "Platz für ein neues Team."}
      description="Ein Platz fürs Team. Du entscheidest, wer Zugang bekommt."
      onClose={close}
    >
      <form className="simple-form" onSubmit={submit}>
        <label className="field">
          Workspace-Name
          <input
            autoFocus
            required
            maxLength={60}
            value={name}
            placeholder="Zum Beispiel Marketing"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="field workspace-color-field">
          Workspace-Farbe
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <fieldset className="access-settings">
          <legend>
            <ShieldCheck size={16} /> Zugriff & Vertraulichkeit
          </legend>
          <p>
            Gilt in beide Richtungen. Maßgeblich ist der zugewiesene
            Start-Workspace – nicht das gerade geöffnete Board.
          </p>
          <div className="access-modes">
            {(
              [
                {
                  value: "open",
                  title: "Offen",
                  text: "Keine eigenen Trennungen. Isolierte Workspaces bleiben ausgeschlossen.",
                  Icon: Globe2,
                },
                {
                  value: "selected",
                  title: "Gezielt trennen",
                  text: "Ausgewählte Workspaces dürfen sich gegenseitig nicht sehen.",
                  Icon: Network,
                },
                {
                  value: "isolated",
                  title: "Vollständig isolieren",
                  text: "Nur das eigene Team. Kein Zugriff hinein – und für dieses Team auch nicht hinaus.",
                  Icon: LockKeyhole,
                },
              ] as const
            ).map(({ value, title, text, Icon }) => (
              <button
                type="button"
                key={value}
                className={`access-mode ${mode === value ? "selected" : ""}`}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                <Icon size={18} />
                <span>
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
                <span className="access-radio">
                  {mode === value && <Check size={11} />}
                </span>
              </button>
            ))}
          </div>
          {mode === "selected" && (
            <div
              className="access-workspaces"
              aria-label="Gegenseitig gesperrte Workspaces"
            >
              <p>Von diesen Workspaces trennen:</p>
              {!others.length && (
                <p className="form-hint">
                  Erstelle zuerst einen weiteren Workspace.
                </p>
              )}
              {others.map((other) => (
                <button
                  type="button"
                  key={other.id}
                  role="checkbox"
                  aria-checked={blocked.includes(other.id)}
                  className={`access-workspace ${blocked.includes(other.id) ? "selected" : ""}`}
                  onClick={() =>
                    setBlocked((ids) =>
                      ids.includes(other.id)
                        ? ids.filter((value) => value !== other.id)
                        : [...ids, other.id],
                    )
                  }
                >
                  <span className={`workspace-icon ${other.color}`}>
                    {initials(other.name)}
                  </span>
                  <span>
                    <b>{other.name}</b>
                    {other.isolated && (
                      <small>Bereits vollständig isoliert</small>
                    )}
                  </span>
                  <span className="access-check">
                    {blocked.includes(other.id) && <Check size={13} />}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="access-assurance">
            <ShieldCheck size={15} /> Admins behalten immer Vollzugriff. Nur
            Admins können diese Regeln ändern. Bereits heruntergeladene Kopien
            bleiben erhalten.
          </p>
        </fieldset>
        {!workspace && (
          <p className="form-hint">
            Dein neues Board startet mit Allgemein, In Arbeit und Fertig.
            Weitere Projekte kannst du jederzeit ergänzen. Den Start-Workspace
            deiner Mitglieder legst du unter Team & Zugänge fest.
          </p>
        )}
        <button
          className="primary"
          disabled={
            busy || !name.trim() || (mode === "selected" && !blocked.length)
          }
        >
          {workspace ? "Workspace speichern" : "Workspace erstellen"}
        </button>
      </form>
    </Dialog>
  );
}
