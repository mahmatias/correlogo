import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, signInWithCredential, getAuth } from 'firebase/auth';

export async function signInWithGoogleNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('signInWithGoogleNative is only available on native platforms');
  }
  const result = await FirebaseAuthentication.signInWithGoogle();
  const credential = GoogleAuthProvider.credential(result.credential?.idToken);
  const auth = getAuth();
  await signInWithCredential(auth, credential);
}

export async function signOutNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await FirebaseAuthentication.signOut();
}

export function isGoogleSignInAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export type AuthStateChange = {
  user: any;
};

export function addAuthStateChangeListener(listener: (event: AuthStateChange) => void): void {
  FirebaseAuthentication.addListener('authStateChange', listener);
}

export function removeAllAuthListeners(): Promise<void> {
  return FirebaseAuthentication.removeAllListeners();
}