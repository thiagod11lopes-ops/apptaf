import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = '@taf/auth_session';

export type AuthSession = {
  usuario: string;
};

export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (typeof parsed?.usuario === 'string' && parsed.usuario.trim()) {
      return { usuario: parsed.usuario.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}
