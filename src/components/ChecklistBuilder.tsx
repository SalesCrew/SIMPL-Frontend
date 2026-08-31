import { ListChecks, Plus, Trash2 } from "lucide-react";
import type { Checklist } from "../types";

const makeItem = () => ({ id: crypto.randomUUID(), name: "", completed: false });

export function ChecklistBuilder({
  value,
  automatic,
  disabled = false,
  onChange,
}: {
  value: Checklist[];
  automatic?: Checklist;
  disabled?: boolean;
  onChange: (value: Checklist[]) => void;
}) {
  const changeList = (id: string, update: (list: Checklist) => Checklist) =>
    onChange(value.map((list) => (list.id === id ? update(list) : list)));

  return (
    <section className="checklist-builder" aria-label="Checklisten erstellen">
      <div className="field-title">
        <span>Checklisten</span>
        <button
          type="button"
          className="text-button"
          disabled={disabled || value.length >= 19}
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                name: "Checkliste",
                items: [makeItem()],
              },
            ])
          }
        >
          <Plus size={12} />
          Hinzufügen
        </button>
      </div>
      <p className="checklist-builder-hint">
        Füge Punkte direkt hinzu oder beginne Beschreibungszeilen mit „-“.
      </p>

      {automatic && (
        <div className="automatic-checklist" aria-live="polite">
          <div className="automatic-checklist-title">
            <span><ListChecks size={15} /> Aus Beschreibung</span>
            <small>{automatic.items.length} automatisch erkannt</small>
          </div>
          <ul>
            {automatic.items.map((item) => <li key={item.id}>{item.name}</li>)}
          </ul>
        </div>
      )}

      <div className="checklist-drafts">
        {value.map((list, listIndex) => (
          <div className="checklist-draft" key={list.id}>
            <div className="checklist-draft-head">
              <ListChecks size={16} aria-hidden="true" />
              <input
                aria-label={`Titel der Checkliste ${listIndex + 1}`}
                value={list.name}
                maxLength={500}
                disabled={disabled}
                onChange={(event) =>
                  changeList(list.id, (entry) => ({ ...entry, name: event.target.value }))
                }
              />
              <button
                type="button"
                className="checklist-remove"
                aria-label={`Checkliste ${listIndex + 1} entfernen`}
                disabled={disabled}
                onClick={() => onChange(value.filter((entry) => entry.id !== list.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="checklist-draft-items">
              {list.items.map((item, itemIndex) => (
                <div className="checklist-draft-item" key={item.id}>
                  <span aria-hidden="true" />
                  <input
                    aria-label={`Punkt ${itemIndex + 1} in Checkliste ${listIndex + 1}`}
                    value={item.name}
                    maxLength={2000}
                    disabled={disabled}
                    placeholder="Aufgabe eintragen …"
                    onChange={(event) =>
                      changeList(list.id, (entry) => ({
                        ...entry,
                        items: entry.items.map((row) =>
                          row.id === item.id ? { ...row, name: event.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="checklist-remove"
                    aria-label={`Punkt ${itemIndex + 1} entfernen`}
                    disabled={disabled}
                    onClick={() =>
                      changeList(list.id, (entry) => ({
                        ...entry,
                        items: entry.items.filter((row) => row.id !== item.id),
                      }))
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="checklist-add-item"
              disabled={disabled || list.items.length >= 200}
              onClick={() =>
                changeList(list.id, (entry) => ({
                  ...entry,
                  items: [...entry.items, makeItem()],
                }))
              }
            >
              <Plus size={13} /> Punkt hinzufügen
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
