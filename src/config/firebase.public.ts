/**
 * Config pública do Firebase (app web apptaf-3c6d7).
 * Usada quando EXPO_PUBLIC_* não está definido no build (ex.: GitHub Pages sem secrets).
 * Chaves de cliente Firebase são públicas por design; a proteção é por domínio e regras Firestore.
 */
export const FIREBASE_PUBLIC_DEFAULTS = {
  apiKey: 'AIzaSyC7wR0NaO7lagRmyvJ-0Qt79xNnF6XAYOk',
  authDomain: 'apptaf-3c6d7.firebaseapp.com',
  projectId: 'apptaf-3c6d7',
  storageBucket: 'apptaf-3c6d7.firebasestorage.app',
  messagingSenderId: '1021019334599',
  appId: '1:1021019334599:web:bf57611be1482b27f5dbe2',
  googleWebClientId:
    '1021019334599-0mo9cjrfn3h9kh0m3gffqobq1ot95ta4.apps.googleusercontent.com',
} as const;
