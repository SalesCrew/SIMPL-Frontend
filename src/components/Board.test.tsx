import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "../seed";
import { Board } from "./Board";
import { TooltipProvider } from "./ui/Tooltip";

const drag = vi.hoisted(() => ({
  dropAnimation: undefined as unknown,
  over: null as {
    id: string;
    data: { current: { type: "card" | "column"; column: string } };
  } | null,
}));

// Substitute the live drag target and observe overlay options, while rendering
// the production board, cards and overlay.
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...original,
    DragOverlay: (props: React.ComponentProps<typeof original.DragOverlay>) => {
      drag.dropAnimation = props.dropAnimation;
      return <original.DragOverlay {...props} />;
    },
    useDroppable: ({ id }: { id: string }) => ({
      setNodeRef: () => {},
      isOver: drag.over?.id === id,
      over: drag.over,
    }),
  };
});

function highlightedColumns() {
  const state = createSeed();
  const html = renderToStaticMarkup(
    <TooltipProvider>
      <Board
        state={state}
        current={state.profiles[0]}
        visible={state.cards}
        open={() => {}}
        create={() => {}}
        editColumn={() => {}}
        mutate={async () => true}
        busy={false}
      />
    </TooltipProvider>,
  );
  return [
    ...html.matchAll(/class="board-column drop-target" aria-label="([^"]+)"/g),
  ].map((match) => match[1]);
}

afterEach(() => {
  drag.over = null;
  drag.dropAnimation = undefined;
});

it("removes the drag preview immediately instead of animating a duplicate back", () => {
  highlightedColumns();
  expect(drag.dropAnimation).toBeNull();
});

describe("Board column drag highlight", () => {
  it("does not highlight any column when nothing is being dragged", () => {
    expect(highlightedColumns()).toEqual([]);
  });

  it("preserves the empty-column highlight", () => {
    drag.over = {
      id: "obi",
      data: { current: { type: "column", column: "obi" } },
    };
    expect(highlightedColumns()).toEqual(["Spalte OBI"]);
  });

  it.each([
    ["c1", "spark", "SPARK"],
    ["c6", "rover", "ROVER"],
    ["c8", "nespresso", "Nespresso"],
    ["work-card", "work", "In Arbeit"],
    ["done-card", "done", "Fertig"],
  ])(
    "highlights the parent column when dragging over card %s",
    (id, column, name) => {
      drag.over = { id, data: { current: { type: "card", column } } };
      expect(highlightedColumns()).toEqual([`Spalte ${name}`]);
    },
  );

  it("follows the current column and clears after leaving, dropping or cancelling", () => {
    drag.over = {
      id: "c8",
      data: { current: { type: "card", column: "nespresso" } },
    };
    expect(highlightedColumns()).toEqual(["Spalte Nespresso"]);
    drag.over = {
      id: "c6",
      data: { current: { type: "card", column: "rover" } },
    };
    expect(highlightedColumns()).toEqual(["Spalte ROVER"]);
    drag.over = null;
    expect(highlightedColumns()).toEqual([]);
  });
});
