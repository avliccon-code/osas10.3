import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Support both bundled firebase-applet-config.json and runtime environment variables
const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const resolvedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId,
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(resolvedFirebaseConfig) : getApp();

// Silence internal Firestore SDK retry and backoff logs
try {
  setLogLevel('silent');
} catch (_) {}

// Initialize Firestore with specific database ID if provided
export const db = getFirestore(
  app,
  resolvedFirebaseConfig.firestoreDatabaseId || undefined
);

// Initialize Firebase Auth
export const auth = getAuth(app);

export default app;
