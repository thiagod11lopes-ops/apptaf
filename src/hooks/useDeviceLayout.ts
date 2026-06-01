import { Platform, useWindowDimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 768;

export function useDeviceLayout() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= DESKTOP_BREAKPOINT;
  const isMobileWeb = isWeb && width < DESKTOP_BREAKPOINT;
  const isNative = Platform.OS !== 'web';

  return {
    width,
    height,
    isWeb,
    isDesktopWeb,
    isMobileWeb,
    isNative,
    /** Shell SISMAV com sidebar no desktop web */
    useSidebarShell: isDesktopWeb,
    /** Frame de telefone desativado — layout institucional full-width */
    usePhoneFrame: false,
  };
}
