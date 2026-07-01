import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 768;

/** Proporção da área útil (retrato), semelhante a tablet 11". */
export const TABLET_VIEWPORT_WIDTH = 834;
export const TABLET_VIEWPORT_HEIGHT = 1112;
export const TABLET_VIEWPORT_ASPECT = TABLET_VIEWPORT_WIDTH / TABLET_VIEWPORT_HEIGHT;

/** Telas compactas (celular/tablet) — sidebar some em paisagem. */
export const COMPACT_MAX_LONG_EDGE = 1100;

export function isMobileOrTabletUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

export function isTouchPrimaryWeb(opts: { pointerCoarse: boolean; hoverNone: boolean }): boolean {
  return opts.pointerCoarse && opts.hoverNone;
}

/** Moldura iPhone desativada — desktop web usa moldura de tablet. */
export function resolveUsePhoneFrame(_params: {
  isWeb: boolean;
  width: number;
  height: number;
  userAgent?: string;
  pointerCoarse?: boolean;
  hoverNone?: boolean;
}): boolean {
  return false;
}

/** Moldura de tablet no navegador desktop (mouse/teclado) — nunca em apps nativas. */
export function resolveUseTabletFrame(params: {
  isWeb: boolean;
  width: number;
  userAgent?: string;
  pointerCoarse?: boolean;
  hoverNone?: boolean;
}): boolean {
  if (!params.isWeb) return false;
  if (params.width < DESKTOP_BREAKPOINT) return false;
  if (isMobileOrTabletUserAgent(params.userAgent ?? '')) return false;
  if (isTouchPrimaryWeb({ pointerCoarse: !!params.pointerCoarse, hoverNone: !!params.hoverNone })) {
    return false;
  }
  return true;
}

export function computeTabletFrameSize(viewportWidth: number, viewportHeight: number): {
  width: number;
  height: number;
} {
  const maxW = Math.min(TABLET_VIEWPORT_WIDTH, viewportWidth * 0.94);
  const maxH = Math.min(TABLET_VIEWPORT_HEIGHT, viewportHeight * 0.94);
  let width = maxW;
  let height = width / TABLET_VIEWPORT_ASPECT;
  if (height > maxH) {
    height = maxH;
    width = height * TABLET_VIEWPORT_ASPECT;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function readTouchPrimaryWeb(): { pointerCoarse: boolean; hoverNone: boolean } {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
    return { pointerCoarse: false, hoverNone: false };
  }
  return {
    pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
    hoverNone: window.matchMedia('(hover: none)').matches,
  };
}

export function useDeviceLayout() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= DESKTOP_BREAKPOINT;
  const isMobileWeb = isWeb && width < DESKTOP_BREAKPOINT;
  const isNative = Platform.OS !== 'web';
  const isLandscape = width > height;
  const longEdge = Math.max(width, height);
  const isCompactDevice = longEdge < COMPACT_MAX_LONG_EDGE;

  const touchPrimary = readTouchPrimaryWeb();
  const userAgent = isWeb && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const usePhoneFrame = resolveUsePhoneFrame({
    isWeb,
    width,
    height,
    userAgent,
    pointerCoarse: touchPrimary.pointerCoarse,
    hoverNone: touchPrimary.hoverNone,
  });
  const useTabletFrame = resolveUseTabletFrame({
    isWeb,
    width,
    userAgent,
    pointerCoarse: touchPrimary.pointerCoarse,
    hoverNone: touchPrimary.hoverNone,
  });
  const hideSidebarForLandscape =
    isLandscape && (isCompactDevice || useTabletFrame);

  return {
    width,
    height,
    isWeb,
    isDesktopWeb,
    isMobileWeb,
    isNative,
    isLandscape,
    isPortrait: !isLandscape,
    isCompactDevice,
    hideSidebarForLandscape,
    /** Desktop web sem moldura: sidebar; tablet/nativo/mobile web: abas inferiores */
    useSidebarShell: isDesktopWeb && !hideSidebarForLandscape && !useTabletFrame,
    usePhoneFrame,
    useTabletFrame,
  };
}
