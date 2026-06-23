import { useState, FormEvent } from 'react';
import { getAuth } from '../lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

interface Props {
  onSignupClick: () => void;
}

export default function Login({ onSignupClick }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            return;
        }
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            return;
        }
        try {
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err.message);
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
            alert('Email de redefinição de senha enviado!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleLogin} className="max-w-md mx-auto p-4 border rounded bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
            <h2 className="text-xl mb-4">Login</h2>
            <input placeholder="Email" className="border p-2 mb-2 w-full rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Senha" className="border p-2 mb-2 w-full rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <p className="text-red-500">{error}</p>}
            <button type="submit" className="bg-blue-500 text-white p-2 rounded w-full mb-2">Entrar</button>
            <button type="button" onClick={handleGoogleLogin} className="bg-red-500 text-white p-2 rounded w-full mb-2">Entrar com Google</button>
            <button type="button" onClick={onSignupClick} className="text-blue-500 w-full mb-2">Cadastrar-se</button>
            <button type="button" onClick={handleForgotPassword} className="text-gray-500 w-full">Esqueci minha senha</button>
        </form>
    );
}
