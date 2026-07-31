# Build — Testing Strategy

## Visão Geral

Testes unitários com Vitest (configurado no `vite.config.ts`). Sem testes end-to-end ou de integração no momento.

---

## Framework

- **Vitest** — integrado ao Vite, zero-config
- Comando: `npx vitest` ou `npm test`
- Testes em `src/lib/__tests__/*.test.ts`

## Testes Existentes

| Arquivo | Casos | O que testa |
|---------|-------|-------------|
| `src/lib/__tests__/treadmill-machine.test.ts` | 9 | State machine FTMS: scan, connect, disconnect, handshake completo, erro |

## Padrões

- Arquivos de teste ao lado do código fonte em `__tests__/` dir
- Nomenclatura: `*.test.ts` (não `*.spec.ts`)
- Sem mocking pesado — prefere pure function tests
- Sem testes de componente (React Testing Library) ainda

## Gap

- Nenhum teste para: ShareCard, auto-update, plan generator, hooks, WorkoutTracker, Firebase operations
- CI não executa testes atualmente (`firebase-deploy.yml` não tem step de test)
