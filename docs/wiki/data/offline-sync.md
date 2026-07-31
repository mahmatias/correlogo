# Data — Offline Persistence & Sync Strategy

## Visão Geral

Arquitetura local-first: localStorage para UI instantânea, Firestore como source of truth, sincronização bidirecional com fallback offline.

---

## Estratégia

```
Mount → ler localStorage → UI imediata
  └── Promise.race:
        ├── Firestore query (5s timeout) → merge com localStorage
        └── timeout → opera do localStorage até conexão
```

## Cache Keys (localStorage)

| Key | Dados |
|-----|-------|
| `correlogo:plans:{uid}` | Planos do usuário |
| `correlogo:sessions:{uid}` | Sessões de treino (limit 50) |
| `correlogo:darkMode:{uid}` | Preferência de tema |

## Sincronização

- **Sessions** com prefixo `local-*` são auto-uploaded para Firestore na próxima conexão bem-sucedida
- **Plans**: merge local + remote (remote wins em conflito)
- **Profile/Settings**: sync bidirecional com merge

## Offline Resilience

- `enableIndexedDbPersistence(dbInstance)` chamado após `initializeFirestore()` — falha silenciosa em múltiplas abas
- Firestore queries wrapped em `Promise.race` com 5s timeout
- Verificar sincronização com `[timing]` logs durante desenvolvimento

## Firestore Queries

- Sempre usar `limit(50)` em queries de sessão para evitar leituras unbounded
- `writeBatch` para deleções em lote (até 500 ops), nunca `for...of deleteDoc`

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/lib/firebase.ts` | Firestore init + offline persistence |
| `src/App.tsx:188-312` | Cache read + Firestore merge + sync loops |
| `src/App.tsx:637-641` | `writeBatch` para deleções em cascata |
