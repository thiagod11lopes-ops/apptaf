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

function readOAuthReturnParams(): URLSearchParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  const source = hash.includes('=') ? hash : window.location.search.replace(/^\?/, '');
  if (!source) return null;
  return new URLSearchParams(source);
}

/** Página voltou do Google com token ou erro na URL (Safari / iOS web). */
export function hasPendingGoogleOAuthReturn(): boolean {
  const params = readOAuthReturnParams();
  if (!params) return false;
  return (
    params.has('id_token') ||
    params.has('access_token') ||
    params.has('code') ||
    params.has('state') ||
    params.has('error')
  );
}

/** Lê id_token após redirect de página inteira (Safari). */
export function parseGoogleIdTokenFromWindow(): string | null {
  const params = readOAuthReturnParams();
  const token = params?.get('id_token');
  return token && token.length > 0 ? token : null;
}

export function parseGoogleOAuthErrorFromWindow(): string | null {
  const params = readOAuthReturnParams();
  if (!params?.has('error')) return null;
  return (
    params.get('error_description') ||
    params.get('error') ||
    'Erro ao autenticar com Google.'
  );
}

/** Remove #id_token=... da barra de endereço após login. */
export function clearOAuthParamsFromWindow(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.hash && !url.search) return;
  url.hash = '';
  url.search = '';
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

/** Safari iOS: redirect na mesma aba (popup do expo-web-browser trava). */
export function startGoogleOAuthFullPageRedirect(authUrl: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('Redirect OAuth só está disponível na web.');
  }
  window.location.assign(authUrl);
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

/** Em produção (GitHub Pages etc.) COOP bloqueia popup Firebase — usar redirect. */
function shouldPreferGoogleRedirectOnWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

/** Login web no desktop (Chrome/Firefox) via popup Firebase. */
export async function signInWithGoogleWeb(): Promise<GoogleWebSignInResult> {
  const auth = assertAuthConfigured();
  const provider = googleProvider();

  if (auth.currentUser) {
    return { mode: 'popup', user: mapFirebaseUser(auth.currentUser) };
  }

  if (shouldPreferGoogleRedirectOnWeb()) {
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
