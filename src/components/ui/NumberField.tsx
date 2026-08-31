import { Minus, Plus } from "lucide-react";

export function NumberField({
  value,
  onChange,
  label,
  min = 0,
  max = 999999,
  step = 0.1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const change = (direction: number) =>
    onChange(
      Math.min(
        max,
        Math.max(min, Math.round((value + step * direction) * 10) / 10),
      ),
    );
  return (
    <div className="number-field">
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
      />
      <div className="number-buttons">
        <button
          type="button"
          aria-label={`${label} verringern`}
          disabled={value <= min}
          onClick={() => change(-1)}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          disabled={value >= max}
          onClick={() => change(1)}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
