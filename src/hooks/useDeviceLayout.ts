import { Platform, useWindowDimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 768;

/** Telas compactas (celular/tablet) — sidebar some em paisagem. */
const COMPACT_MAX_LONG_EDGE = 1100;

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

  const usePhoneFrame = isDesktopWeb;

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
