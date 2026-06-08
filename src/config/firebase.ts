import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FIREBASE_PUBLIC_DEFAULTS } from './firebase.public';

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function readConfig(): FirebasePublicConfig | null {
  const apiKey =
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() || FIREBASE_PUBLIC_DEFAULTS.apiKey;
  const authDomain =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || FIREBASE_PUBLIC_DEFAULTS.authDomain;
  const projectId =
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() || FIREBASE_PUBLIC_DEFAULTS.projectId;
  const storageBucket =
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    FIREBASE_PUBLIC_DEFAULTS.storageBucket;
  const messagingSenderId =
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    FIREBASE_PUBLIC_DEFAULTS.messagingSenderId;
  const appId =
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() || FIREBASE_PUBLIC_DEFAULTS.appId;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket ?? '',
    messagingSenderId: messagingSenderId ?? '',
    appId,
  };
}

export const firebaseConfig = readConfig();

export function isFirebaseConfigured(): boolean {
  return firebaseConfig != null;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig) return null;
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

function createAuth(firebaseApp: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    auth = createAuth(firebaseApp);
  }
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) {
    db = getFirestore(firebaseApp);
  }
  return db;
}
