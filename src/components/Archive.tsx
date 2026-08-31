import { Archive, CheckCheck, MessageSquare, Paperclip } from "lucide-react";
import type { BoardState, Card } from "../types";
import { timestamp } from "../types";
import { Dialog } from "./ui/Dialog";
import { Avatar } from "./Board";
import { CommentAttachments } from "./CommentAttachments";
import { Checklists } from "./Checklists";
import { cardReadLabel } from "../card-review";

export function ArchiveList({ cards, state, open }: {
  cards: Card[]; state: BoardState; open: (id: string) => void;
}) {
  const commentCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();
  for (const comment of state.comments) commentCounts.set(comment.card_id, (commentCounts.get(comment.card_id) || 0) + 1);
  for (const file of state.attachments) if (file.status === "ready") fileCounts.set(file.card_id, (fileCounts.get(file.card_id) || 0) + 1);
  return <section className="archive-list" aria-label="Archivierte Karten">
    {!cards.length && <p className="archive-empty">Keine archivierten Karten.</p>}
    {[...cards].sort((a, b) => (b.archived_at || "").localeCompare(a.archived_at || "") || a.position-b.position).map((card) => {
      const comments = commentCounts.get(card.id) || 0;
      const files = fileCounts.get(card.id) || 0;
      return <button type="button" className="archive-row" key={card.id} onClick={() => open(card.id)}>
        <Archive size={18} />
        <span><b>{card.title}</b><small>{state.columns.find((column) => column.id === card.column_id)?.name} · Archiviert {timestamp(card.archived_at!)}</small></span>
        <span className="archive-row-meta">{comments > 0 && <span><MessageSquare size={13} />{comments}</span>}{files > 0 && <span><Paperclip size={13} />{files}</span>}</span>
      </button>;
    })}
  </section>;
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
