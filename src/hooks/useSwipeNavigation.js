import { useEffect, useRef } from "react";

const IGNORE_SELECTORS = [
  'input[type="range"]',
  '[data-swipe-ignore="true"]',
  ".progressBar",
  ".crossfadeAdjuster",
].join(", ");

export function useSwipeNavigation(onBack, threshold = 80) {
  const startX = useRef(0);
  const startY = useRef(0);
  const cancelled = useRef(false);
  const onBackRef = useRef(onBack); // ← estabiliza a referência

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    function shouldIgnore(target) {
      if (!target) return false;
      return !!target.closest(IGNORE_SELECTORS);
    }

    function onTouchStart(e) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      cancelled.current = shouldIgnore(e.target);
    }

    function onTouchMove(e) {
      if (cancelled.current) return;

      const diffX = e.touches[0].clientX - startX.current;
      const diffY = e.touches[0].clientY - startY.current;

      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
        cancelled.current = true;
        return;
      }

      // ← Só cancela se o TARGET DIRETO for ignorável, não os ancestrais
      if (e.target.matches?.(IGNORE_SELECTORS)) {
        cancelled.current = true;
      }
    }

    function onTouchEnd(e) {
      if (cancelled.current) return;

      const diffX = e.changedTouches[0].clientX - startX.current;
      const diffY = e.changedTouches[0].clientY - startY.current;

      if (Math.abs(diffY) > Math.abs(diffX)) return;
      if (diffX < -threshold) onBackRef.current?.(); // ← era > threshold
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [threshold]);
}
