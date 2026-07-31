# Auth — Firebase Error Handling (PT-BR)

## Visão Geral

Função utilitária `getFirebaseErrorPt(err)` que mapeia códigos de erro do Firebase Auth para mensagens em português legíveis para o usuário.

---

## Uso

```typescript
import { getFirebaseErrorPt } from '../lib/firebaseErrorsPtBr';

try {
  await signInWithEmailAndPassword(auth, email, password);
} catch (err) {
  showFeedback('error', getFirebaseErrorPt(err));
}
```

Nunca usar `err.message` direto — o Firebase retorna mensagens em inglês com códigos internos.

## Mapeamento

| Código Firebase | Mensagem PT-BR |
|----------------|----------------|
| `auth/invalid-email` | E-mail inválido |
| `auth/user-not-found` | Usuário não encontrado |
| `auth/wrong-password` | Senha incorreta |
| `auth/email-already-in-use` | E-mail já cadastrado |
| `auth/weak-password` | Senha muito fraca (mín. 6 caracteres) |
| `auth/too-many-requests` | Muitas tentativas. Tente novamente mais tarde |
| `auth/network-request-failed` | Erro de rede. Verifique sua conexão |
| `auth/invalid-credential` | Credenciais inválidas |
| Outros | Erro ao fazer login. Tente novamente |

## Arquivo

`src/lib/firebaseErrorsPtBr.ts` — switch case simples com fallback para mensagem genérica.

## Onde é Usado

- `src/components/Login.tsx` — `signInWithEmailAndPassword`
- `src/components/Signup.tsx` — `createUserWithEmailAndPassword`
