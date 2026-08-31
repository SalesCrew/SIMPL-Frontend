import {
  closestCorners,
  type ClientRect,
  type CollisionDetection,
  type DroppableContainer,
} from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import { boardCollisionDetection, horizontalColumnCoordinates } from "./board-dnd";

const rect = (
  left: number,
  top: number,
  width = 254,
  height = 162,
): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("Keyboard movement between board columns", () => {
  const columns = [
    rect(330, 81, 274, 780),
    rect(622, 81, 274, 780),
    rect(914, 81, 274, 780),
  ];

  it("moves left from Nespresso to empty OBI, not the source column", () => {
    expect(horizontalColumnCoordinates(rect(924, 137), columns, -1)).toEqual({
      x: 632,
      y: 137,
    });
  });

  it("moves right from ROVER to empty OBI without skipping it", () => {
    expect(horizontalColumnCoordinates(rect(340, 137), columns, 1)).toEqual({
      x: 632,
      y: 137,
    });
  });

  it("continues to the next column on a repeated arrow press", () => {
    expect(horizontalColumnCoordinates(rect(632, 137), columns, 1)).toEqual({
      x: 924,
      y: 137,
    });
  });

  it("stays at the board edges", () => {
    expect(
      horizontalColumnCoordinates(rect(340, 137), columns, -1),
    ).toBeUndefined();
    expect(
      horizontalColumnCoordinates(rect(924, 137), columns, 1),
    ).toBeUndefined();
  });

  it("keeps the card inside a shorter target column", () => {
    expect(
      horizontalColumnCoordinates(
        rect(340, 700),
        [columns[0], rect(622, 81, 274, 300)],
        1,
      ),
    ).toEqual({
      x: 632,
      y: 219,
    });
  });
});

function container(
  id: string,
  type: "card" | "column",
  column: string,
  bounds: ClientRect,
): DroppableContainer {
  return {
    id,
    key: id,
    disabled: false,
    data: { current: { type, column } },
    node: { current: null },
    rect: { current: bounds },
  };
}

function fixture(
  pointerCoordinates: { x: number; y: number } | null = { x: 755, y: 200 },
  extra: DroppableContainer[] = [],
): Parameters<CollisionDetection>[0] {
  const droppableContainers = [
    container("rover", "column", "rover", rect(330, 81, 274, 780)),
    container("obi", "column", "obi", rect(622, 81, 274, 780)),
    container("nespresso", "column", "nespresso", rect(914, 81, 274, 780)),
    container("mars", "card", "rover", rect(340, 137)),
    container("kpis", "card", "nespresso", rect(924, 137)),
    ...extra,
  ];
  return {
    active: {
      id: "kpis",
      data: { current: { type: "card", column: "nespresso" } },
      rect: {
        current: { initial: rect(924, 137), translated: rect(632, 137) },
      },
    },
    collisionRect: rect(632, 137),
    droppableContainers,
    droppableRects: new Map(
      droppableContainers.map((item) => [item.id, item.rect.current!]),
    ),
    pointerCoordinates,
  };
}

describe("Board drop targeting", () => {
  it("regresses the empty OBI column losing to a neighboring card", () => {
    const args = fixture();
    expect(closestCorners(args)[0].id).not.toBe("obi");
    expect(boardCollisionDetection(args)[0].id).toBe("obi");
  });

  it.each([100, 200, 470, 840])("accepts empty-column drops at y=%s", (y) => {
    expect(boardCollisionDetection(fixture({ x: 755, y }))[0].id).toBe("obi");
  });

  it.each([633, 924])(
    "uses the pointer even when the dragged rectangle starts at x=%s",
    (x) => {
      const args = fixture();
      args.collisionRect = rect(x, 137);
      expect(boardCollisionDetection(args)[0].id).toBe("obi");
    },
  );

  it("targets a card inside the selected populated column", () => {
    const args = fixture({ x: 755, y: 200 }, [
      container("obi-card", "card", "obi", rect(632, 137)),
    ]);
    expect(boardCollisionDetection(args)[0].id).toBe("obi-card");
  });

  it("only considers cards in the hovered column when dropping between them", () => {
    const args = fixture({ x: 755, y: 306 }, [
      container("obi-first", "card", "obi", rect(632, 137)),
      container("obi-second", "card", "obi", rect(632, 315)),
    ]);
    args.collisionRect = rect(924, 137);
    expect(["obi-first", "obi-second"]).toContain(
      boardCollisionDetection(args)[0].id,
    );
  });

  it("appends when dropped in blank space below existing cards", () => {
    const args = fixture({ x: 755, y: 700 }, [
      container("obi-card", "card", "obi", rect(632, 137)),
    ]);
    expect(boardCollisionDetection(args)[0].id).toBe("obi");
  });

  it("preserves targeting for a reorder within the same column", () => {
    const args = fixture({ x: 1050, y: 380 }, [
      container("second-kpi", "card", "nespresso", rect(924, 315)),
    ]);
    expect(boardCollisionDetection(args)[0].id).toBe("second-kpi");
  });

  it("does not move the card when released outside a column", () => {
    expect(boardCollisionDetection(fixture({ x: 610, y: 200 }))).toEqual([]);
    expect(boardCollisionDetection(fixture({ x: 755, y: 50 }))).toEqual([]);
  });

  it("supports keyboard drops into an empty column without pointer coordinates", () => {
    expect(boardCollisionDetection(fixture(null))[0].id).toBe("obi");
  });

  it("supports keyboard drops onto cards in populated columns", () => {
    const args = fixture(null);
    args.collisionRect = rect(340, 137);
    expect(boardCollisionDetection(args)[0].id).toBe("mars");
  });

  it("ignores disabled columns", () => {
    const args = fixture();
    args.droppableContainers.find((item) => item.id === "obi")!.disabled = true;
    expect(boardCollisionDetection(args)).toEqual([]);
  });
});
