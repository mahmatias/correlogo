import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth as _getAuth } from 'firebase/auth';
import { getAnalytics as _getAnalytics } from 'firebase/analytics';

let authInstance: any = null;
let dbInstance: any = null;
let analyticsInstance: any = null;

function init() {
  if (authInstance) return;

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  if (!firebaseConfig.apiKey) {
    console.warn("Firebase not initialized: Missing API Key");
    return;
  }

  const app = initializeApp(firebaseConfig);
  dbInstance = initializeFirestore(app, {});
  authInstance = _getAuth(app);
  analyticsInstance = _getAnalytics(app);
}

export const getAuth = () => { init(); return authInstance; };
export const getDb = () => { init(); return dbInstance; };
export const getAnalytics = () => { init(); return analyticsInstance; };
