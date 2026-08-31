import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronUp,
  LoaderCircle,
  RotateCcw,
  X,
  ArrowRight,
} from "lucide-react";
import {
  errorMessage,
  type EditOperation,
  type EditReceipt,
} from "../card-edit-session";
import type { BoardState } from "../types";

const names: Record<string, string> = {
  title: "Titel",
  description: "Beschreibung",
  assignee_id: "Zuständig",
  label_ids: "Labels",
  column_id: "Spalte",
  completed_at: "Status",
  reviewed_at: "Gelesen",
  attachment: "Anhang",
  comment_attachment: "Nachrichtenanhang",
  comment: "Kommentar",
  deleted_at: "Karte",
};
export function CardUndoToast({
  offer,
  state,
  update,
  remove,
}: {
  offer: EditReceipt;
  state: BoardState;
  update: (
    offer: EditReceipt,
    operation: EditOperation,
  ) => Promise<EditReceipt>;
  remove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"idle" | "undoing" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [exiting, setExiting] = useState(false);
  const exitStarted = useRef(false);
  const removed = useRef(false);
  const resolving = useRef(false);
  const callbacks = useRef({ update, remove });
  callbacks.current = { update, remove };
  const paused = expanded || hovered || focused || exiting || phase !== "idle";
  const beginExit = () => {
    if (exitStarted.current) return false;
    exitStarted.current = true;
    resolving.current = true;
    setExiting(true);
    return true;
  };
  const finishExit = () => {
    if (!exitStarted.current || removed.current) return;
    removed.current = true;
    callbacks.current.remove(offer.id);
  };
  const dismiss = () => {
    if (!beginExit() || phase === "done") return;
    void callbacks.current.update(offer, "discard").catch(() => {
      /* Server expiry is the fallback. */
    });
  };
  useEffect(() => {
    if (!exiting) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishExit();
      return;
    }
    // animationend normally removes the toast; never leave it stuck if the
    // browser cancels the animation or the stylesheet is unavailable.
    const timer = setTimeout(finishExit, 350);
    return () => clearTimeout(timer);
  }, [exiting, offer.id]);
  useEffect(() => {
    if (exiting) return;
    if (phase === "done") {
      const timer = setTimeout(beginExit, 1000);
      return () => clearTimeout(timer);
    }
    if (phase !== "idle") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const renew = () =>
      callbacks.current.update(offer, paused ? "hold" : "offer");
    void renew()
      .then(() => {
        if (alive && !exitStarted.current && !paused) {
          setCountdown((n) => n + 1);
          timer = setTimeout(dismiss, 5000);
        }
      })
      .catch((error) => {
        if (alive && !resolving.current) {
          setMessage(errorMessage(error));
          setPhase("error");
        }
      });
    const interval = paused
      ? setInterval(() => void renew().catch(() => {}), 30000)
      : undefined;
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [offer.id, paused, phase, exiting]);
  const display = (field: string, value: unknown): string => {
    if (field === "deleted_at") return value ? "Gelöscht" : "Vorhanden";
    if (field === "completed_at") return value ? "Fertig" : "Offen";
    if (field === "reviewed_at") return value ? "Gelesen" : "Nicht gelesen";
    if (value === null || value === undefined || value === "") return "—";
    if (field === "column_id")
      return state.columns.find((c) => c.id === value)?.name || "Spalte";
    if (field === "assignee_id")
      return state.profiles.find((p) => p.id === value)?.name || "Mitglied";
    if (field === "label_ids" && Array.isArray(value))
      return (
        value
          .map((id) => state.labels.find((l) => l.id === id)?.name || "Label")
          .join(", ") || "—"
      );
    return String(value);
  };
  async function undo() {
    if (exitStarted.current) return;
    resolving.current = true;
    setPhase("undoing");
    try {
      await callbacks.current.update(offer, "undo");
      setPhase("done");
    } catch (error) {
      setMessage(errorMessage(error));
      setPhase("error");
      setExpanded(true);
    }
  }
  return (
    <section
      className={`card-undo-toast ${expanded ? "is-expanded" : ""} ${exiting ? "is-exiting" : ""}`}
      aria-label="Letzte Kartenänderungen"
      inert={exiting}
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === "undo-slide-out"
        )
          finishExit();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className="undo-toast-main">
        <span className="undo-toast-icon">
          {phase === "done" ? <Check size={18} /> : <RotateCcw size={18} />}
        </span>
        <div className="undo-toast-copy">
          <strong role="status">
            {phase === "done" ? "Rückgängig gemacht" : "Änderungen gespeichert"}
          </strong>
          <small>{offer.title}</small>
        </div>
        <button
          className="icon-button undo-expand"
          aria-expanded={expanded}
          aria-label={
            expanded ? "Änderungen einklappen" : "Änderungen anzeigen"
          }
          onClick={() => {
            if (expanded) {
              // Collapsing resumes the timer. The pointer and focus left on
              // this button must not keep the now-collapsed toast alive.
              setHovered(false);
              setFocused(false);
            }
            setExpanded((v) => !v);
          }}
        >
          <ChevronUp size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Änderungen behalten und Hinweis schließen"
          disabled={phase === "undoing"}
          onClick={dismiss}
        >
          <X size={15} />
        </button>
      </div>
      {phase !== "done" && (
        <button
          type="button"
          className="undo-last"
          onClick={() => void undo()}
          disabled={phase !== "idle"}
        >
          {phase === "undoing" ? (
            <LoaderCircle className="spin" size={14} />
          ) : (
            <RotateCcw size={14} />
          )}{" "}
          Letzte Änderungen rückgängig
        </button>
      )}
      <div className="undo-details">
        <div>
          {expanded && (
            <ol>
              {offer.events.map((event, index) => (
                <li key={index}>
                  <b>{names[event.field] || event.field}</b>
                  <div className="undo-diff">
                    <span>{display(event.field, event.before)}</span>
                    <ArrowRight size={12} />
                    <span>{display(event.field, event.after)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {message && (
        <p className="undo-error" role="alert">
          {message}
        </p>
      )}
      {!paused && countdown > 0 && (
        <span key={countdown} className="undo-countdown" />
      )}
    </section>
  );
}
