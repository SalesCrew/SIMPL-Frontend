import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Save } from "lucide-react";
import { useTypewriterPlaceholder } from "./useTypewriterPlaceholder";

export function CardTextField({
  label,
  value,
  savedValue,
  onChange,
  onSave,
  multiline = false,
  disabled = false,
  maxLength,
  placeholder,
  placeholderSequence,
  autoFocus = false,
}: {
  label: string;
  value: string;
  savedValue?: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => Promise<boolean>;
  multiline?: boolean;
  disabled?: boolean;
  maxLength: number;
  placeholder?: string;
  placeholderSequence?: readonly string[];
  autoFocus?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedText = useRef("");
  const dirty = onSave && value !== savedValue;
  const success = phase === "saved" && value === savedText.current;
  const showSaveControl = Boolean(dirty || phase === "saving" || success);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const animatedPlaceholder = useTypewriterPlaceholder(
    placeholderSequence,
    multiline && !value,
  );
  const fit = useCallback((node: HTMLTextAreaElement | null) => {
    textarea.current = node;
    if (node) {
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    }
  }, []);
  useEffect(() => {
    fit(textarea.current);
  }, [value, showSaveControl, fit]);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function save() {
    if (!onSave || phase === "saving") return;
    clearTimeout(timer.current);
    const submitted = value;
    setPhase("saving");
    const ok = await onSave(submitted);
    savedText.current = submitted;
    setPhase(ok ? "saved" : "idle");
    if (ok) timer.current = setTimeout(() => setPhase("idle"), 1000);
  }
  return (
    <div
      className={`field card-text-field ${multiline ? "is-description" : "is-title"}`}
    >
      <label htmlFor={`card-${multiline ? "description" : "title"}`}>
        {label}
      </label>
      <div
        className={`card-text-control ${dirty ? "is-dirty" : ""}${showSaveControl ? " has-save-control" : ""}`}
      >
        {multiline ? (
          <textarea
            id="card-description"
            ref={fit}
            rows={4}
            maxLength={maxLength}
            value={value}
            placeholder={animatedPlaceholder || placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            id="card-title"
            required
            autoFocus={autoFocus}
            maxLength={maxLength}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (onSave && e.key === "Enter") {
                e.preventDefault();
                if (dirty) void save();
              }
            }}
          />
        )}
        {showSaveControl && (
          <button
            type="button"
            className={`field-save ${success ? "is-saved" : ""}`}
            disabled={
              disabled || phase !== "idle" || (!multiline && !value.trim())
            }
            aria-label={`${label} speichern`}
            onClick={() => void save()}
          >
            {phase === "saving" ? (
              <LoaderCircle size={14} className="spin" />
            ) : success ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>
              {phase === "saving"
                ? "Speichert …"
                : success
                  ? "Gespeichert"
                  : "Speichern"}
            </span>
          </button>
        )}
      </div>
      <span className="sr-only" role="status">
        {success ? `${label} gespeichert.` : ""}
      </span>
    </div>
  );
}
