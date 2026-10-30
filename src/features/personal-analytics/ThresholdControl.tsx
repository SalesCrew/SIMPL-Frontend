import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Split, X } from "lucide-react";
import { Select } from "../../components/ui/Select";
import type { ThresholdControlModel, ThresholdSettings } from "./types";
import "./thresholds.css";
export function ThresholdControl({ model, onChange }: { model: ThresholdControlModel; onChange: (value: ThresholdSettings) => void }) {
  const [open, setOpen] = useState(false), [axisKey, setAxisKey] = useState("");
  const [amount, setAmount] = useState(""), [sources, setSources] = useState<string[]>(["*"]), [background, setBackground] = useState(true);
  const [mode, setMode] = useState("manual"), [referenceSource, setReferenceSource] = useState(""), [referencePeriod, setReferencePeriod] = useState<"28d" | "visible">("28d");
  const axis = model.axes.find(item => item.key === axisKey) || model.axes[0];
  const hydrate = (key: string) => {
    const item = model.axes.find(a => a.key === key) || model.axes[0]; if (!item) return;
    setAxisKey(item.key); setAmount(item.rule ? String(item.rule.value).replace(".", ",") : ""); setSources(item.rule?.sources || ["*"]); setBackground(model.settings.backgroundKey === item.key || !model.settings.backgroundKey);
    setMode(item.rule?.reference ? "mean" : "manual"); setReferenceSource(item.rule?.reference?.source || item.lines[0]?.key || ""); setReferencePeriod(item.rule?.reference?.period || "28d");
  };
  const reference = axis?.lines.find(line => line.key === referenceSource)?.references?.[referencePeriod];
  const value = mode === "mean" ? reference?.value ?? NaN : amount.trim() ? Number(amount.replace(",", ".")) : NaN;
  const valid = Number.isFinite(value) && (sources.includes("*") || axis?.lines.some(line=>sources.includes(line.key)) || background);
  const apply = () => { if (!axis || !valid) return; onChange({ rules: { ...model.settings.rules, [axis.key]: { value, sources, ...(mode === "mean" ? { reference: { source: referenceSource, period: referencePeriod } } : {}) } }, backgroundKey: background ? axis.key : model.settings.backgroundKey === axis.key ? null : model.settings.backgroundKey }); setOpen(false); };
  const remove = () => { if (!axis) return; const rules = { ...model.settings.rules }; delete rules[axis.key]; onChange({ rules, backgroundKey: model.settings.backgroundKey === axis.key ? null : model.settings.backgroundKey }); setOpen(false); };
  const all = sources.includes("*"), toggle = (key: string, checked: boolean) => { const current = all ? axis.lines.map(line => line.key) : sources; setSources(checked ? [...new Set([...current,key])] : current.filter(value => value !== key)); };
  return <Popover.Root open={open} onOpenChange={value => { if (value) hydrate(axisKey); setOpen(value); }}><Popover.Trigger asChild><button type="button" className={`personal-threshold-trigger${model.activeCount ? " is-active" : ""}`} aria-label="Grün-Rot-Schwellenwerte einstellen"><Split size={14} /><span>Schwellenwerte{model.activeCount ? ` · ${model.activeCount}` : ""}</span></button></Popover.Trigger><Popover.Portal><Popover.Content className="personal-threshold-popover" sideOffset={8} collisionPadding={12}>
    <div className="personal-threshold-heading"><div><strong>Grün darüber. Rot darunter.</strong><p>Dein Referenzwert für die gewählte Y-Achse.</p></div><Popover.Close asChild><button type="button" className="icon-button" aria-label="Schwellenwerte schließen"><X size={15} /></button></Popover.Close></div>
    {!axis ? <p className="threshold-empty">Wähle zuerst mindestens eine Kennzahl im Chart.</p> : <>
      <label className="threshold-label">Y-Achse</label><Select label="Y-Achse für den Schwellenwert" value={axis.key} onValueChange={hydrate} options={model.axes.map(item => ({value:item.key,label:`${item.label} · ${item.unit}`}))} />
      <label className="threshold-label">Referenz</label><Select label="Art der Referenzlinie" value={mode} onValueChange={setMode} options={[{value:"manual",label:"Eigener Wert"},{value:"mean",label:"Durchschnitt einer Datenreihe"}]} />
      {mode === "mean" ? <>
        <label className="threshold-label">Datenreihe</label><Select label="Datenreihe für die Durchschnittslinie" value={referenceSource} onValueChange={setReferenceSource} options={axis.lines.map(line => ({value:line.key,label:line.label}))} />
        <label className="threshold-label">Zeitraum</label><Select label="Zeitraum der Durchschnittslinie" value={referencePeriod} onValueChange={value => setReferencePeriod(value as "28d" | "visible")} options={[{value:"28d",label:"Letzte 28 volle Kalendertage"},{value:"visible",label:"Gewählter Chartzeitraum"}]} />
        <div className="threshold-auto-value" aria-live="polite"><strong>{reference ? new Intl.NumberFormat("de-AT",{maximumFractionDigits:2}).format(reference.value) : "—"}<small>{axis.unit}</small></strong><p>{reference?.note || "Keine berechenbare Durchschnittslinie in dieser Auswahl. Fehlende Werte werden nicht als null gezählt."}</p></div>
      </> : <><label className="threshold-label" htmlFor="personal-threshold-value">Schwellenwert</label><div className="threshold-value-field"><input id="personal-threshold-value" aria-label="Schwellenwert" type="text" inputMode="decimal" aria-invalid={Boolean(amount.trim()&&!Number.isFinite(value))} placeholder={model.normalized ? "z. B. 50" : "z. B. 10"} value={amount} onChange={event => setAmount(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();apply();}}} /><span>{axis.unit}</span></div></>}
      <div className="threshold-preview"><span><i className="is-green" />Grün ab {Number.isFinite(value) ? new Intl.NumberFormat("de-AT").format(value) : "…"}</span><span><i className="is-red" />Rot darunter</span></div>
      <label className="threshold-background"><input type="checkbox" checked={background} onChange={event => setBackground(event.target.checked)} />Hintergrund nach dieser Achse einfärben</label>
      <details className="threshold-lines"><summary>Linien färben <span>{all ? "Alle dieser Achse" : `${sources.filter(key=>axis.lines.some(line=>line.key===key)).length} ausgewählt`}</span></summary><div><label><input type="checkbox" checked={all} onChange={event=>setSources(event.target.checked?["*"]:[])} />Alle Linien dieser Achse</label>{axis.lines.map(line=><label key={line.key}><input type="checkbox" checked={all||sources.includes(line.key)} onChange={event=>toggle(line.key,event.target.checked)} />{line.label}</label>)}</div></details>
      <p className="threshold-note">{model.normalized ? "Dieser Wert gilt auf der normierten Skala 0–100. Er ist kein Produktivitäts-Prozentwert." : model.axes.length>1 ? "Jede Achse hat ihren eigenen Wert. Die Hintergrundfläche folgt immer nur einer Achse." : "Die Achse und deine Daten bleiben unverändert. Nur die Färbung wird angepasst."}</p>
      {Number.isFinite(value)&&!background&&!sources.includes("*")&&!axis.lines.some(line=>sources.includes(line.key))&&<p className="threshold-note">Wähle mindestens eine Linie oder aktiviere die Fläche.</p>}
      {mode === "manual"&&amount.trim()&&!Number.isFinite(value)&&<p className="threshold-error" role="alert">Gib eine gültige Zahl ein.</p>}
      {mode === "mean"&&<p className="threshold-note">Horizontale Linie auf der Y-Achse. Sie wird bei Label-, Zeitraum- und Datenänderungen neu berechnet. Die Färbung ist dein Vergleich, kein Leistungsurteil.</p>}
      <div className="threshold-actions"><button type="button" disabled={!axis.rule} onClick={remove}>Entfernen</button><button type="button" className="threshold-apply" disabled={!valid} onClick={apply}>Anwenden</button></div>
    </>}
    <Popover.Arrow className="personal-info-arrow" />
  </Popover.Content></Popover.Portal></Popover.Root>;
}
