# User Area — Design

## Goal
Criar uma Área do Usuário dentro do app Corre Logo, permitindo que o usuário visualize e edite seus dados de perfil e preferências do sistema.

## Escopo MVP
Funcionalidades inclusas na primeira versão:
- Foto do perfil (exibida do Google Auth se disponível, sem upload)
- Nome (editável)
- Data de nascimento (3 selects: dia, mês, ano)
- Gênero (select com os mesmos valores do signup)
- Local (cidade + estado, com select de estados brasileiros)
- Peso corporal (input numérico)
- Preferências de unidades (distância, ritmo, peso)

Funcionalidades **pós-MVP** (fora deste escopo):
- Upload de foto do perfil
- Perfil público com URL
- Equipamentos (tênis)
- Mais preferências (notificações, privacidade, idioma)

## Abordagem
**Modal/overlay de Perfil** — novo componente `UserProfile` acessado do header. Aba única com formulário de edição inline. Sem impacto na navegação existente.

## Modelo de Dados — Firestore

### `users/{uid}/data/profile`
```typescript
{
  displayName: string,       // "João Silva"
  dob: string | null,        // ISO date "1990-05-15"
  gender: string | null,     // valores do signup
  city: string | null,       // livre até 20 chars
  state: string | null,      // sigla UF (AC, AL, ..., TO)
  photoURL: string | null,   // do Google Auth ou null
  weightInKg: number | null, // peso corporal SEMPRE em kg internamente
  updatedAt: Timestamp
}
```

### `users/{uid}/data/settings` (extensão do documento existente)
```typescript
{
  isDarkMode: boolean,
  distanceUnit: 'km' | 'mi',       // default 'km'
  paceUnit: 'per_km' | 'per_mi',   // default 'per_km'
  weightUnit: 'kg' | 'lb'          // default 'kg'
}
```

### Signup
No cadastro, os dados (nome, sobrenome, gênero, data) serão persistidos no profile doc em vez de descartados. Nada muda no formulário de signup — apenas a persistência.

## Componentes

### `UserProfile` (novo)
- Modal reusando `<Modal>` do app
- Carrega `profile` + `settings` no `useEffect`
- Formulário com campos:
  - Avatar: mostra `photoURL` do Google se existir, ou initials
  - Nome: input text
  - Data: 3 selects lado a lado (dia 1-31, mês 1-12, ano 1900-hoje)
  - Gênero: select (Masculino, Feminino, Não-binário, Agênero, Prefiro não informar, Outro)
  - Cidade: input text max 20 chars
  - Estado: select com UFs brasileiras (AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO)
  - Peso: input number + label da unidade (kg/lb conforme preferência)
  - Preferências:
    - Distância: select km/mi
    - Ritmo: select /km, /mi
    - Peso: select kg/lb
  - Botão SALVAR no final
- Ao salvar: `setDoc` com merge em profile + settings + localStorage
- `displayName` atualizado via `updateProfile()` no Auth
- Toast de feedback (sucesso/erro)

### Modificações em `App.tsx`
- Adicionar botão `User` (ícone `User` do lucide-react) no header, ao lado do histórico/dark mode/logout
- Estado `showUserProfile` para controlar abertura do modal
- Carregar `profile` + `settings` durante inicialização (junto com plans e sessions)
- Passar `showFeedback` como prop pro `UserProfile`

### Modificações em `Signup.tsx`
- Após `createUserWithEmailAndPassword`, salvar `profile` doc no Firestore com dados coletados

## Fluxo de Dados

1. App inicializa → carrega plans, sessions, **profile**, **settings** do Firestore
2. Cache em localStorage: `correlogo:profile:{uid}`
3. Usuário clica no avatar/botão → modal abre com dados do cache (instantâneo)
4. Enquanto modal abre, fetch do Firestore atualiza se necessário
5. Usuário edita campos → alterações ficam em estado local (React state)
6. Clica SALVAR → `setDoc` em profile + settings + `updateProfile` no Auth
7. Toast de confirmação
8. Firestone salva com merge para não sobrescrever outros campos

## Tratamento de Erros

- Falha no Firestore: toast de erro (`showFeedback`), dados mantidos em memória
- Falha no `updateProfile` do Auth: loga warning, mas Firestore salvo (dado não crítico)
- Timeout de 5s nas leituras (mesmo padrão do resto do app)

## Conversão de Unidades

- Peso é sempre armazenado em `kg` internamente (`weightInKg`)
- Na UI, exibe convertido conforme `weightUnit`:
  - `kg`: `weightInKg` direto
  - `lb`: `weightInKg * 2.20462`
- Se usuário muda `weightUnit`, o valor exibido é convertido automaticamente
- Ao salvar, converte de volta pra kg
