import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { AuthSessionResult } from 'expo-auth-session';
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

/**
 * OAuth Expo só onde o popup Firebase falha (Safari / WebKit no iPhone).
 * Chrome no Android usa popup Firebase — seleciona o e-mail e loga na hora.
 */
export function shouldUseExpoGoogleAuthOnWeb(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;

  // iPhone/iPad: todos os navegadores usam WebKit (Safari, Chrome, etc.)
  if (/iPhone|iPad|iPod/i.test(ua)) return true;

  // Android Chrome/Firefox/Edge: popup Firebase funciona bem
  if (/Android/i.test(ua)) return false;

  // Safari no Mac
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/i.test(ua);
}

/** @deprecated use shouldUseExpoGoogleAuthOnWeb */
export function shouldUseGoogleRedirectOnWeb(): boolean {
  return shouldUseExpoGoogleAuthOnWeb();
}

/** URI de retorno do OAuth Google na web (GitHub Pages em /apptaf). */
export function getGoogleOAuthRedirectUri(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const basePath = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
  return `${window.location.origin}${basePath}`;
}

/** Página voltou do Google com token na URL (Safari / mobile web). */
export function hasPendingGoogleOAuthReturn(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('id_token=') ||
    hash.includes('access_token=') ||
    search.includes('code=') ||
    search.includes('state=')
  );
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

/** Login web no desktop (Chrome/Firefox) via popup Firebase. */
export async function signInWithGoogleWeb(): Promise<GoogleWebSignInResult> {
  const auth = assertAuthConfigured();
  const provider = googleProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    return { mode: 'popup', user: mapFirebaseUser(result.user) };
  } catch (error) {
    if (!isPopupBlockedError(error)) throw error;
    await signInWithRedirect(auth, provider);
    return { mode: 'redirect' };
  }
}

/** Fallback: retorno do redirect Firebase (popup bloqueado no desktop). */
export async function completeGoogleRedirectSignIn(): Promise<AppAuthUser | null> {
  if (Platform.OS !== 'web') return null;
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return mapFirebaseUser(result.user);
  } catch (error) {
    console.warn('[auth] getRedirectResult falhou:', error);
    return null;
  }
}

export function extractGoogleIdTokenFromAuthResponse(response: AuthSessionResult | null): string | null {
  if (!response || response.type !== 'success') return null;
  const fromAuth = response.authentication?.idToken;
  if (fromAuth) return fromAuth;
  const fromParams = response.params?.id_token;
  return typeof fromParams === 'string' && fromParams.length > 0 ? fromParams : null;
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
  const redirectUri = getGoogleOAuthRedirectUri();

  return Google.useIdTokenAuthRequest({
    webClientId,
    iosClientId: iosClientId || webClientId,
    androidClientId: androidClientId || webClientId,
    selectAccount: true,
    redirectUri,
  });
}

export function canUseGoogleSignIn(): boolean {
  return isFirebaseConfigured() && !!getGoogleWebClientId();
}

export function isNativeGoogleSignIn(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
