import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../../config/firebase';
import { FIREBASE_PUBLIC_DEFAULTS } from '../../config/firebase.public';

WebBrowser.maybeCompleteAuthSession();

export type AppAuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type GoogleWebSignInResult =
  | { mode: 'popup'; user: AppAuthUser }
  | { mode: 'redirect' };

export function mapFirebaseUser(user: User): AppAuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function getCurrentFirebaseUid(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null;
}

function assertAuthConfigured() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase não configurado. Copie .env.example para .env e preencha as variáveis EXPO_PUBLIC_FIREBASE_*.',
    );
  }
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Não foi possível inicializar o Firebase Auth.');
  }
  return auth;
}

/** Safari e navegadores móveis bloqueiam popup — usam redirect (evita about:blank). */
export function shouldUseGoogleRedirectOnWeb(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/i.test(ua);
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function isPopupBlockedError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  );
}

export async function signInWithGoogleWeb(): Promise<GoogleWebSignInResult> {
  const auth = assertAuthConfigured();
  const provider = googleProvider();

  if (shouldUseGoogleRedirectOnWeb()) {
    await signInWithRedirect(auth, provider);
    return { mode: 'redirect' };
  }

  try {
    const result = await signInWithPopup(auth, provider);
    return { mode: 'popup', user: mapFirebaseUser(result.user) };
  } catch (error) {
    if (!isPopupBlockedError(error)) throw error;
    await signInWithRedirect(auth, provider);
    return { mode: 'redirect' };
  }
}

/** Chamar ao carregar a página web após retorno do Google (redirect). */
export async function completeGoogleRedirectSignIn(): Promise<AppAuthUser | null> {
  if (Platform.OS !== 'web') return null;
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return mapFirebaseUser(result.user);
  } catch {
    return null;
  }
}

export async function signInWithGoogleCredential(idToken: string): Promise<AppAuthUser> {
  const auth = assertAuthConfigured();
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return mapFirebaseUser(result.user);
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export function getGoogleWebClientId(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    FIREBASE_PUBLIC_DEFAULTS.googleWebClientId
  );
}

export function useGoogleAuthRequest() {
  const webClientId = getGoogleWebClientId();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();

  return Google.useAuthRequest({
    webClientId,
    iosClientId: iosClientId || webClientId,
    androidClientId: androidClientId || webClientId,
  });
}

export function canUseGoogleSignIn(): boolean {
  return isFirebaseConfigured() && !!getGoogleWebClientId();
}

export function isNativeGoogleSignIn(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
