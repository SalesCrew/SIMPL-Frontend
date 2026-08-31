import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Checklists } from "./Checklists";
import { ArchiveList } from "./Archive";
import { createSeed } from "../seed";
import { applyDemoAction, orderedCards } from "../domain";
import { DemoCardSessions } from "../demo-card-sessions";
import type { Checklist } from "../types";
vi.mock("../data", () => ({ demoMode: true, supabase: null }));

const lists: Checklist[] = [{ id: "list", name: "Tasks", items: [
  { id: "one", name: "Erster Schritt", completed: true },
  { id: "two", name: "<script>unfinished</script>", completed: false },
] }];
describe("Imported checklist and archive preservation", () => {
  it("renders exact item states and safely escapes imported text", () => {
    const html = renderToStaticMarkup(<Checklists lists={lists} save={async () => true} />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('Tasks: 1 von 2 erledigt');
    expect(html).toContain('&lt;script&gt;unfinished&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
  it("disables archive checkboxes without a save handler", () => {
    const html = renderToStaticMarkup(<Checklists lists={lists} />);
    expect((html.match(/disabled=""/g) || []).length).toBe(2);
  });
  it("saves checklists as card state and includes them in undo", () => {
    const state = createSeed();
    const card = state.cards[0];
    card.checklists = structuredClone(lists);
    const sessions = new DemoCardSessions();
    sessions.operate(state,state.profiles[0],"session","begin",card.id);
    const changed = structuredClone(lists);
    changed[0].items[1].completed = true;
    const saved = sessions.operate(state,state.profiles[0],"session","mutate",card.id,{ type:"card.update",id:card.id,patch:{checklists:changed} });
    expect(saved.state.cards[0].checklists?.[0].items[1].completed).toBe(true);
    sessions.operate(saved.state,state.profiles[0],"session","close",card.id);
    const restored = sessions.operate(saved.state,state.profiles[0],"session","undo",card.id);
    expect(restored.state.cards.find((entry) => entry.id === card.id)?.checklists).toEqual(lists);
  });
  it("keeps archived cards out of live ordering and preserves their text on unrelated saves", () => {
    const state = createSeed();
    const archived = state.cards[1];
    archived.archived_at = "2026-08-01T10:00:00Z";
    expect(orderedCards(state,archived.column_id).map(card => card.id)).not.toContain(archived.id);
    const saved = applyDemoAction(state,state.profiles[0],{type:"card.update",id:state.cards[0].id,patch:{checklists:lists}});
    expect(saved.cards[1]).toEqual(archived);
    const html = renderToStaticMarkup(<ArchiveList cards={[archived]} state={state} open={() => {}} />);
    expect(html).toContain(archived.title);
    expect(html).toContain('Archiviert');
  });
});
