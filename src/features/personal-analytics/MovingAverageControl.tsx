import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Plus, Waves, X } from "lucide-react";
import { NumberField } from "../../components/ui/NumberField";
import { Select } from "../../components/ui/Select";
import type { AverageControlModel, AverageSettings } from "./types";

export function MovingAverageControl({ model, onChange, onExport }: { model: AverageControlModel; onChange: (value: AverageSettings) => void; onExport: () => void }) {
  const [period, setPeriod] = useState(7);
  const current = model.settings, all = current.sources.includes("*"), unit = model.grain === "week" ? "KW" : model.grain === "month" ? "Monat" : "Tag";
  const add = () => { if (Number.isInteger(period) && period >= 1 && period <= 10000 && !current.periods.includes(period) && current.periods.length < 8) onChange({ ...current, periods: [...current.periods, period].sort((a, b) => a - b) }); };
  const toggle = (key: string, checked: boolean) => { const sources = all ? model.sources.map(source => source.key) : current.sources; onChange({ ...current, sources: checked ? [...new Set([...sources, key])] : sources.filter(source => source !== key) }); };
  return <Popover.Root><Popover.Trigger asChild><button type="button" className={`personal-average-trigger${current.periods.length ? " is-active" : ""}`} aria-label={`Gleitende Durchschnitte: ${model.title}`}><Waves size={14} /><span>Durchschnitte{current.periods.length ? ` · ${current.periods.length}` : ""}</span></button></Popover.Trigger><Popover.Portal><Popover.Content className="personal-average-popover" sideOffset={8} collisionPadding={12}>
    <div className="personal-average-heading"><strong>Gleitende Durchschnitte</strong><Popover.Close asChild><button type="button" className="icon-button" aria-label="Durchschnitte schließen"><X size={14} /></button></Popover.Close></div>
    <p className="personal-average-unit">1 Tick = 1 {unit} · {model.title}</p>
    {model.adjustableGrain && <Select label="Intervall des Zeitverlaufs" value={current.grain} options={[{ value: "day", label: "Tag · 1 Tick = 1 Tag" }, { value: "week", label: "KW · 1 Tick = 1 Woche" }]} onValueChange={grain => onChange({ ...current, grain: grain as "day" | "week" })} />}
    <span className="personal-average-label">Fenster in Ticks</span><div className="personal-average-add"><NumberField label="Anzahl Ticks" value={period} onChange={setPeriod} min={1} max={10000} step={1} /><button type="button" className="secondary" aria-label="Durchschnitt hinzufügen" disabled={!Number.isInteger(period) || period < 1 || period > 10000 || current.periods.includes(period) || current.periods.length >= 8} onClick={add}><Plus size={14} />Hinzufügen</button></div>
    <div className="personal-average-periods" aria-label="Aktive Fenster">{current.periods.length ? current.periods.map(n => <button key={n} type="button" onClick={() => onChange({ ...current, periods: current.periods.filter(value => value !== n) })} aria-label={`${n} Ticks entfernen`}>Ø {n} Ticks<X size={11} /></button>) : <span>Noch kein zusätzliches Fenster.</span>}</div>
    <fieldset><legend>Basiswerte</legend><label><input type="checkbox" checked={all} onChange={event => onChange({ ...current, sources: event.target.checked ? ["*"] : [] })} />Alle angezeigten Basisreihen</label>{model.sources.map(source => <label key={source.key}><input type="checkbox" checked={all || current.sources.includes(source.key)} onChange={event => toggle(source.key, event.target.checked)} />{source.label}</label>)}</fieldset>
    <p className="personal-average-method">Summe der letzten N Tick-Werte ÷ N. Nur vollständige, aufeinanderfolgende Intervalle im gefilterten Ausschnitt zählen. Echte Nullwerte zählen mit; Lücken und laufende Intervalle bleiben leer. {model.note}</p>
    <div className="personal-average-footer"><button type="button" onClick={() => onChange({ ...current, periods: [] })} disabled={!current.periods.length}>Zurücksetzen</button><button type="button" onClick={onExport} disabled={!current.periods.length}>Werte als CSV</button></div>
    <Popover.Arrow className="personal-info-arrow" />
  </Popover.Content></Popover.Portal></Popover.Root>;
}
