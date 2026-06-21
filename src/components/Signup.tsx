
import { useState, useMemo } from 'react';
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

    const handleSignup = async (e: React.FormEvent) => {
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

    const inputClass = "border p-2 mb-2 w-full rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100";
    const iconClass = "absolute right-2 top-2";

    return (
        <form onSubmit={handleSignup} className="max-w-md mx-auto p-4 border rounded bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
            <h2 className="text-xl mb-4">Cadastro</h2>
            <input placeholder="Nome" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input placeholder="Sobrenome" className={inputClass} value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} />
            
            <select className={inputClass} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option value="">Selecione o Gênero</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Não-binário">Não-binário</option>
                <option value="Agênero">Agênero</option>
                <option value="Prefiro não informar">Prefiro não informar</option>
                <option value="Outro">Outro</option>
            </select>
            {formData.gender === 'Outro' && <input placeholder="Especifique (max 20)" maxLength={20} className={inputClass} value={formData.otherGender} onChange={e => setFormData({...formData, otherGender: e.target.value})} />}
            
            <input type="date" className={inputClass} value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
            
            <div className="relative">
                <input placeholder="Email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                {isEmailValid ? <CheckCircle className={`${iconClass} text-green-500`} /> : <XCircle className={`${iconClass} text-red-500`} />}
            </div>
            <div className="relative">
                <input placeholder="Confirme o Email" className={inputClass} value={formData.confirmEmail} onChange={e => setFormData({...formData, confirmEmail: e.target.value})} />
                {emailsMatch ? <CheckCircle className={`${iconClass} text-green-500`} /> : <XCircle className={`${iconClass} text-red-500`} />}
            </div>
            
            <div className="relative">
                <input type="password" placeholder="Senha" className={inputClass} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} onFocus={() => setShowPassPanel(true)} />
                {isPasswordValid ? <CheckCircle className={`${iconClass} text-green-500`} /> : <XCircle className={`${iconClass} text-red-500`} />}
            </div>
            {showPassPanel && (
                <div className="text-sm mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    <p className={passwordRequirements.length ? 'text-green-500' : 'text-red-500'}>{passwordRequirements.length ? '✓' : '✗'} 6+ caracteres</p>
                    <p className={passwordRequirements.number ? 'text-green-500' : 'text-red-500'}>{passwordRequirements.number ? '✓' : '✗'} 1 número</p>
                    <p className={passwordRequirements.upper ? 'text-green-500' : 'text-red-500'}>{passwordRequirements.upper ? '✓' : '✗'} 1 maiúscula</p>
                </div>
            )}
            <div className="relative">
                <input type="password" placeholder="Confirme a Senha" className={inputClass} value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                {passwordsMatch ? <CheckCircle className={`${iconClass} text-green-500`} /> : <XCircle className={`${iconClass} text-red-500`} />}
            </div>
            
            <label className="flex items-center mb-4">
                <input type="checkbox" checked={formData.termsAccepted} onChange={e => setFormData({...formData, termsAccepted: e.target.checked})} className="mr-2" />
                Aceito os <a href="#" className="text-blue-500 underline ml-1">Termos de Serviço</a>
            </label>

            {error && <p className="text-red-500 mb-2">{error}</p>}
            <button type="submit" className="bg-blue-500 text-white p-2 rounded w-full">Cadastrar</button>
        </form>
    );
}
