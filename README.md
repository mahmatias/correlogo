# Corre Logo 🏃

App de treinos de corrida com planos personalizados por VDOT, gerador Runna Couch-to-5K para iniciantes, e exportação TCX/FIT/GPX. PWA com suporte offline.

## Features

- **Gerador de treinos**: 3 perfis — Runna Couch-to-5K (iniciante), melhora de pace (interpolação VDOT), periodização padrão
- **Workout tracker**: Esteira e GPS, anúncios de voz ("Caminhada", "Quase lá"), modo Treino Livre
- **Histórico completo**: Sessões salvas no Firestore com fallback localStorage
- **Exportação**: TCX, GPX e FIT (compatível com Strava)
- **Design system Pôr-do-Sol**: Paleta temática com tokens CSS, dark mode, acessibilidade

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind v4 + Vite
- **Backend**: Node.js + Express (SSR fallback)
- **Banco**: Firestore (Google Firebase)
- **Autenticação**: Firebase Auth (email + Google)
- **Mapas**: Leaflet + OpenStreetMap
- **Deploy**: AWS EC2 + Nginx + PM2 + SSL Let's Encrypt

## Desenvolvimento local

```bash
npm install
npm run dev
# Servidor em http://localhost:3000
```

Crie um `.env` na raiz com as chaves do Firebase dev (`correlogo-dev-9a96a`).

## Produção

Deploy manual na AWS EC2:

```bash
git pull
sudo npm run build
sudo NODE_ENV=production pm2 restart correlogo
```

App live em: https://correlogo.sytes.net
