import { useCallback, useEffect, useRef, useState } from 'react';

export const SYNC_QUICK_OVERLAY_MS = 5000;

/** Overlay ultracurto ao salvar; sync continua em segundo plano após sumir. */
export function useSyncQuickOverlay() {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, SYNC_QUICK_OVERLAY_MS);
  }, [clearHideTimer]);

  const showOverlay = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return { overlayVisible: visible, showOverlay };
}
