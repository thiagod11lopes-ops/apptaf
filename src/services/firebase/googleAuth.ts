import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
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

export async function signInWithGoogleWeb(): Promise<AppAuthUser> {
  const auth = assertAuthConfigured();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return mapFirebaseUser(result.user);
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
