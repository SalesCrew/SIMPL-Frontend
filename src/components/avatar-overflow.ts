import type { Profile } from "../types";

/** The overflow control occupies one of the existing six avatar slots. */
export function avatarOverflow(profiles: Profile[]) {
  const active = profiles.filter((profile) => profile.active);
  const visibleCount = active.length > 6 ? 5 : active.length;
  return { visible: active.slice(0, visibleCount), hidden: active.slice(visibleCount) };
}

/** A 33px circle followed by 25px steps (8px overlap). */
export function avatarStackWidth(slots: number) {
  return slots > 0 ? 33 + (slots - 1) * 25 : 0;
}

/** A short bridge across the expanding row and its portalled name tooltips. */
export function delayedAvatarClose(close: () => void, shouldStayOpen: () => boolean) {
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
        if (!shouldStayOpen()) close();
      }, 180);
    },
  };
}
