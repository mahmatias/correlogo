import { useState, FormEvent } from 'react';
import { getAuth } from '../lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseErrorPt } from '../lib/firebaseErrorsPtBr';

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
        const provider = new GoogleAuthProvider();
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            setLoading(false);
            return;
        }
        try {
            await signInWithRedirect(auth, provider);
        } catch (err: any) {
            setError(getFirebaseErrorPt(err));
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
