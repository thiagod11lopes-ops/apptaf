import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/** Trava orientação horizontal durante corrida/natação (nativo). No web tenta Screen Orientation API. */
export async function lockProvaLandscape(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const orient = screen.orientation as {
        lock?: (orientation: string) => Promise<void>;
      };
      if (typeof orient?.lock === 'function') {
        await orient.lock('landscape');
        return true;
      }
    } catch {
      // Navegador pode exigir gesto do usuário ou fullscreen.
    }
    return false;
  }

  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return true;
  } catch {
    return false;
  }
}

/** Restaura orientação ao sair da prova. */
export async function unlockProvaPortrait(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const orient = screen.orientation as { unlock?: () => Promise<void> };
      if (typeof orient?.unlock === 'function') {
        await orient.unlock();
      }
    } catch {
      // ignorar
    }
    return;
  }

  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    // ignorar
  }
}
