
import { useState, useMemo, FormEvent } from 'react';
import { getAuth } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { CheckCircle, XCircle } from 'lucide-react';

export default function Signup() {
    const [formData, setFormData] = useState({
        name: '', surname: '', gender: '', otherGender: '', dob: '',
        email: '', confirmEmail: '', password: '', confirmPassword: '', termsAccepted: false
    });
    const [error, setError] = useState('');

    const isEmailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), [formData.email]);
    const emailsMatch = useMemo(() => formData.email !== '' && formData.email === formData.confirmEmail, [formData.email, formData.confirmEmail]);
    
    const passwordRequirements = useMemo(() => ({
        length: formData.password.length >= 6,
        number: /\d/.test(formData.password),
        upper: /[A-Z]/.test(formData.password),
    }), [formData.password]);
    const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
    const passwordsMatch = formData.password !== '' && formData.password === formData.confirmPassword;

    const [showPassPanel, setShowPassPanel] = useState(false);

    const handleSignup = async (e: FormEvent) => {
        e.preventDefault();
        if (!isEmailValid || !emailsMatch || !isPasswordValid || !passwordsMatch || !formData.termsAccepted) {
            setError('Por favor, corrija os erros no formulário.');
            return;
        }
        const auth = getAuth();
        if (!auth) {
            setError('Serviço de autenticação não configurado.');
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            await updateProfile(userCredential.user, { displayName: `${formData.name} ${formData.surname}` });
        } catch (err: any) {
            setError(err.message);
        }
    };

    const inputClass = "border p-2 mb-2 w-full rounded bg-bg-elevated border-border text-text-primary";
    const iconClass = "absolute right-2 top-2";

    return (
        <form onSubmit={handleSignup} className="max-w-md mx-auto p-4 border rounded bg-bg-surface border-border text-text-primary">
            <h2 className="text-xl mb-4">Cadastro</h2>
            <label htmlFor="signup-name" className="sr-only">Nome</label>
            <input id="signup-name" placeholder="Nome" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoComplete="given-name" />
            <label htmlFor="signup-surname" className="sr-only">Sobrenome</label>
            <input id="signup-surname" placeholder="Sobrenome" className={inputClass} value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} autoComplete="family-name" />
            
            <label htmlFor="signup-gender" className="sr-only">Gênero</label>
            <select id="signup-gender" className={inputClass} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option value="">Selecione o Gênero</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Não-binário">Não-binário</option>
                <option value="Agênero">Agênero</option>
                <option value="Prefiro não informar">Prefiro não informar</option>
                <option value="Outro">Outro</option>
            </select>
            {formData.gender === 'Outro' && <><label htmlFor="signup-other-gender" className="sr-only">Especifique o gênero</label><input id="signup-other-gender" placeholder="Especifique (max 20)" maxLength={20} className={inputClass} value={formData.otherGender} onChange={e => setFormData({...formData, otherGender: e.target.value})} /></>}
            
            <label htmlFor="signup-dob" className="sr-only">Data de nascimento</label>
            <input id="signup-dob" type="date" className={inputClass} value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
            
            <div className="relative">
                <label htmlFor="signup-email" className="sr-only">Email</label>
                <input id="signup-email" placeholder="Email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} autoComplete="email" />
                {isEmailValid ? <CheckCircle className={`${iconClass} text-green-500`} aria-hidden="true" /> : <XCircle className={`${iconClass} text-red-500`} aria-hidden="true" />}
                <span className="sr-only">{formData.email ? (isEmailValid ? 'Email válido' : 'Email inválido') : ''}</span>
            </div>
            <div className="relative">
                <label htmlFor="signup-confirm-email" className="sr-only">Confirme o Email</label>
                <input id="signup-confirm-email" placeholder="Confirme o Email" className={inputClass} value={formData.confirmEmail} onChange={e => setFormData({...formData, confirmEmail: e.target.value})} autoComplete="email" />
                {emailsMatch ? <CheckCircle className={`${iconClass} text-green-500`} aria-hidden="true" /> : <XCircle className={`${iconClass} text-red-500`} aria-hidden="true" />}
                <span className="sr-only">{formData.confirmEmail ? (emailsMatch ? 'Emails coincidem' : 'Emails não coincidem') : ''}</span>
            </div>
            
            <div className="relative">
                <label htmlFor="signup-password" className="sr-only">Senha</label>
                <input id="signup-password" type="password" placeholder="Senha" className={inputClass} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} onFocus={() => setShowPassPanel(true)} autoComplete="new-password" />
                {isPasswordValid ? <CheckCircle className={`${iconClass} text-green-500`} aria-hidden="true" /> : <XCircle className={`${iconClass} text-red-500`} aria-hidden="true" />}
                <span className="sr-only">{formData.password ? (isPasswordValid ? 'Senha válida' : 'Senha inválida') : ''}</span>
            </div>
            {showPassPanel && (
                <div className="text-sm mb-2 p-2 bg-bg-elevated rounded" role="list">
                    <p className={passwordRequirements.length ? 'text-green-500' : 'text-red-500'} role="listitem">{passwordRequirements.length ? '✓' : '✗'} 6+ caracteres</p>
                    <p className={passwordRequirements.number ? 'text-green-500' : 'text-red-500'} role="listitem">{passwordRequirements.number ? '✓' : '✗'} 1 número</p>
                    <p className={passwordRequirements.upper ? 'text-green-500' : 'text-red-500'} role="listitem">{passwordRequirements.upper ? '✓' : '✗'} 1 maiúscula</p>
                </div>
            )}
            <div className="relative">
                <label htmlFor="signup-confirm-password" className="sr-only">Confirme a Senha</label>
                <input id="signup-confirm-password" type="password" placeholder="Confirme a Senha" className={inputClass} value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} autoComplete="new-password" />
                {passwordsMatch ? <CheckCircle className={`${iconClass} text-green-500`} aria-hidden="true" /> : <XCircle className={`${iconClass} text-red-500`} aria-hidden="true" />}
                <span className="sr-only">{formData.confirmPassword ? (passwordsMatch ? 'Senhas coincidem' : 'Senhas não coincidem') : ''}</span>
            </div>
            
            <label className="flex items-center mb-4">
                <input type="checkbox" checked={formData.termsAccepted} onChange={e => setFormData({...formData, termsAccepted: e.target.checked})} className="mr-2" />
                Aceito os <a href="#" className="text-accent-secondary underline ml-1">Termos de Serviço</a>
            </label>

            {error && <p className="text-red-500 mb-2" role="alert">{error}</p>}
            <button type="submit" className="bg-accent text-white p-2 rounded w-full">Cadastrar</button>
        </form>
    );
}
