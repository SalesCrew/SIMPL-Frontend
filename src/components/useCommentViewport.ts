import { useCallback, useLayoutEffect, useRef } from "react";
import type { Comment } from "../types";

type ScrollMetrics = Pick<HTMLElement, "scrollHeight" | "clientHeight" | "scrollTop">;

export function isNearCommentEnd(list: ScrollMetrics) {
  return list.scrollHeight - list.clientHeight - list.scrollTop <= 32;
}

export function shouldRevealLatestComment(
  previous: { cardId?: string; commentId?: string },
  next: { cardId?: string; commentId?: string; authorId?: string },
  followingLatest: boolean,
  currentUserId: string,
) {
  return (
    previous.cardId !== next.cardId ||
    (previous.commentId !== next.commentId &&
      (followingLatest || next.authorId === currentUserId))
  );
}

export function useCommentViewport(
  cardId: string | undefined,
  latestComment: Comment | undefined,
  currentUserId: string,
) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const followingLatest = useRef(true);
  const previous = useRef({ cardId, commentId: latestComment?.id });

  const attachPanel = useCallback((panel: HTMLElement | null) => {
    if (!panel) return;
    const viewport = panel.closest<HTMLElement>(".modal-body");
    if (!viewport) return;
    const fit = () => {
      const height = `${viewport.clientHeight}px`;
      if (panel.style.getPropertyValue("--comments-viewport-height") !== height)
        panel.style.setProperty("--comments-viewport-height", height);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const attachList = useCallback((list: HTMLDivElement | null) => {
    listRef.current = list;
    if (!list) return;
    followingLatest.current = true;
    const follow = () => {
      if (followingLatest.current) list.scrollTop = list.scrollHeight;
    };
    // Callback refs also run when Radix mounts the portal after initial effects.
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(list);
    if (list.firstElementChild) observer.observe(list.firstElementChild);
    return () => {
      observer.disconnect();
      listRef.current = null;
    };
  }, []);

  const onListScroll = useCallback(() => {
    if (listRef.current)
      followingLatest.current = isNearCommentEnd(listRef.current);
  }, []);

  useLayoutEffect(() => {
    const next = {
      cardId,
      commentId: latestComment?.id,
      authorId: latestComment?.author_id,
    };
    if (
      shouldRevealLatestComment(
        previous.current,
        next,
        followingLatest.current,
        currentUserId,
      )
    ) {
      followingLatest.current = true;
      if (listRef.current)
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    previous.current = next;
  }, [cardId, latestComment?.id, latestComment?.author_id, currentUserId]);

  return { attachPanel, attachList, onListScroll };
}
