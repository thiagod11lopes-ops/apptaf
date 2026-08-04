import { Platform } from 'react-native';

/** Chromium: blur/SVG em massa (painéis glass, labels de planilha) é o principal custo visual. */
export const IS_WEB = Platform.OS === 'web';
