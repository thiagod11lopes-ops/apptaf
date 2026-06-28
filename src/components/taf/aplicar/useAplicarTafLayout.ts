import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Largura típica de telefone — acima disso (tablet) pode usar layout mais horizontal. */
export const APLICAR_TAF_PHONE_MAX_WIDTH = 520;

/** Telas muito estreitas (ex.: iPhone SE). */
export const APLICAR_TAF_NARROW_MAX_WIDTH = 380;

export function useAplicarTafLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
  const isPhoneWidth = width < APLICAR_TAF_PHONE_MAX_WIDTH;
  const isNarrowPhone = width < APLICAR_TAF_NARROW_MAX_WIDTH;

  /** Android/iOS sempre empilham; web estreita também. */
  const participantStacked = isNativeMobile || isPhoneWidth;

  const horizontalPad = isNativeMobile ? 16 : 18;
  const provaTileWidth = Math.floor((width - horizontalPad * 2 - 10) / 2);

  return {
    width,
    height,
    insets,
    isNativeMobile,
    isPhoneWidth,
    isNarrowPhone,
    participantStacked,
    provaTileWidth: Math.max(provaTileWidth, 140),
    horizontalPad,
    scrollBottomPad: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8),
    modalBottomPad: Math.max(insets.bottom, 10),
  };
}
