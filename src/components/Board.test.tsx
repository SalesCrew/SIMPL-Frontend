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

it.each([0, 2])("enables card acknowledgement on the board for every role (profile=%s)", (index) => {
  const state = createSeed();
  for (const busy of [false, true]) {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <Board
          state={state}
          current={state.profiles[index]}
          visible={state.cards}
          open={() => {}}
          create={() => {}}
          editColumn={() => {}}
          mutate={async () => true}
          busy={busy}
        />
      </TooltipProvider>,
    );
    const buttons = [...html.matchAll(/<button[^>]*class="read-check[^>]*>/g)];
    expect(buttons).toHaveLength(state.cards.length);
    for (const [button] of buttons) {
      expect(button.includes('disabled=""')).toBe(busy);
      expect(button).toMatch(/gelesen|Gelesen/);
      if (button.includes('aria-pressed="true"')) {
        expect(button).toContain("Von Kilian gelesen. Gelesen-Markierung entfernen");
      }
    }
  }
});

it("removes the drag preview immediately instead of animating a duplicate back", () => {
  highlightedColumns();
  expect(drag.dropAnimation).toBeNull();
});

it("keeps the board interactive while only preventing a conflicting second drag of the saving card", () => {
  const state = createSeed();
  const html = renderToStaticMarkup(<TooltipProvider><Board state={state} current={state.profiles[0]}
    visible={state.cards} open={() => {}} create={() => {}} editColumn={() => {}} mutate={async () => true}
    busy={false} movingCardIds={new Set(["c1"])} /></TooltipProvider>);
  const handles = [...html.matchAll(/<button[^>]*class="drag-handle"[^>]*>/g)].map(([button]) => button);
  expect(handles.filter((button) => button.includes('disabled=""'))).toHaveLength(1);
  const checks = [...html.matchAll(/<button[^>]*class="(?:read-check|status-check)[^>]*>/g)];
  expect(checks.every(([button]) => !button.includes('disabled=""'))).toBe(true);
  expect(html).not.toContain('aria-busy="true"');
});

it("shows the card creator in the bottom-right avatar, independently of the assignee", () => {
  const state = createSeed();
  state.cards[0] = {
    ...state.cards[0],
    created_by: "anna",
    assignee_id: "david",
  };
  const html = renderToStaticMarkup(<TooltipProvider><Board state={state} current={state.profiles[0]}
    visible={[state.cards[0]]} open={() => {}} create={() => {}} editColumn={() => {}} mutate={async () => true}
    busy={false} /></TooltipProvider>);
  expect(html).toContain('aria-label="Anna Leitner"');
  expect(html).not.toContain('aria-label="David Lang"');
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
