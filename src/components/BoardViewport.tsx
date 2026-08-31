import { useLayoutEffect, useRef, type ReactNode } from "react";

/** One native scroll surface, with artwork between the board surface and its cards. */
export function BoardViewport({
  heading,
  controls,
  children,
}: {
  heading: ReactNode;
  controls: ReactNode;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current!;
    const intro = introRef.current!;
    const controlsElement = controlsRef.current!;
    let frame: number | null = null;

    const updateScroll = () => {
      frame = null;
      // Only the card clipping edge follows scrolling; React does not re-render.
      scroll.style.setProperty(
        "--board-scroll-y",
        `${Math.max(0, scroll.scrollTop)}px`,
      );
    };
    const measure = () => {
      const introHeight = intro.getBoundingClientRect().height;
      const controlsHeight = controlsElement.getBoundingClientRect().height;
      scroll.style.setProperty("--board-intro-height", `${introHeight}px`);
      scroll.style.setProperty(
        "--board-controls-height",
        `${controlsHeight}px`,
      );
      scroll.style.setProperty(
        "--board-hero-height",
        `${introHeight + controlsHeight}px`,
      );
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(updateScroll);
    };

    measure();
    updateScroll();
    const observer = new ResizeObserver(measure);
    observer.observe(intro);
    observer.observe(controlsElement);
    scroll.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scroll.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="board-workspace">
      <div className="board-scroll" ref={scrollRef}>
        <div className="board-hero" aria-hidden="true" />
        <div className="board-intro" ref={introRef}>
          {heading}
        </div>
        <div className="board-controls" ref={controlsRef}>
          {controls}
        </div>
        {children}
      </div>
    </div>
  );
}
