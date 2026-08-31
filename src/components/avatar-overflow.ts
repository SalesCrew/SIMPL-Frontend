import type { Profile } from "../types";

/** The overflow control occupies one of the existing six avatar slots. */
export function avatarOverflow(profiles: Profile[]) {
  const active = profiles.filter((profile) => profile.active);
  const visibleCount = active.length > 6 ? 5 : active.length;
  return { visible: active.slice(0, visibleCount), hidden: active.slice(visibleCount) };
}

/** A short bridge between the trigger, its portalled circles and their tooltips. */
export function delayedAvatarClose(close: () => void, hasFocus: () => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    cancel,
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        if (!hasFocus()) close();
      }, 180);
    },
  };
}
