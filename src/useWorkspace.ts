import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  applyDemoAction,
  restoreFixedBuckets,
  startingWorkspaceId,
  visibleBoardForActor,
  type Action,
} from "./domain";
import { apiRequest, demoMode, loadBoard, runRemote, supabase } from "./data";
import { createSeed } from "./seed";
import type { BoardState } from "./types";
import { removeLocalBlob } from "./attachments";
import {
  CardEditSession,
  type EditOperation,
  type EditReceipt,
  type EditTransport,
} from "./card-edit-session";
import { DemoCardSessions } from "./demo-card-sessions";
const demoKey = "trello-plus.demo.v1";
function initialDemo() {
  try {
    const cached = JSON.parse(localStorage.getItem(demoKey) || "null");
    if (cached?.cards && cached?.profiles && cached?.columns)
      return restoreFixedBuckets(cached as BoardState);
  } catch {
    /* Invalid device-local demo cache: start a fresh demo. */
  }
  return restoreFixedBuckets(createSeed());
}
export function useWorkspace() {
  const [state, setState] = useState<BoardState | null>(() =>
    demoMode ? initialDemo() : null,
  );
  const [user, setUser] = useState<User | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [demoUser, setDemoUser] = useState("kilian");
  const [selection, setSelection] = useState<{
    userId: string;
    workspaceId: string;
  } | null>(null);
  const [authReady, setAuthReady] = useState(demoMode || !supabase);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const requestVersion = useRef(0);
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const editQueues = useRef(new Map<string, Promise<EditReceipt>>());
  const demoSessions = useRef(new DemoCardSessions());
  const [undoOffers, setUndoOffers] = useState<EditReceipt[]>([]);
  const activeCardSession = useRef<CardEditSession | null>(null);
  useEffect(() => () => activeCardSession.current?.close(), []);
  const sessionUserId = useRef<string | null>(null);
  const current = state?.profiles.find(
    (p) => p.id === (demoMode ? demoUser : user?.id),
  );
  const actorId = useRef(current?.id);
  actorId.current = current?.id;
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = mutationQueue.current.then(work, work);
    mutationQueue.current = result.catch(() => {});
    return result;
  }
  const visibleState =
    demoMode && current && state ? visibleBoardForActor(state, current) : state;
  const activeWorkspaceId =
    current && state
      ? selection?.userId === current.id &&
        visibleState!.workspaces.some((w) => w.id === selection.workspaceId)
        ? selection.workspaceId
        : startingWorkspaceId(visibleState!, current)
      : "";
  const selectWorkspace = (workspaceId: string) => {
    if (current) setSelection({ userId: current.id, workspaceId });
  };
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const next = await loadBoard((revision) => {
        if (version !== requestVersion.current) return;
        const previous = stateRef.current?.access_revision;
        if (
          previous &&
          (!revision ||
            revision.id !== previous.id ||
            revision.authorization_version !== previous.authorization_version)
        ) {
          stateRef.current = null;
          setState(null);
        }
      });
      if (version === requestVersion.current) {
        setState(next);
        setError("");
      }
    } catch {
      if (version === requestVersion.current) {
        stateRef.current = null;
        setState(null);
        setError(
          "Zugriffsrechte konnten nicht geprüft werden. Bitte Verbindung prüfen und erneut versuchen.",
        );
      }
    }
  }, []);
  useEffect(() => {
    if (demoMode || !supabase) return;
    let alive = true;
    const receiveUser = (next: User | null) => {
      if (sessionUserId.current !== (next?.id || null)) {
        sessionUserId.current = next?.id || null;
        ++requestVersion.current;
        stateRef.current = null;
        setState(null);
        setSelection(null);
      }
      setUser(next);
      setAuthReady(true);
    };
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (alive) {
        receiveUser(data.session?.user || null);
        if (sessionError)
          setError("Deine Sitzung konnte nicht geladen werden.");
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      receiveUser(session?.user || null);
      if (!session) {
        setSelection(null);
        ++requestVersion.current;
        setState(null);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || demoMode || !supabase) return;
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const channel = supabase
      .channel(`workspace-access-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "access_revisions",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const revision = payload.new as { authorization_version?: number };
          const previous = stateRef.current?.access_revision;
          if (
            previous &&
            revision.authorization_version !== previous.authorization_version
          ) {
            ++requestVersion.current;
            stateRef.current = null;
            setState(null);
          }
          clearTimeout(timer);
          timer = setTimeout(() => void refresh(), 180);
        },
      )
      .on("system", {}, (payload) => {
        if (
          payload.extension === "postgres_changes" &&
          payload.status === "ok"
        ) {
          setConnected(true);
          void refresh();
        }
      });
    // A WebSocket join can precede database replication readiness on a cold project.
    // Authenticate before subscribing; reconcile once replication is actually ready.
    void supabase.realtime
      .setAuth()
      .then(() => {
        if (active)
          channel.subscribe((status) => {
            if (status !== "SUBSCRIBED") setConnected(false);
          });
      })
      .catch(() => setConnected(false));
    const visibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      ++requestVersion.current;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", visibility);
      void supabase!.removeChannel(channel);
      setConnected(false);
    };
  }, [user?.id, refresh]);
  useEffect(() => {
    if (!demoMode) return;
    const sync = (event: StorageEvent) => {
      if (event.key === demoKey) setState(initialDemo());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const mutate = (action: Action): Promise<boolean> =>
    enqueue(async () => {
      if (!current || !stateRef.current || current.id !== actorId.current)
        return false;
      setBusy(true);
      setError("");
      try {
        if (demoMode) {
          const latest = stateRef.current!;
          const next = applyDemoAction(latest, current, action);
          if (action.type === "card.delete")
            for (const attachment of latest.attachments.filter(
              (a) => a.card_id === action.id,
            ))
              await removeLocalBlob(attachment.id);
          if (action.type === "attachment.delete")
            await removeLocalBlob(action.id);
          localStorage.setItem(demoKey, JSON.stringify(next));
          stateRef.current = next;
          setState(next);
        } else {
          await runRemote(action);
          await refresh();
        }
        return true;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : (e as { message?: string }).message ||
                "Die Änderung konnte nicht gespeichert werden.",
        );
        return false;
      } finally {
        setBusy(false);
      }
    });
  const performEdit: EditTransport = async (id, operation, cardId, action) => {
    if (!current || current.id !== actorId.current || !stateRef.current)
      throw new Error("Die Anmeldung oder Zugriffsrechte haben sich geändert.");
    const changing = operation === "mutate" || operation === "undo";
    if (changing) {
      setBusy(true);
      setError("");
    }
    try {
      if (demoMode) {
        const result = demoSessions.current.operate(
          stateRef.current,
          current,
          id,
          operation,
          cardId,
          action,
        );
        if (result.state !== stateRef.current) {
          localStorage.setItem(demoKey, JSON.stringify(result.state));
          stateRef.current = result.state;
          setState(result.state);
        }
        // Failure to remove orphaned demo bytes must not turn a successful undo into an error.
        await Promise.allSettled(result.garbage.map(removeLocalBlob));
        return result.receipt;
      }
      const result = await supabase!.rpc("card_edit_session", {
        p_session: id,
        p_operation: operation,
        p_card: cardId,
        p_action: action || null,
      });
      if (result.error) throw result.error;
      if (changing) await refresh();
      if (operation === "undo" || operation === "discard")
        void apiRequest(`/cards/${cardId}/cleanup`, "POST").catch(() => {
          /* Retryable server cleanup also runs on future uploads. */
        });
      return result.data as EditReceipt;
    } finally {
      if (changing) setBusy(false);
    }
  };
  const editTransport: EditTransport = (id, operation, cardId, action) => {
    const work = () => performEdit(id, operation, cardId, action);
    const previous = editQueues.current.get(id) || Promise.resolve();
    const result = previous
      .catch(() => {})
      .then(async () => {
        // Preserve offer → hold ordering for this session, without putting leases
        // behind another card's slow save. Claim undo before joining the write queue.
        if (operation === "undo") await performEdit(id, "hold", cardId);
        return operation === "mutate" || operation === "undo"
          ? enqueue(work)
          : work();
      });
    editQueues.current.set(id, result);
    void result
      .finally(() => {
        if (editQueues.current.get(id) === result)
          editQueues.current.delete(id);
      })
      .catch(() => {});
    return result;
  };
  const beginCardEdit = (cardId: string) => {
    activeCardSession.current?.close();
    const session = new CardEditSession(
      cardId,
      editTransport,
      (receipt) => {
        if (actorId.current === current?.id)
          setUndoOffers((all) => [...all, receipt]);
      },
      setError,
    );
    activeCardSession.current = session;
    return session;
  };
  const finishUndoOffer = (id: string) =>
    setUndoOffers((all) => all.filter((offer) => offer.id !== id));
  const updateUndoOffer = (offer: EditReceipt, operation: EditOperation) =>
    editTransport(offer.id, operation, offer.card_id);
  useEffect(() => {
    setUndoOffers([]);
  }, [current?.id, state?.access_revision?.authorization_version]);
  return {
    state: visibleState,
    demoProfiles: demoMode ? state?.profiles || [] : [],
    current,
    user,
    authReady,
    error,
    setError,
    busy,
    connected,
    refresh,
    mutate,
    demoUser,
    setDemoUser: (id: string) => {
      setSelection(null);
      setDemoUser(id);
    },
    activeWorkspaceId,
    selectWorkspace,
    beginCardEdit,
    undoOffers,
    finishUndoOffer,
    updateUndoOffer,
  };
}
