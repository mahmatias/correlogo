# Auth - Login Flows

## Visão Geral

Duas entry points de login:
1. **Login.tsx** - Email/password + Google
2. **Signup.tsx** - Criação de conta

Ambos convergem para `onAuthStateChanged` no `App.tsx`.

---

## 1. Email/Password

### Login

```typescript
// src/components/Login.tsx
const handleLogin = async (email: string, password: string) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged dispara automaticamente
  } catch (err) {
    setError(getFirebaseErrorPt(err));
  }
};
```

### Signup

```typescript
// src/components/Signup.tsx
const handleSignup = async (email: string, password: string) => {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    // Cria profile vazio no Firestore
    await setDoc(doc(db, 'users', user.uid, 'data', 'profile'), {
      displayName: email.split('@')[0],
      dob: null, gender: null, city: null, state: null,
      photoURL: null, weightInKg: null, updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'users', user.uid, 'data', 'settings'), {
      isDarkMode: false, distanceUnit: 'km', paceUnit: 'per_km', weightUnit: 'kg',
    });
  } catch (err) {
    setError(getFirebaseErrorPt(err));
  }
};
```

---

## 2. Google OAuth (Unificado)

### Web

```typescript
// src/components/Login.tsx
const handleGoogleLogin = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar');
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' });
    
    const result = await signInWithPopup(auth, provider);
    // Token disponível em result.credential?.accessToken
  } catch (err) {
    setError(getFirebaseErrorPt(err));
  }
};
```

### APK (Nativo)

```typescript
// src/components/Login.tsx
const handleGoogleLogin = async () => {
  try {
    const { credential } = await FirebaseAuthentication.signInWithGoogle();
    if (credential?.idToken) {
      const googleCredential = GoogleAuthProvider.credential(credential.idToken);
      await signInWithCredential(auth, googleCredential);
    }
  } catch (err) {
    setError(getFirebaseErrorPt(err));
  }
};
```

> **Nota**: APK usa `@capacitor-firebase/authentication` com `skipNativeAuth: true`. O plugin nativo retorna `idToken`, que é trocado por credential Firebase.

---

## Password Reset

```typescript
// src/components/Login.tsx
const handleForgotPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: 'https://correlogo.web.app', // redirect after reset
      handleCodeInApp: true,
    });
    showFeedback('success', 'E-mail de recuperação enviado!');
  } catch (err) {
    showFeedback('error', getFirebaseErrorPt(err));
  }
};
```

---

## State Management (App.tsx)

```typescript
const [user, setUser] = useState<User | null>(null);
const [initialized, setInitialized] = useState(false);

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    if (user) {
      setUser(user);
      // Carrega dados paralelos
      await Promise.all([
        loadPlans(user.uid),
        loadSessions(user.uid),
        loadProfile(user.uid),
        loadSettings(user.uid),
      ]);
    } else {
      setUser(null);
      clearLocalData();
    }
    setInitialized(true);
  });
  return unsub;
}, []);
```

---

## Protected Routes (Implícito via State)

```tsx
// App.tsx
if (!initialized) return <LoadingScreen />;

if (!user) return <AuthScreen onLogin={...} onSignup={...} />;

return (
  <Dashboard user={user} ... />
);
```

---

## Logout

```typescript
const handleLogout = async () => {
  try {
    await signOut(auth);
    // onAuthStateChanged(null) limpa estado
  } catch (err) {
    showFeedback('error', 'Erro ao sair');
  }
};
```

---

## Persistência Local

| Dado | Key | Expiração |
|------|-----|-----------|
| User | Firebase Auth (IndexedDB) | Sessão |
| Plans | `correlogo:plans:{uid}` | 30 dias |
| Sessions | `correlogo:sessions:{uid}` | 30 dias |
| Profile | `correlogo:profile:{uid}` | 30 dias |
| Settings | `correlogo:settings:{uid}` | 30 dias |
| Dark Mode | `correlogo:darkMode:{uid}` | Permanente |

---

## Error Handling (PT-BR)

```typescript
// src/lib/firebaseErrorsPtBr.ts
export const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Conta desativada.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/email-already-in-use': 'E-mail já cadastrado.',
  'auth/weak-password': 'Senha deve ter pelo menos 6 caracteres.',
  'auth/invalid-credential': 'Credenciais inválidas. Verifique SHA-1 no Firebase Console.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/cancelled-popup-request': 'Login cancelado.',
};

export function getFirebaseErrorPt(err: any): string {
  return FIREBASE_ERRORS[err?.code] || err?.message || 'Erro desconhecido.';
}
```

---

## Security Rules (Firestore)

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuário só acessa seus próprios dados
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Debug Logging (APK)

```typescript
// src/components/Login.tsx
console.log('[Login] Google result:', {
  user: !!result.user,
  credential: !!result.credential,
  idToken: !!result.credential?.idToken,
  accessToken: !!result.credential?.accessToken,
});
```

---

*Última revisão: 2026-07-29*