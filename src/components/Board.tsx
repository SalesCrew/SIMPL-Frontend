import { useState, type SyntheticEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Check,
  CheckCheck,
  Circle,
  FolderKanban,
  GripVertical,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  LockKeyhole,
  Plus,
} from "lucide-react";
import { orderedCards, orderedColumns, type Action } from "../domain";
import { boardCollisionDetection, boardKeyboardCoordinates } from "../board-dnd";
import { Tooltip } from "./ui/Tooltip";
import { cardReadLabel } from "../card-review";
import {
  initials,
  type BoardState,
  type Card,
  type Column,
  type Profile,
} from "../types";

export function Avatar({
  profile,
  small = false,
  tooltip = true,
}: {
  profile?: Profile;
  small?: boolean;
  tooltip?: boolean;
}) {
  const avatar = (
    <span
      className={`avatar ${small ? "small" : ""} ${profile?.color || "slate"}`}
      role="img"
      aria-label={profile?.name || "Nicht zugewiesen"}
    >
      {profile ? initials(profile.name) : "–"}
    </span>
  );
  return tooltip ? (
    <Tooltip content={profile?.name || "Nicht zugewiesen"}>{avatar}</Tooltip>
  ) : (
    avatar
  );
}
function CardFace({
  card,
  state,
  open,
  mutate,
  busy,
  overlay = false,
}: {
  card: Card;
  state: BoardState;
  current: Profile;
  open: (id: string) => void;
  mutate: (a: Action) => Promise<boolean>;
  busy: boolean;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", column: card.column_id },
    disabled: busy || overlay,
  });
  const count = state.comments.filter((c) => c.card_id === card.id).length;
  const attachments = state.attachments.filter(
    (a) => a.card_id === card.id && a.status === "ready",
  ).length;
  const startCardDrag = (event: SyntheticEvent<HTMLElement>) => {
    const target = event.target;
    // Title clicks still open the card; dragging them moves it. Action buttons
    // keep their own behavior and must never accidentally start a drag.
    if (
      target instanceof Element &&
      target.closest(
        'button:not(.card-title):not(.drag-handle), a, input, textarea, select, [contenteditable="true"]',
      )
    )
      return;
    const activate =
      event.type === "touchstart"
        ? listeners?.onTouchStart
        : listeners?.onMouseDown;
    activate?.(event);
  };
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className={`task-card ${overlay ? "drag-overlay" : ""}`}
      onMouseDown={startCardDrag}
      onTouchStart={startCardDrag}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button")) open(card.id);
      }}
    >
      <button
        ref={setActivatorNodeRef}
        className="drag-handle"
        {...attributes}
        onKeyDown={(event) => listeners?.onKeyDown?.(event)}
        disabled={busy || overlay}
        aria-label={`${card.title} verschieben`}
      >
        <GripVertical size={14} />
      </button>
      <div className="card-labels">
        {card.label_ids.map((id) => {
          const label = state.labels.find((l) => l.id === id);
          return label ? (
            <span className={`label ${label.color}`} key={id}>
              <i />
              {label.name}
            </span>
          ) : null;
        })}
      </div>
      <h3>
        <button className="card-title" onClick={() => open(card.id)}>
          {card.title}
        </button>
      </h3>
      {card.description && <p className="card-excerpt">{card.description}</p>}
      <div className="card-footer">
        <Tooltip
          content={
            card.completed_at ? "Wieder öffnen" : "Als erledigt markieren"
          }
        >
          <button
            disabled={busy}
            className={`status-check ${card.completed_at ? "complete" : ""}`}
            aria-label={
              card.completed_at
                ? `${card.title} wieder öffnen`
                : `${card.title} erledigen`
            }
            aria-pressed={!!card.completed_at}
            onClick={() =>
              void mutate({
                type: "card.complete",
                id: card.id,
                completed: !card.completed_at,
              })
            }
          >
            {card.completed_at && <Check size={12} />}
          </button>
        </Tooltip>
        <Tooltip content={cardReadLabel(card, state.profiles)}>
          <button
            className={`read-check ${card.reviewed_at ? "is-read" : ""}`}
            aria-label={`${card.title}: ${card.reviewed_at ? `${cardReadLabel(card, state.profiles)}. Gelesen-Markierung entfernen` : "als gelesen markieren"}`}
            aria-pressed={!!card.reviewed_at}
            disabled={busy}
            onClick={() =>
              void mutate({
                type: "card.review",
                id: card.id,
                reviewed: !card.reviewed_at,
              })
            }
          >
            <CheckCheck size={17} />
          </button>
        </Tooltip>
        <span className="card-meta">
          {card.description && <AlignLeft size={14} />}
          <MessageSquare size={13} />
          {count || null}
          {attachments > 0 && (
            <span
              className="card-attachment-count"
              aria-label={`${attachments} Anhänge`}
            >
              <Paperclip size={13} />
              {attachments}
            </span>
          )}
        </span>
        <Avatar
          profile={state.profiles.find((p) => p.id === card.assignee_id)}
          small
        />
      </div>
    </article>
  );
}
function BoardColumn({
  column,
  cards,
  state,
  current,
  open,
  mutate,
  create,
  edit,
  busy,
}: {
  column: Column;
  cards: Card[];
  state: BoardState;
  current: Profile;
  open: (id: string) => void;
  mutate: (a: Action) => Promise<boolean>;
  create: () => void;
  edit: () => void;
  busy: boolean;
}) {
  const { setNodeRef, isOver, over } = useDroppable({
    id: column.id,
    data: { type: "column", column: column.id },
  });
  const isDropTarget = isOver || over?.data.current?.column === column.id;
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isDropTarget ? "drop-target" : ""}`}
      aria-label={`Spalte ${column.name}`}
    >
      <header className="column-heading">
        <span className={`column-icon ${column.color}`}>
          {column.kind === "done" ? (
            <Check size={15} />
          ) : column.kind === "work" ? (
            <Circle size={14} />
          ) : (
            <FolderKanban size={15} />
          )}
        </span>
        <h2>{column.name}</h2>
        <span className="column-count">{cards.length}</span>
        {column.kind !== "project" ? (
          <Tooltip content="Feste Spalte · nicht bearbeitbar">
            <span
              className="fixed-column-indicator"
              role="img"
              aria-label={`${column.name} ist eine feste Spalte`}
            >
              <LockKeyhole size={13} />
            </span>
          </Tooltip>
        ) : (
          current.role === "admin" && (
            <button
              className="icon-button"
              onClick={edit}
              aria-label={`${column.name} verwalten`}
            >
              <MoreHorizontal size={17} />
            </button>
          )
        )}
      </header>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-list">
          {cards.map((card) => (
            <CardFace
              key={card.id}
              {...{ card, state, current, open, mutate, busy }}
            />
          ))}
        </div>
      </SortableContext>
      {!cards.length && (
        <div className="column-empty">
          <span>
            {column.kind === "done" ? (
              <CheckCheck size={24} />
            ) : (
              <FolderKanban size={24} />
            )}
          </span>
          <b>
            {column.kind === "done"
              ? "Bald ist es geschafft"
              : "Platz für neue Ideen"}
          </b>
          <p>
            {column.kind === "done" ? (
              "Karte abhaken oder hierher verschieben."
            ) : column.kind === "work" ? (
              "Karte hier ablegen oder über das Menü verschieben."
            ) : (
              <>
                Karte hier ablegen
                <br />
                oder eine neue erstellen.
              </>
            )}
          </p>
        </div>
      )}
      <div className="column-footer">
        {column.kind === "project" && (
          <button className="add-card" onClick={create}>
            <Plus size={16} />
            Karte hinzufügen
          </button>
        )}
      </div>
    </section>
  );
}
export function Board({
  state,
  current,
  visible,
  open,
  create,
  editColumn,
  mutate,
  busy,
}: {
  state: BoardState;
  current: Profile;
  visible: Card[];
  open: (id: string) => void;
  create: (column?: string) => void;
  editColumn: (column?: Column) => void;
  mutate: (a: Action) => Promise<boolean>;
  busy: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
    }),
  );
  const endDrag = (event: DragEndEvent) => {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const active = state.cards.find((c) => c.id === event.active.id);
    const overCard = state.cards.find((c) => c.id === event.over!.id);
    const column =
      overCard?.column_id ||
      state.columns.find((c) => c.id === event.over!.id)?.id;
    if (!active || !column) return;
    let before = overCard?.id || null;
    if (
      overCard &&
      active.column_id === column &&
      active.position < overCard.position
    ) {
      const items = orderedCards(state, column);
      before =
        items[items.findIndex((c) => c.id === overCard.id) + 1]?.id || null;
    }
    void mutate({
      type: "card.move",
      id: active.id,
      column_id: column,
      before_id: before,
    });
  };
  const active = state.cards.find((c) => c.id === activeId);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={endDrag}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Zum Verschieben Leertaste drücken. Mit den Pfeiltasten bewegen, mit Leertaste ablegen oder Escape abbrechen.",
        },
      }}
    >
      <div className="board-content">
        <div className="board-columns">
          {orderedColumns(state.columns).map((column) => (
            <BoardColumn
              key={column.id}
              {...{ column, state, current, open, mutate, busy }}
              cards={visible
                .filter((c) => c.column_id === column.id)
                .sort(
                  (a, b) => a.position - b.position || a.id.localeCompare(b.id),
                )}
              create={() => create(column.id)}
              edit={() => editColumn(column)}
            />
          ))}
          {current.role === "admin" && (
            <button className="add-column" onClick={() => editColumn()}>
              <Plus size={17} />
              Neue Spalte
            </button>
          )}
        </div>
      </div>
      {/* The moved card is the drop result; never animate a second copy back. */}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="drag-preview">
            <CardFace
              card={active}
              {...{ state, current, open, mutate, busy }}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
