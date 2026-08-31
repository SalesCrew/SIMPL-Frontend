import { beforeAll, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ insert })));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from }) }));

let runRemote: typeof import("./data").runRemote;

beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  runRemote = (await import("./data")).runRemote;
});

it("persists manual and description-generated checklists with a new card", async () => {
  insert.mockResolvedValue({ error: null });
  const checklists = [{
    id: "simpl-description-checklist",
    name: "Aus Beschreibung",
    items: [{ id: "item", name: "Angebot prüfen", completed: false }],
  }];
  await runRemote({
    type: "card.create",
    id: "card-id",
    title: "Neue Karte",
    description: "- Angebot prüfen",
    column_id: "project-id",
    project_id: "project-id",
    assignee_id: null,
    label_ids: ["feature"],
    checklists,
  });
  expect(from).toHaveBeenCalledWith("cards");
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    id: "card-id",
    description: "- Angebot prüfen",
    checklists,
  }));
});
