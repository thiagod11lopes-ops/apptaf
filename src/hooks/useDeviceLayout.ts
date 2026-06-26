import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 768;

/** Telas compactas (celular/tablet) — sidebar some em paisagem. */
export const COMPACT_MAX_LONG_EDGE = 1100;

export function isMobileOrTabletUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

export function isTouchPrimaryWeb(opts: { pointerCoarse: boolean; hoverNone: boolean }): boolean {
  return opts.pointerCoarse && opts.hoverNone;
}

/** Moldura iPhone só em desktop web com mouse; nunca em celular/PWA/tablet. */
export function resolveUsePhoneFrame(params: {
  isWeb: boolean;
  width: number;
  height: number;
  userAgent?: string;
  pointerCoarse?: boolean;
  hoverNone?: boolean;
}): boolean {
  const { isWeb, width, height } = params;
  if (!isWeb || width < DESKTOP_BREAKPOINT) return false;

  const ua = params.userAgent ?? '';
  if (isMobileOrTabletUserAgent(ua)) return false;

  const longEdge = Math.max(width, height);
  if (longEdge < COMPACT_MAX_LONG_EDGE) return false;

  if (
    isTouchPrimaryWeb({
      pointerCoarse: params.pointerCoarse ?? false,
      hoverNone: params.hoverNone ?? false,
    })
  ) {
    return false;
  }

  return true;
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
  /** Celular deitado: oculta menu lateral com abas */
  const hideSidebarForLandscape = isLandscape && isCompactDevice;

  const touchPrimary = readTouchPrimaryWeb();
  const usePhoneFrame = resolveUsePhoneFrame({
    isWeb,
    width,
    height,
    userAgent: isWeb && typeof navigator !== 'undefined' ? navigator.userAgent : '',
    pointerCoarse: touchPrimary.pointerCoarse,
    hoverNone: touchPrimary.hoverNone,
  });

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
    /** Desktop web: moldura de celular; mobile usa layout nativo sem sidebar */
    useSidebarShell: isDesktopWeb && !hideSidebarForLandscape && !usePhoneFrame,
    usePhoneFrame,
  };
}
