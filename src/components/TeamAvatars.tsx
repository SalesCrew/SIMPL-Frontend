import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronRight } from "lucide-react";
import type { Profile } from "../types";
import { Avatar } from "./Board";
import { avatarOverflow, delayedAvatarClose } from "./avatar-overflow";

export function TeamAvatars({ profiles }: { profiles: Profile[] }) {
  const { visible, hidden } = avatarOverflow(profiles);
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hoverOpened = useRef(false);
  const skipFocusRestore = useRef(false);
  const [closeDelay] = useState(() => delayedAvatarClose(
    () => setOpen(false),
    () => !!(groupRef.current?.contains(document.activeElement) || contentRef.current?.contains(document.activeElement)),
  ));
  useEffect(() => closeDelay.cancel, [closeDelay]);

  useEffect(() => {
    if (!open || !hidden.length) return;
    // A portalled strip must not linger after its header scrolls out of view.
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return;
      closeDelay.cancel();
      // Returning focus here could scroll the disappearing header back into view.
      skipFocusRestore.current = true;
      setOpen(false);
    };
    document.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, hidden.length, closeDelay]);

  const leave = (event: PointerEvent) => {
    if (open && event.pointerType !== "touch") closeDelay.schedule();
  };
  const changeOpen = (next: boolean) => {
    closeDelay.cancel();
    // Activation by keyboard or tap uses the primitive's normal focus handling.
    if (next) {
      hoverOpened.current = false;
      skipFocusRestore.current = false;
    }
    setOpen(next);
  };

  if (!visible.length && !hidden.length) return null;
  return (
    <div className="avatar-stack team-avatar-group" ref={groupRef} role="group" aria-label="Teammitglieder"
      onPointerEnter={closeDelay.cancel} onPointerLeave={leave}>
      {hidden.length > 0 && <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button type="button" className="avatar avatar-more" data-compact={hidden.length > 99 || undefined}
            aria-label={open ? "Weitere Mitglieder ausblenden" : `${hidden.length} weitere Mitglieder anzeigen`}
            onPointerEnter={(event) => {
              closeDelay.cancel();
              if (event.pointerType !== "touch" && !open) {
                hoverOpened.current = true;
                skipFocusRestore.current = true;
                setOpen(true);
              }
            }}>
            <span className="avatar-more-count" aria-hidden="true">+{hidden.length}</span>
            <span className="avatar-more-close" aria-hidden="true"><ChevronRight size={14} /></span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="team-overflow-popover" ref={contentRef} side="left" align="center" sideOffset={-4}
            collisionBoundary={groupRef.current?.closest(".main-area") ?? undefined} collisionPadding={16} hideWhenDetached
            aria-label={`${hidden.length} weitere Teammitglieder`}
            onPointerEnter={closeDelay.cancel} onPointerLeave={leave}
            onOpenAutoFocus={(event) => { if (hoverOpened.current) event.preventDefault(); }}
            onCloseAutoFocus={(event) => { if (skipFocusRestore.current) event.preventDefault(); }}>
            <div className="team-overflow-list">
              {hidden.map((profile, index) => <span className="team-overflow-person" key={profile.id}
                style={{ "--avatar-delay": `${Math.min(hidden.length - index - 1, 7) * 16}ms` } as CSSProperties}>
                <Avatar profile={profile} focusable />
              </span>)}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>}
      {visible.map((profile) => <Avatar key={profile.id} profile={profile} focusable />)}
    </div>
  );
}
