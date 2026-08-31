import {
  closestCorners,
  pointerWithin,
  type ClientRect,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function horizontalColumnCoordinates(
  cardRect: ClientRect,
  columnRects: ClientRect[],
  direction: -1 | 1,
) {
  const columns = [...columnRects].sort((a, b) => a.left - b.left);
  const centerX = cardRect.left + cardRect.width / 2;
  const index = columns.findIndex(
    (column) => centerX >= column.left && centerX <= column.right,
  );
  const target = index < 0 ? undefined : columns[index + direction];
  if (!target) return;
  return {
    x: target.left + (target.width - cardRect.width) / 2,
    y: Math.max(
      target.top,
      Math.min(cardRect.top, target.bottom - cardRect.height),
    ),
  };
}

export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight")
    return sortableKeyboardCoordinates(event, args);

  const { active, collisionRect, droppableContainers, droppableRects } =
    args.context;
  if (!active || !collisionRect) return;
  event.preventDefault();
  // Move between actual columns, including empty ones. The default sortable
  // getter compares cards and columns together and can select the source again.
  const columns = droppableContainers.getEnabled().flatMap((item) => {
    const rect = droppableRects.get(item.id);
    return item.data.current?.type === "column" && rect ? [rect] : [];
  });
  return horizontalColumnCoordinates(
    collisionRect,
    columns,
    event.code === "ArrowLeft" ? -1 : 1,
  );
};

export const boardCollisionDetection: CollisionDetection = (args) => {
  const containers = args.droppableContainers.filter((item) => !item.disabled);
  const columns = containers.filter(
    (item) => item.data.current?.type === "column",
  );
  // Pick the column first. Comparing a tall empty column with small cards in
  // adjacent columns lets those cards steal the drop, even inside this column.
  // Keyboard drags have no pointer, so use the translated card's center.
  const columnHits = pointerWithin({
    ...args,
    droppableContainers: columns,
    pointerCoordinates: args.pointerCoordinates ?? {
      x: args.collisionRect.left + args.collisionRect.width / 2,
      y: args.collisionRect.top + args.collisionRect.height / 2,
    },
  });
  const columnHit = columnHits[0];
  if (!columnHit) return [];

  const cards = containers.filter(
    (item) =>
      item.data.current?.type === "card" &&
      item.data.current.column === columnHit.id &&
      args.droppableRects.has(item.id),
  );
  if (!cards.length) return [columnHit];

  const cardArgs = { ...args, droppableContainers: cards };
  if (args.pointerCoordinates) {
    const cardHits = pointerWithin(cardArgs);
    if (cardHits.length) return cardHits;

    // Blank space below the list appends a card; gaps within the list still
    // resolve to a nearby card, but never one from a neighboring column.
    const listBottom = Math.max(
      ...cards.map((item) => args.droppableRects.get(item.id)!.bottom),
    );
    if (args.pointerCoordinates.y > listBottom) return [columnHit];
  }

  return closestCorners(cardArgs);
};
