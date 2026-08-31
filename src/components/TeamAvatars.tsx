import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Profile } from "../types";
import { Avatar } from "./Board";
import { avatarOverflow, avatarStackWidth, delayedAvatarClose } from "./avatar-overflow";

export function TeamAvatars({ profiles }: { profiles: Profile[] }) {
  const { visible, hidden } = avatarOverflow(profiles);
  const [open, setOpen] = useState(false);
  const expanded = open && hidden.length > 0;
  const groupId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointerInside = useRef(false);
  const tooltipInside = useRef(false);
  const keyboardInteraction = useRef(true);
  const [availableWidth, setAvailableWidth] = useState<number>();
  const collapsedWidth = avatarStackWidth(visible.length + Number(hidden.length > 0));
  const [closeDelay] = useState(() => delayedAvatarClose(
    () => setOpen(false),
    () => pointerInside.current || tooltipInside.current ||
      (keyboardInteraction.current && !!groupRef.current?.contains(document.activeElement)),
  ));
  useEffect(() => closeDelay.cancel, [closeDelay]);
  useEffect(() => {
    if (!hidden.length) {
      closeDelay.cancel();
      setOpen(false);
    }
  }, [hidden.length, closeDelay]);

  useEffect(() => {
    const group = groupRef.current;
    const heading = group?.closest(".board-heading");
    if (!group || !heading) return;
    const title = heading.firstElementChild;
    const measure = () => {
      const left = (title || heading).getBoundingClientRect().right + 20;
      setAvailableWidth(Math.max(collapsedWidth + 4, group.getBoundingClientRect().right - left));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    if (title) observer.observe(title);
    return () => observer.disconnect();
  }, [collapsedWidth]);

  useEffect(() => {
    if (!expanded) {
      // Start each disclosure at the original members, including after a long-row swipe.
      if (viewportRef.current) viewportRef.current.scrollLeft = 0;
      return;
    }
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && groupRef.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest(`[data-team-tooltip="${groupId}"]`)) return;
      closeDelay.cancel();
      tooltipInside.current = false;
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [expanded, groupId, closeDelay]);

  const person = (profile: Profile, hiddenIndex?: number) => {
    const collapsed = hiddenIndex !== undefined && !expanded;
    return (
      <span className={`team-avatar-person${hiddenIndex === undefined ? "" : " is-overflow"}`}
        key={profile.id} data-avatar-slot aria-hidden={collapsed || undefined} inert={collapsed || undefined}
        style={hiddenIndex === undefined ? undefined : {
          "--avatar-delay": `${Math.min(hidden.length - hiddenIndex - 1, 5) * 12}ms`,
        } as CSSProperties}>
        <Avatar profile={profile} focusable={!collapsed} tooltipContentProps={{
          "data-team-tooltip": groupId,
          onPointerEnter: () => { tooltipInside.current = true; closeDelay.cancel(); },
          onPointerLeave: () => { tooltipInside.current = false; closeDelay.schedule(); },
        }} />
      </span>
    );
  };

  if (!visible.length && !hidden.length) return null;
  return (
    <div className="avatar-stack team-avatar-group" ref={groupRef} role="group" aria-label="Teammitglieder"
      data-state={expanded ? "open" : "closed"}
      style={{ "--avatar-collapsed-width": `${collapsedWidth}px`,
        "--avatar-available-width": availableWidth === undefined ? undefined : `${availableWidth}px` } as CSSProperties}
      onPointerEnter={() => { pointerInside.current = true; closeDelay.cancel(); }}
      onPointerLeave={(event) => {
        pointerInside.current = false;
        if (event.pointerType !== "touch") closeDelay.schedule();
      }}
      onPointerDownCapture={() => { keyboardInteraction.current = false; }}
      onPointerMove={() => { keyboardInteraction.current = false; }}
      onFocusCapture={closeDelay.cancel}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeDelay.schedule();
      }}
      onKeyDownCapture={(event) => {
        keyboardInteraction.current = true;
        if (event.key === "Escape" && expanded) {
          event.preventDefault();
          event.stopPropagation();
          closeDelay.cancel();
          setOpen(false);
          triggerRef.current?.focus({ preventScroll: true });
        }
      }}>
      <div className="team-avatar-row">
        <div className="team-avatar-viewport" ref={viewportRef}>
          <div className="team-avatar-people" id={groupId}>
            {visible.map((profile) => person(profile))}
            {hidden.map((profile, index) => person(profile, index))}
          </div>
        </div>
        {hidden.length > 0 && <button type="button" className="avatar avatar-more" ref={triggerRef}
          data-compact={hidden.length > 99 || undefined} aria-expanded={expanded} aria-controls={groupId}
          aria-label={expanded ? "Weitere Mitglieder ausblenden" : `${hidden.length} weitere Mitglieder anzeigen`}
          onPointerEnter={(event) => {
            closeDelay.cancel();
            if (event.pointerType !== "touch") setOpen(true);
          }}
          onClick={() => { closeDelay.cancel(); setOpen((value) => !value); }}>
          <span aria-hidden="true">+{hidden.length}</span>
        </button>}
      </div>
    </div>
  );
}
