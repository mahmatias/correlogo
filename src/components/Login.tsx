import { useState, FormEvent } from 'react';
import { getAuth } from '../lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithCredential, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseErrorPt } from '../lib/firebaseErrorsPtBr';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

interface Props {
  onSignupClick: () => void;
}

export default function Login({ onSignupClick }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            setLoading(false);
            return;
        }
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError(getFirebaseErrorPt(err));
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (loading) return;
        setLoading(true);
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            setLoading(false);
            return;
        }
        try {
            if (Capacitor.isNativePlatform()) {
                console.log('[GoogleLogin] calling FirebaseAuthentication.signInWithGoogle()');
                const result = await FirebaseAuthentication.signInWithGoogle();
                console.log('[GoogleLogin] signInWithGoogle result keys:', Object.keys(result));
                console.log('[GoogleLogin] result.user:', result.user?.displayName, result.user?.email);
                console.log('[GoogleLogin] result.credential:', result.credential ? 'present' : 'undefined');
                if (result.credential) {
                    console.log('[GoogleLogin] credential keys:', Object.keys(result.credential));
                    console.log('[GoogleLogin] idToken present:', !!result.credential.idToken);
                    console.log('[GoogleLogin] accessToken present:', !!result.credential.accessToken);
                }
                const idToken = result.credential?.idToken;
                const accessToken = result.credential?.accessToken;
                if (idToken) {
                    console.log('[GoogleLogin] calling GoogleAuthProvider.credential()');
                    const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
                    console.log('[GoogleLogin] calling signInWithCredential(auth, credential)');
                    await signInWithCredential(auth, credential);
                    console.log('[GoogleLogin] signInWithCredential OK');
                } else {
                    console.error('[GoogleLogin] No idToken in credential result');
                    setError('Erro: Google não retornou token de autenticação');
                }
                setLoading(false);
            } else {
                const provider = new GoogleAuthProvider();
                console.log('[GoogleLogin] calling signInWithPopup (web)');
                await signInWithPopup(auth, provider);
                console.log('[GoogleLogin] signInWithPopup OK');
            }
        } catch (err: any) {
            console.error('[GoogleLogin] ERROR:', err?.code, err?.message);
            console.error('[GoogleLogin] full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
                setError(getFirebaseErrorPt(err));
            }
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Digite seu email primeiro.');
            return;
        }
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setError('');
            setSuccessMsg('Email de redefinição de senha enviado!');
        } catch (err: any) {
            setSuccessMsg('');
            setError(getFirebaseErrorPt(err));
        }
    };

    return (
        <form onSubmit={handleLogin} className="max-w-md mx-auto p-4 border rounded bg-bg-surface border-border text-text-primary">
            <h2 className="text-xl mb-4">Login</h2>
            <label htmlFor="login-email" className="sr-only">Email</label>
            <input id="login-email" type="email" placeholder="Email" className="border p-2 mb-2 w-full rounded bg-bg-elevated border-border text-text-primary" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <label htmlFor="login-password" className="sr-only">Senha</label>
            <input id="login-password" type="password" placeholder="Senha" className="border p-2 mb-2 w-full rounded bg-bg-elevated border-border text-text-primary" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            {error && <p className="text-danger mb-2" role="alert">{error}</p>}
            {successMsg && <p className="text-success mb-2" role="status">{successMsg}</p>}
            <button type="submit" disabled={loading} className="bg-accent disabled:opacity-50 text-white p-2 rounded w-full mb-2">{loading ? 'Entrando…' : 'Entrar'}</button>
            <button type="button" disabled={loading} onClick={handleGoogleLogin} className="bg-accent-tertiary disabled:opacity-50 text-white p-2 rounded w-full mb-2">Entrar com Google</button>
            <button type="button" onClick={onSignupClick} className="text-accent-secondary w-full mb-2">Cadastrar-se</button>
            <button type="button" onClick={handleForgotPassword} className="text-text-muted w-full">Esqueci minha senha</button>
        </form>
    );
}
