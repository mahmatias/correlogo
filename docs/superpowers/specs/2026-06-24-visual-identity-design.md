# Corre Logo — Design System: Identidade Visual Pôr-do-Sol

## Resumo

Substituir a paleta Mineral existente pelo tema **Pôr-do-Sol** (rosa neon,
laranja, amarelo, roxo) e refatorar o sistema de tema de `isDarkMode` prop
drilling para **CSS Variables** com alternância automática entre dark/light.

## Paleta de Cores

### Acentos (comuns aos dois temas)

| Token | Hex | Uso |
|-------|-----|-----|
| `accent-primary` | `#FF006E` | Rosa neon — CTAs, destaques, botões |
| `accent-secondary` | `#FFBE0B` | Amarelo — badges, tags, alertas |
| `accent-tertiary` | `#7209B7` | Roxo — links, info, gráficos |
| `gradient` | `linear-gradient(135deg, #FF006E, #FFBE0B)` | Progresso, hero sections |

### Dark Mode (padrão)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-deep` | `#0A0A14` | Fundo da tela |
| `bg-surface` | `#12122A` | Cards e containers |
| `bg-elevated` | `#1C1C40` | Elementos em destaque, hover |
| `border` | `#2A2A50` | Bordas |
| `text-primary` | `#F0ECF5` | Títulos, corpo |
| `text-secondary` | `#B0A8C8` | Subtítulos, metadados |
| `text-muted` | `#7A7490` | Placeholders, labels secundários |

### Light Mode

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-deep` | `#F8F4F0` | Fundo da tela |
| `bg-surface` | `#FFFFFF` | Cards |
| `bg-elevated` | `#F0ECE8` | Hover, destaque |
| `border` | `#D4CFC8` | Bordas |
| `text-primary` | `#1A1826` | Títulos |
| `text-secondary` | `#5A5470` | Subtítulos |
| `text-muted` | `#8A8498` | Placeholders |

## Tipografia

- **Display:** Geologica (pesos 300–800) — títulos, hero, números grandes
- **Body:** IBM Plex Sans (pesos 300–700) — texto corrido, botões, labels
- **Mono:** IBM Plex Mono (pesos 400–600) — estatísticas, pace, dados numéricos

## Arquitetura: CSS Variables

### Mecanismo

1. Definir cores no `@theme` do `index.css` (já compatível com Tailwind v4)
2. Criar bloco `:root` com variáveis CSS apontando para paleta escura (padrão)
3. Criar bloco `.light` que sobrescreve variáveis com paleta clara
4. Alternar tema: toggle adiciona/remove classe `.light` no `<html>`

### Exemplo

```css
/* @theme mantém os nomes de classe para o Tailwind */
@theme {
  --color-bg-deep: #0A0A14;
  --color-bg-surface: #12122A;
  --color-accent: #FF006E;
  /* ... */
}

/* Variáveis CSS — tema escuro (padrão) */
:root {
  --bg-deep: #0A0A14;
  --bg-surface: #12122A;
}

/* Tema claro — sobrescreve variáveis */
.light {
  --bg-deep: #F8F4F0;
  --bg-surface: #FFFFFF;
}
```

### Antes vs Depois

**Antes (prop drilling + ternários):**
```tsx
<div className={`${isDarkMode ? 'bg-bg-deep' : 'bg-agate-cream'}`}>
```

**Depois (classes fixas — CSS resolve o tema):**
```tsx
<div className="bg-bg-deep">
```

Isso elimina o prop drilling de `isDarkMode` em todos os 10 componentes.

## Plano de Implementação

1. **`index.css`** — substituir paleta Mineral pela Pôr-do-Sol; adicionar
   `:root` e `.light` com variáveis CSS para dark e light
2. **`App.tsx`** — alterar `toggleDarkMode` para alternar classe `.light` no
   `<html>`; remover `isDarkMode` dos JSX ternários
3. **Componentes** — remover prop `isDarkMode` de todos os componentes;
   substituir ternários por classes fixas
4. **Login.tsx / Signup.tsx** — substituir classes Tailwind genéricas
   (`bg-blue-500`, `dark:bg-gray-800`) pelas cores do tema Pôr-do-Sol
5. **ImportPlan.tsx** — adicionar suporte a dark mode usando as variáveis CSS
