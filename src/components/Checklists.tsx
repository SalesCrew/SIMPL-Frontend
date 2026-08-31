import { Check } from "lucide-react";
import { useState } from "react";
import type { Checklist } from "../types";

export function Checklists({ lists, disabled = false, save }: {
  lists: Checklist[];
  disabled?: boolean;
  save?: (lists: Checklist[]) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  return <div className="card-checklists" aria-busy={saving}>
    {lists.map((list) => {
      const completed = list.items.filter((item) => item.completed).length;
      return <section className="card-checklist" key={list.id} aria-label={list.name}>
        <h3>{list.name}<span>{completed}/{list.items.length}</span></h3>
        <progress value={completed} max={list.items.length || 1} aria-label={`${list.name}: ${completed} von ${list.items.length} erledigt`} />
        {list.items.map((item) => <button
          key={item.id}
          type="button"
          role="checkbox"
          aria-checked={item.completed}
          aria-label={item.name}
          disabled={disabled || saving || !save}
          className={`checklist-item${item.completed ? " complete" : ""}`}
          onClick={async () => {
            if (!save || saving) return;
            setSaving(true);
            try {
              await save(lists.map((entry) => entry.id === list.id
                ? { ...entry, items: entry.items.map((row) => row.id === item.id ? { ...row, completed: !row.completed } : row) }
                : entry));
            } finally { setSaving(false); }
          }}
        ><span className="checklist-box">{item.completed && <Check size={12} />}</span><span>{item.name}</span></button>)}
      </section>;
    })}
  </div>;
}
