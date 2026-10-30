import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, X } from "lucide-react";
import type { ThresholdOccupancyEntry, ThresholdOccupancyModel } from "./types";

const zones = [
  { key: "above", symbol: "↑", label: "darüber" },
  { key: "below", symbol: "↓", label: "darunter" },
  { key: "equal", symbol: "=", label: "auf der Grenze" },
] as const;
const percent = (value: number) => value > 0 && value < .1 ? "< 0,1 %" : new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 }).format(value) + " %";

function Swatch({ entry }: { entry: ThresholdOccupancyEntry }) {
  return <svg viewBox="0 0 22 6" aria-hidden="true"><line x1="0" x2="22" y1="3" y2="3" stroke={entry.color} strokeWidth="2" strokeDasharray={entry.pattern} /></svg>;
}
function Values({ entry }: { entry: ThresholdOccupancyEntry }) {
  if (!entry.percentages) return <span className="threshold-occupancy-empty">{entry.empty}</span>;
  return <div className="threshold-occupancy-values">{zones.map(({ key, symbol, label }) => key === "equal" && !entry.percentages![key] ? null : <span key={key} className={`is-${key}`} data-occupancy-zone={key} aria-label={`${percent(entry.percentages![key])} ${label}`}>{symbol} {percent(entry.percentages![key])}</span>)}</div>;
}
export function ThresholdOccupancySummary({ model }: { model: ThresholdOccupancyModel }) {
  if (!model.entries.length) return null;
  return <Popover.Root>
    <div className="threshold-occupancy-compact" aria-label="Zeit über und unter Referenz">
      <div className="threshold-occupancy-mini-heading"><span>Über / unter Referenz</span><Popover.Trigger asChild><button type="button" className="threshold-occupancy-details-trigger" aria-label="Referenzvergleich: Details und alle Datenreihen">{model.entries.length > 2 ? `Alle ${model.entries.length}` : "Details"}<ChevronDown size={10} /></button></Popover.Trigger></div>
      {model.entries.slice(0, 2).map(entry => <div className="threshold-occupancy-mini-row" data-threshold-occupancy={entry.key} key={entry.key} title={entry.note}>
        <div className="threshold-occupancy-label"><Swatch entry={entry} /><span>{entry.label}</span></div><Values entry={entry} />
      </div>)}
    </div>
    <Popover.Portal><Popover.Content className="threshold-occupancy-popover" aria-label="Zeit über und unter Referenz im Detail" align="end" sideOffset={8} collisionPadding={12}>
      <div className="threshold-occupancy-popover-heading"><div><strong>Zeit über / unter Referenz</strong><p>{model.range}</p></div><Popover.Close asChild><button type="button" aria-label="Referenzvergleich schließen"><X size={15} /></button></Popover.Close></div>
      <div className="threshold-occupancy-detail-list">{model.entries.map(entry => <article className="threshold-occupancy-detail-row" data-threshold-occupancy-detail={entry.key} key={entry.key}>
        <div className="threshold-occupancy-label"><Swatch entry={entry} /><span>{entry.label}</span></div><Values entry={entry} />
        <p className="threshold-occupancy-reference">{entry.reference} · {entry.coverage}</p>
        {entry.percentages ? <div className="threshold-occupancy-bar" aria-hidden="true">{zones.map(({ key }) => <i key={key} className={`is-${key}`} style={{ width: `${entry.percentages![key]}%` }} />)}</div> : null}
      </article>)}</div>
      <details className="threshold-occupancy-method"><summary>So wird gerechnet</summary><p>{model.method}</p></details>
      <Popover.Arrow className="personal-info-arrow" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
