import { useCallback, useEffect, useRef, useState } from 'react';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';

export const SYNC_QUICK_OVERLAY_MS = 3000;

/** Overlay ultracurto ao salvar; sync continua em segundo plano após sumir. */
export function useSyncQuickOverlay() {
  const { syncUi } = useOfflineSyncState();
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSyncingRef = useRef(false);

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

  useEffect(() => {
    const syncing = syncUi.isSyncing;
    if (!syncing && wasSyncingRef.current && visible) {
      clearHideTimer();
      setVisible(false);
    }
    wasSyncingRef.current = syncing;
  }, [syncUi.isSyncing, visible, clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return { overlayVisible: visible, showOverlay };
}
