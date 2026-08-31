import { Archive, CheckCheck, ChevronRight, LockKeyhole, MessageSquare, Paperclip, Search } from "lucide-react";
import type { BoardState, Card } from "../types";
import { timestamp } from "../types";
import { Dialog } from "./ui/Dialog";
import { Avatar } from "./Board";
import { CommentAttachments } from "./CommentAttachments";
import { Checklists } from "./Checklists";
import { cardReadLabel } from "../card-review";

export function ArchiveHeading() {
  return <section className="board-heading archive-heading">
    <div>
      <h1>Archiv<span className="title-dot">.</span></h1>
      <p>Abgelegte Karten, Kommentare und Dateien an einem Ort.</p>
    </div>
    <span className="archive-read-only"><LockKeyhole size={13} aria-hidden="true" />Nur zum Nachlesen</span>
  </section>;
}

export function groupArchivedCards(cards: Card[]) {
  const months = new Map<string, { key: string; label: string; cards: Card[] }>();
  const formatter = new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" });
  const sorted = cards.filter((card) => card.archived_at).sort((a, b) =>
    Date.parse(b.archived_at!) - Date.parse(a.archived_at!) || a.position - b.position || a.id.localeCompare(b.id));
  for (const card of sorted) {
    const date = new Date(card.archived_at!);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    if (!months.has(key)) months.set(key, { key, label: formatter.format(date), cards: [] });
    months.get(key)!.cards.push(card);
  }
  return [...months.values()];
}

export function ArchiveList({ cards, state, open, filtered = false, reset }: {
  cards: Card[]; state: BoardState; open: (id: string) => void;
  filtered?: boolean; reset?: () => void;
}) {
  const commentCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();
  const columns = new Map(state.columns.map((column) => [column.id, column]));
  for (const comment of state.comments) commentCounts.set(comment.card_id, (commentCounts.get(comment.card_id) || 0) + 1);
  for (const file of state.attachments) if (file.status === "ready") fileCounts.set(file.card_id, (fileCounts.get(file.card_id) || 0) + 1);
  const groups = groupArchivedCards(cards);
  return <div className="board-content archive-content">
    <section className="archive-list" aria-label="Archivierte Karten">
      {!groups.length && <div className="archive-empty">
        {filtered ? <Search size={24} /> : <Archive size={24} />}
        <h2>{filtered ? "Keine passenden Karten." : "Das Archiv ist noch leer."}</h2>
        <p>{filtered ? "Passe die Suche oder deine Filter an." : "Archivierte Karten bleiben hier mit allen Inhalten erhalten."}</p>
        {filtered && reset && <button type="button" className="secondary" onClick={reset}>Filter zurücksetzen</button>}
      </div>}
      {groups.map((group) => <section className="archive-month" key={group.key} aria-labelledby={`archive-month-${group.key}`}>
        <header className="archive-month-heading">
          <h2 id={`archive-month-${group.key}`}>{group.label}</h2>
          <span>{group.cards.length} {group.cards.length === 1 ? "Karte" : "Karten"}</span>
        </header>
        {group.cards.map((card) => {
          const comments = commentCounts.get(card.id) || 0;
          const files = fileCounts.get(card.id) || 0;
          const project = card.project_id ? columns.get(card.project_id) : undefined;
          const column = columns.get(card.column_id);
          return <button type="button" className="archive-row" key={card.id} onClick={() => open(card.id)} aria-label={`${card.title} öffnen`}>
            <span className="archive-row-icon" aria-hidden="true"><Archive size={17} /></span>
            <span className="archive-row-copy">
              <b>{card.title}</b>
              <span className="archive-row-context">
                <span className="archive-project"><i className={`dot ${project?.color || "slate"}`} aria-hidden="true" />{project?.name || "Nicht zugeordnet"}</span>
                {column && column.id !== project?.id && <span className="archive-source-column">{column.name}</span>}
              </span>
            </span>
            <span className="archive-row-aside">
              <time dateTime={card.archived_at!} aria-label={`Archiviert ${timestamp(card.archived_at!)}`}>{timestamp(card.archived_at!)}</time>
              <span className="archive-row-meta">
                {comments > 0 && <span aria-label={`${comments} ${comments === 1 ? "Kommentar" : "Kommentare"}`}><MessageSquare size={12} aria-hidden="true" />{comments}</span>}
                {files > 0 && <span aria-label={`${files} ${files === 1 ? "Anhang" : "Anhänge"}`}><Paperclip size={12} aria-hidden="true" />{files}</span>}
              </span>
            </span>
            <ChevronRight className="archive-row-arrow" size={14} aria-hidden="true" />
          </button>;
        })}
      </section>)}
    </section>
  </div>;
}

export function ArchivedCard({ card, state, close }: { card: Card; state: BoardState; close: () => void }) {
  const comments = state.comments.filter((entry) => entry.card_id === card.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
  return <Dialog wide title={card.title} onClose={close} closeOnOutside description={<>
    Erstellt von {state.profiles.find((p) => p.id === card.created_by)?.name || "Ehemaliges Mitglied"} · <time dateTime={card.created_at}>{timestamp(card.created_at)}</time>
  </>}>
    <div className="card-detail archived-detail">
      <section className="detail-main">
        <p className="archive-notice"><Archive size={17} /> Archiviert am {timestamp(card.archived_at!)}. Originaler Trello-Stand.</p>
        <p className="form-hint">{state.workspaces.find((workspace) => workspace.id === card.workspace_id)?.name} · {state.columns.find((column) => column.id === card.column_id)?.name}</p>
        {!card.project_id && <p className="form-hint">Kein eindeutiges Ursprungsprojekt in Trello. Originale Projektlabels bleiben erhalten.</p>}
        <div className="label-selector">{state.labels.filter((label) => card.label_ids.includes(label.id)).map((label) => <span className={`label ${label.color}`} key={label.id}>{label.name}</span>)}</div>
        {card.description && <section><h3>Beschreibung</h3><p className="archive-description">{card.description}</p></section>}
        {card.due_at && <p>Fällig · <time dateTime={card.due_at}>{timestamp(card.due_at)}</time></p>}
        <Checklists lists={card.checklists || []} />
        <section aria-label="Anhänge"><CommentAttachments items={state.attachments.filter((file) => file.card_id === card.id && !file.comment_id && file.status === "ready")} /></section>
        <p className="form-hint">{card.completed_at ? `Erledigt · ${timestamp(card.completed_at)}` : "Nicht als erledigt markiert"}</p>
        {card.reviewed_at && <p className="form-hint"><CheckCheck size={15} /> {cardReadLabel(card,state.profiles)}</p>}
      </section>
      <aside className="comments-panel">
        <h3><MessageSquare size={16} />Kommentare <span>{comments.length}</span></h3>
        <div className="comment-list" role="region" aria-label="Archivierter Kommentarverlauf" tabIndex={0}>
          <div className="comment-thread">{comments.map((comment) => <div className="comment" key={comment.id}>
            <Avatar profile={state.profiles.find((p) => p.id === comment.author_id)} />
            <div><b>{state.profiles.find((p) => p.id === comment.author_id)?.name || "Ehemaliges Mitglied"}</b><time dateTime={comment.created_at}>{timestamp(comment.created_at)}</time>
              <CommentAttachments items={state.attachments.filter((file) => file.comment_id === comment.id && file.status === "ready")} />
              <p>{comment.body}</p>
            </div>
          </div>)}</div>
          {!comments.length && <p className="form-hint">Keine Kommentare vorhanden.</p>}
        </div>
      </aside>
    </div>
  </Dialog>;
}
