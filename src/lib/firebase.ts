/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth as _getAuth } from 'firebase/auth';

let authInstance: any = null;
let dbInstance: any = null;
let appInitialized = false;

function init() {
  if (appInitialized) return;
  appInitialized = true;

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

  const t = performance.now();
  const app = initializeApp(firebaseConfig);
  console.log(`[timing] initializeApp: ${(performance.now() - t).toFixed(0)}ms`);

  const t2 = performance.now();
  dbInstance = initializeFirestore(app, {});
  console.log(`[timing] initializeFirestore: ${(performance.now() - t2).toFixed(0)}ms`);

  enableIndexedDbPersistence(dbInstance).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("[persistence] Falhou: múltiplas abas abertas — cache desabilitado");
    } else if (err.code === 'unimplemented') {
      console.warn("[persistence] Navegador não suporta IndexedDB — cache desabilitado");
    } else {
      console.warn("[persistence] Erro inesperado:", err);
    }
  });

  const t3 = performance.now();
  authInstance = _getAuth(app);
  console.log(`[timing] getAuth: ${(performance.now() - t3).toFixed(0)}ms`);

  console.log(`[timing] Firebase init total: ${(performance.now() - t).toFixed(0)}ms`);
}

let analyticsInstance: any = null;
export const getAnalytics = async () => {
  if (!analyticsInstance) {
    const { getAnalytics: _getAnalytics } = await import('firebase/analytics');
    const app = await import('firebase/app').then(m => m.getApp());
    analyticsInstance = _getAnalytics(app);
  }
  return analyticsInstance;
};

export const getAuth = () => { init(); return authInstance; };
export const getDb = () => { init(); return dbInstance; };