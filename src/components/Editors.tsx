import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  CheckCheck,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { Dialog } from "./ui/Dialog";
import { Select } from "./ui/Select";
import { NumberField } from "./ui/NumberField";
import { Toggle } from "./ui/Toggle";
import { Avatar } from "./Board";
import { Attachments } from "./Attachments";
import type { CardEditSession } from "../card-edit-session";
import { CardTextField } from "./ui/CardTextField";
import { useCommentViewport } from "./useCommentViewport";
import { CommentComposer } from "./CommentComposer";
import { CommentAttachments } from "./CommentAttachments";
import { Checklists } from "./Checklists";
import { ChecklistBuilder } from "./ChecklistBuilder";
import {
  checklistFromDescription,
  checklistsForNewCard,
} from "../checklist-drafts";
import {
  colors,
  colorNames,
  timestamp,
  type BoardState,
  type Card,
  type Column,
  type Color,
  type Label,
  type Profile,
} from "../types";
import { orderedColumns, type Action } from "../domain";
import { cardReadLabel } from "../card-review";
type EditorProps = {
  state: BoardState;
  current: Profile;
  mutate: (a: Action) => Promise<boolean>;
  busy: boolean;
  close: () => void;
};
export function ColorPicker({
  value,
  onChange,
}: {
  value: Color;
  onChange: (c: Color) => void;
}) {
  return (
    <div className="palette" role="group" aria-label="Farbe auswählen">
      <div className="color-picker">
        {colors.map((c) => (
          <button
            type="button"
            className={`color-swatch ${c} ${c === value ? "selected" : ""}`}
            key={c}
            onClick={() => onChange(c)}
            aria-label={`Farbe ${colorNames[c]}`}
            aria-pressed={c === value}
          >
            {c === value && <Check size={14} />}
          </button>
        ))}
      </div>
      <div className="palette-caption">
        <span>{colorNames[value]}</span>
        <small>16 Pastelltöne</small>
      </div>
    </div>
  );
}

export function CardEditor({
  state,
  current,
  mutate: generalMutate,
  busy,
  close,
  card,
  initialColumn,
  editLabels,
  workspaceId,
  session,
}: EditorProps & {
  workspaceId: string;
  card?: Card;
  initialColumn?: string;
  editLabels: () => void;
  session?: CardEditSession;
}) {
  const mutate = session?.mutate || generalMutate;
  const [title, setTitle] = useState(card?.title || "");
  const [description, setDescription] = useState(card?.description || "");
  const fallback =
    state.columns.find(
      (c) => c.id === current.default_column_id && c.kind === "project",
    )?.id ||
    state.columns.find((c) => c.kind === "project")?.id ||
    "";
  const [columnId, setColumnId] = useState(
    card?.column_id ||
      state.columns.find((c) => c.id === initialColumn && c.kind === "project")
        ?.id ||
      fallback,
  );
  const [assignee, setAssignee] = useState(
    card ? card.assignee_id || "" : current.id,
  );
  const [labels, setLabels] = useState(card?.label_ids || []);
  const [draftChecklists, setDraftChecklists] = useState<NonNullable<Card["checklists"]>>([]);
  const [sendingComment, setSendingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const priorText = useRef({
    title: card?.title,
    description: card?.description,
  });
  useEffect(() => {
    const prior = priorText.current;
    if (card) {
      setTitle((value) => (value === prior.title ? card.title : value));
      setDescription((value) =>
        value === prior.description ? card.description : value,
      );
      priorText.current = { title: card.title, description: card.description };
    }
  }, [card?.title, card?.description]);
  const [uploading, setUploading] = useState(false);
  const comments = state.comments
    .filter((c) => c.card_id === card?.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const commentViewport = useCommentViewport(
    card?.id,
    comments.at(-1),
    current.id,
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (uploading || card) return;
    const newId = crypto.randomUUID();
    const ok = await mutate({
      type: "card.create",
      id: newId,
      title: title.trim(),
      description,
      column_id: columnId,
      project_id: columnId,
      assignee_id: assignee || null,
      label_ids: labels,
      checklists: checklistsForNewCard(description, draftChecklists),
    });
    if (ok) close();
  }
  return (
    <Dialog
      wide
      title={card ? card.title : "Was steht als Nächstes an?"}
      description={
        card ? (
          <>
            Erstellt von{" "}
            {state.profiles.find((p) => p.id === card.created_by)?.name ||
              "Unbekanntes Mitglied"}{" "}
            · <time dateTime={card.created_at}>{timestamp(card.created_at)}</time>
          </>
        ) : (
          "Eine Idee, eine Aufgabe – und ein klarer Platz dafür."
        )
      }
      onClose={close}
      closeOnOutside
    >
      <div className="card-detail">
        <form className="detail-main" onSubmit={submit}>
          <p className="form-hint">
            Workspace ·{" "}
            {state.workspaces.find((w) => w.id === workspaceId)?.name}
          </p>
          <CardTextField
            label="Titel"
            value={title}
            savedValue={card?.title}
            onChange={setTitle}
            autoFocus
            maxLength={180}
            disabled={busy}
            placeholder="Was möchtest du erledigen?"
            onSave={
              card
                ? async (value) => {
                    const ok = await mutate({
                      type: "card.update",
                      id: card.id,
                      patch: { title: value.trim() },
                    });
                    if (ok)
                      setTitle((draft) =>
                        draft === value ? value.trim() : draft,
                      );
                    return ok;
                  }
                : undefined
            }
          />
          <div className="field-row">
            <label className="field">
              {card ? "Verschieben nach" : "Spalte"}
              <Select
                label={card ? "Verschieben nach" : "Spalte"}
                value={card?.column_id || columnId}
                onValueChange={(next) => {
                  if (card)
                    void mutate({
                      type: "card.move",
                      id: card.id,
                      column_id: next,
                    });
                  else setColumnId(next);
                }}
                disabled={busy || uploading}
                options={orderedColumns(state.columns)
                  .filter((c) => card || c.kind === "project")
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: <i className={`select-color ${c.color}`} />,
                  }))}
              />
            </label>
            <label className="field">
              Zugewiesen an
              <Select
                label="Zugewiesen an"
                value={card ? card.assignee_id || "" : assignee}
                disabled={busy}
                onValueChange={(value) =>
                  card
                    ? void mutate({
                        type: "card.update",
                        id: card.id,
                        patch: { assignee_id: value || null },
                      })
                    : setAssignee(value)
                }
                options={[
                  {
                    value: "",
                    label: "Niemand",
                    icon: <UserRound size={15} />,
                  },
                  ...state.profiles
                    .filter((p) => p.active)
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                      icon: <Avatar profile={p} small tooltip={false} />,
                    })),
                ]}
              />
            </label>
          </div>
          <div className="field">
            <span className="field-title">
              Labels{" "}
              <button
                type="button"
                className="text-button"
                onClick={editLabels}
                disabled={busy || uploading}
              >
                <Plus size={12} />
                Verwalten
              </button>
            </span>
            <div className="label-selector">
              {state.labels.map((l) => (
                <button
                  type="button"
                  key={l.id}
                  aria-pressed={(card?.label_ids || labels).includes(l.id)}
                  className={`label ${l.color} ${(card?.label_ids || labels).includes(l.id) ? "chosen" : "unchosen"}`}
                  disabled={busy}
                  onClick={() =>
                    card
                      ? void mutate({
                          type: "card.update",
                          id: card.id,
                          patch: {
                            label_ids: card.label_ids.includes(l.id)
                              ? card.label_ids.filter((id) => id !== l.id)
                              : [...card.label_ids, l.id],
                          },
                        })
                      : setLabels((v) =>
                          v.includes(l.id)
                            ? v.filter((id) => id !== l.id)
                            : [...v, l.id],
                        )
                  }
                >
                  {(card?.label_ids || labels).includes(l.id) ? (
                    <Check size={11} />
                  ) : (
                    <Tag size={11} />
                  )}
                  {l.name}
                </button>
              ))}
            </div>
          </div>
          <CardTextField
            label="Beschreibung"
            multiline
            value={description}
            savedValue={card?.description}
            onChange={setDescription}
            maxLength={20000}
            disabled={busy}
            placeholder="Ein bisschen Kontext macht Zusammenarbeit leichter …"
            onSave={
              card
                ? (value) =>
                    mutate({
                      type: "card.update",
                      id: card.id,
                      patch: { description: value },
                    })
                : undefined
            }
          />
          {!card && (
            <ChecklistBuilder
              value={draftChecklists}
              automatic={checklistFromDescription(description)}
              disabled={busy || uploading}
              onChange={setDraftChecklists}
            />
          )}
          {card?.due_at && <p className="form-hint">Fällig · <time dateTime={card.due_at}>{timestamp(card.due_at)}</time></p>}
          {card?.checklists?.length ? <Checklists lists={card.checklists} disabled={busy}
            save={(checklists) => mutate({ type: "card.update", id: card.id, patch: { checklists } })} /> : null}
          {card ? (
            <Attachments
              cardId={card.id}
              actorId={current.id}
              items={state.attachments.filter(
                (a) =>
                  a.card_id === card.id && !a.comment_id && !a.comment_draft_id,
              )}
              mutate={mutate}
              disabled={busy || sendingComment}
              onBusyChange={setUploading}
              session={session}
            />
          ) : (
            <p className="form-hint">
              Nach dem Erstellen kannst du hier Screenshots und Dateien
              anhängen.
            </p>
          )}
          {card && (
            <div className="detail-status">
              <button
                type="button"
                disabled={busy || uploading}
                className={card.completed_at ? "green-text" : ""}
                aria-pressed={!!card.completed_at}
                aria-label={
                  card.completed_at ? "Karte wieder öffnen" : "Karte erledigen"
                }
                onClick={() =>
                  void mutate({
                    type: "card.complete",
                    id: card.id,
                    completed: !card.completed_at,
                  })
                }
              >
                <Check size={15} />
                {card.completed_at ? "Erledigt" : "Offen"}
              </button>
              <button
                type="button"
                disabled={busy || uploading}
                className={card.reviewed_at ? "blue-text" : ""}
                aria-pressed={!!card.reviewed_at}
                aria-label={
                  card.reviewed_at
                    ? `${cardReadLabel(card, state.profiles)}. Gelesen-Markierung entfernen`
                    : "Karte als gelesen markieren"
                }
                onClick={() =>
                  void mutate({
                    type: "card.review",
                    id: card.id,
                    reviewed: !card.reviewed_at,
                  })
                }
              >
                <CheckCheck size={17} />
                {cardReadLabel(card, state.profiles)}
              </button>
            </div>
          )}
          <div className="form-footer">
            {!card && (
              <button
                type="submit"
                className="primary"
                disabled={
                  busy || uploading || !title.trim() || (!card && !columnId)
                }
              >
                {
                  <>
                    <Plus size={15} />
                    Karte erstellen
                  </>
                }
              </button>
            )}
            {card && (
              <p className="form-hint card-save-hint">
                Auswahl & Anhänge speichern sofort. Texte mit „Speichern“
                bestätigen.
              </p>
            )}
            {card && (
              <button
                type="button"
                className="icon-button danger"
                aria-label="Karte löschen"
                disabled={busy || uploading}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {confirmDelete && (
            <div className="inline-confirm">
              <p>
                Karte mit Kommentaren und Anhängen löschen? Danach kurz
                rückgängig machbar.
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Behalten
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy || uploading}
                onClick={async () => {
                  if (
                    card &&
                    (await mutate({ type: "card.delete", id: card.id }))
                  )
                    close();
                }}
              >
                Ja, löschen
              </button>
            </div>
          )}
        </form>
        <aside className="comments-panel" ref={commentViewport.attachPanel}>
          <h3>
            <MessageSquare size={16} />
            Kommentare <span>{comments.length}</span>
          </h3>
          <div
            className="comment-list"
            ref={commentViewport.attachList}
            onScroll={commentViewport.onListScroll}
            role="region"
            aria-label="Kommentarverlauf"
            tabIndex={0}
          >
            <div
              className={`comment-thread${comments.length ? "" : " is-empty"}`}
            >
              {comments.length ? (
                comments.map((c) => (
                  <div className="comment" key={c.id}>
                    <Avatar
                      profile={state.profiles.find((p) => p.id === c.author_id)}
                    />
                    <div>
                      <b>
                        {state.profiles.find((p) => p.id === c.author_id)
                          ?.name || "Ehemaliges Mitglied"}
                      </b>
                      <time dateTime={c.created_at}>
                        {timestamp(c.created_at)}
                      </time>
                      <CommentAttachments
                        items={state.attachments.filter(
                          (a) => a.comment_id === c.id && a.status === "ready",
                        )}
                      />
                      {c.body && <p>{c.body}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="comments-empty">
                  <MessageSquare size={28} />
                  <b>Hier beginnt der Austausch.</b>
                  <p>
                    {card
                      ? "Fragen, Feedback oder ein kurzes Update – alles hat hier seinen Platz."
                      : "Erstelle die Karte, um Kommentare zu schreiben."}
                  </p>
                </div>
              )}
            </div>
          </div>
          {card && (
            <CommentComposer
              key={card.id}
              cardId={card.id}
              actorId={current.id}
              disabled={busy || uploading}
              mutate={mutate}
              session={session}
              onBusyChange={setSendingComment}
            />
          )}
        </aside>
      </div>
    </Dialog>
  );
}

export function ColumnEditor({
  state,
  current: _current,
  mutate,
  busy,
  close,
  column,
  workspaceId,
}: EditorProps & { column?: Column; workspaceId: string }) {
  const [name, setName] = useState(column?.name || "");
  const [color, setColor] = useState<Color>(column?.color || "green");
  const [position, setPosition] = useState(
    column?.position ??
      Math.max(
        -1,
        ...state.columns
          .filter((c) => c.kind === "project")
          .map((c) => c.position),
      ) + 1,
  );
  const [deleting, setDeleting] = useState(false);
  const used =
    !!column &&
    (state.cards.some(
      (c) => c.column_id === column.id || c.project_id === column.id,
    ) ||
      state.profiles.some((p) => p.default_column_id === column.id));
  return (
    <Dialog
      title={column ? "Spalte bearbeiten" : "Raum für ein neues Projekt."}
      description="Projekte sammeln Aufgaben. In Arbeit und Fertig bleiben als feste Spalten erhalten."
      onClose={close}
    >
      <form
        className="simple-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate({
              type: "column.save",
              column: {
                id: column?.id || crypto.randomUUID(),
                workspace_id: workspaceId,
                name: name.trim(),
                color,
                kind: "project",
                position,
              },
            })
          )
            close();
        }}
      >
        <label className="field">
          Name
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Zum Beispiel Coca-Cola"
          />
        </label>
        <div className="field column-color-field">
          Farbe
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <label className="field">
          Position im Board
          <NumberField
            label="Position im Board"
            value={position}
            onChange={setPosition}
          />
          <small>
            0 = ganz links. Die festen Status-Spalten bleiben rechts.
          </small>
        </label>
        <div className="form-footer">
          <button className="primary" disabled={busy || !name.trim()}>
            Spalte speichern
          </button>
          {column && (
            <button
              type="button"
              className="danger-button"
              disabled={used || busy}
              aria-label={
                used ? "Spalte wird noch verwendet" : "Spalte löschen"
              }
              onClick={() => setDeleting(true)}
            >
              Löschen
            </button>
          )}
        </div>
        {deleting && (
          <div className="inline-confirm">
            <p>Diese leere Spalte löschen?</p>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                if (
                  column &&
                  (await mutate({ type: "column.delete", id: column.id }))
                )
                  close();
              }}
            >
              Endgültig löschen
            </button>
          </div>
        )}
        {used && (
          <p className="form-hint">
            Zum Löschen zuerst alle Karten verschieben und Projektzuweisungen
            entfernen. Projekte mit zugehörigen Karten bleiben erhalten.
          </p>
        )}
      </form>
    </Dialog>
  );
}

export function LabelEditor({
  state,
  workspaceId,
  mutate,
  busy,
  close,
}: Pick<EditorProps, "state" | "mutate" | "busy" | "close"> & {
  workspaceId: string;
}) {
  const [editing, setEditing] = useState<Label | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<Color>("green");
  return (
    <Dialog
      title="Kleine Labels. Große Übersicht."
      description="Diese Labels gehören nur zum aktuellen Workspace."
      onClose={close}
    >
      <div className="simple-form">
        <div className="existing-labels">
          {state.labels.map((l) => (
            <button
              key={l.id}
              className={`label ${l.color}`}
              onClick={() => {
                setEditing(l);
                setName(l.name);
                setColor(l.color);
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutate({
                type: "label.save",
                label: {
                  id: editing?.id || crypto.randomUUID(),
                  workspace_id: workspaceId,
                  name: name.trim(),
                  color,
                },
              })
            ) {
              setEditing(null);
              setName("");
            }
          }}
        >
          <label className="field">
            {editing ? "Label bearbeiten" : "Neues Label"}
            <input
              required
              maxLength={40}
              placeholder="Zum Beispiel Feedback"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <ColorPicker value={color} onChange={setColor} />
          <div className="form-footer">
            <button className="primary" disabled={busy || !name.trim()}>
              {editing ? "Speichern" : "Label erstellen"}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setName("");
                }}
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export function ProfileEditor({
  state,
  current,
  mutate,
  busy,
  close,
  profile,
  demo,
  initialWorkspaceId,
}: EditorProps & {
  profile?: Profile;
  demo: boolean;
  initialWorkspaceId: string;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Profile["role"]>(
    profile?.role || "mitarbeiter",
  );
  const [project, setProject] = useState(profile?.default_column_id || "");
  const [workspaceId, setWorkspaceId] = useState(
    profile?.default_workspace_id || initialWorkspaceId,
  );
  const [color, setColor] = useState<Color>(profile?.color || "green");
  const [active, setActive] = useState(profile?.active ?? true);
  return (
    <Dialog
      title={profile ? "Zugang bearbeiten" : "Willkommen im Team."}
      description="Der Start-Workspace öffnet sich bei der Anmeldung und bestimmt die Zugriffsrechte. Workspace-Sperren gelten für Mitarbeiter, nicht für Admins."
      onClose={close}
    >
      <form
        className="simple-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate({
              type: "profile.save",
              isNew: !profile,
              password: password || undefined,
              profile: {
                id: profile?.id || crypto.randomUUID(),
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role,
                color,
                default_column_id: project || null,
                default_workspace_id: workspaceId,
                active,
              },
            })
          )
            close();
        }}
      >
        <div className="field-row">
          <label className="field">
            Name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            E-Mail
            <input
              required
              type="email"
              value={email}
              disabled={!!profile}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          {profile ? "Neues Passwort (optional)" : "Startpasswort"}
          <input
            type="password"
            autoComplete="new-password"
            required={!profile && !demo}
            minLength={12}
            maxLength={128}
            placeholder="Mindestens 12 Zeichen"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          Start-Workspace
          <Select
            label="Start-Workspace"
            value={workspaceId}
            onValueChange={(id) => {
              setWorkspaceId(id);
              setProject("");
            }}
            options={state.workspaces.map((w) => ({
              value: w.id,
              label: w.name,
              icon: <i className={`select-color ${w.color}`} />,
            }))}
          />
        </label>
        <div className="field-row">
          <label className="field">
            Rolle
            <Select<Profile["role"]>
              label="Rolle"
              disabled={profile?.id === current.id}
              value={role}
              onValueChange={setRole}
              options={[
                {
                  value: "mitarbeiter",
                  label: "Mitarbeiter",
                  description: "Gemeinsam am Board arbeiten",
                },
                {
                  value: "admin",
                  label: "Administrator",
                  description: "Zusätzlich Projekte und Zugänge verwalten",
                },
              ]}
            />
          </label>
          <label className="field">
            Standardprojekt
            <Select
              label="Standardprojekt"
              value={project}
              onValueChange={setProject}
              options={[
                { value: "", label: "Kein Standard" },
                ...state.columns
                  .filter(
                    (c) =>
                      c.kind === "project" && c.workspace_id === workspaceId,
                  )
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: <i className={`select-color ${c.color}`} />,
                  })),
              ]}
            />
          </label>
        </div>
        <div className="field">
          Profilfarbe
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {profile && (
          <div className="toggle-field">
            <Toggle
              label="Zugang aktiv"
              checked={active}
              disabled={profile.id === current.id}
              onCheckedChange={setActive}
            />
            <span>Zugang aktiv</span>
          </div>
        )}
        <p className="form-hint">
          {demo
            ? "Lokale Demo: Es wird kein echter Login angelegt und kein Passwort gespeichert."
            : "Keine automatische E-Mail. Teile das Startpasswort über einen sicheren Kanal. Das Mitglied kann es in seinem Profil ändern."}
        </p>
        <button className="primary" disabled={busy}>
          {profile ? "Änderungen speichern" : "Zugang erstellen"}
        </button>
      </form>
    </Dialog>
  );
}
