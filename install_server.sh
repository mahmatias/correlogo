#!/bin/bash
# install_server.sh
# Script completo para configurar o ambiente e instalar o Corre Logo

set -e # Sai se houver erro

APP_DIR="/opt/correlogo"

echo "Configurando servidor..."

# 1. Atualizar e instalar dependências básicas
sudo apt update && sudo apt install -y curl git build-essential

# 2. Instalar Node.js (via NodeSource - system-wide)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar PM2 (System-wide)
sudo npm install -g pm2

# 4. Preparar pasta e mover código
sudo mkdir -p "$APP_DIR"
sudo chown -R $USER:$USER "$APP_DIR"
# Remove o diretório temporário se necessário, garantindo que o código esteja certo
cp -r . "$APP_DIR" 
cd "$APP_DIR"

# 5. Instalar dependências e build
npm install
npm run build

# 6. Configurar PM2
# PM2 rodando como root ou usuário do sistema
pm2 delete correlogo || true
pm2 start dist/server.cjs --name "correlogo"
pm2 save
# Garante que o PM2 inicie no boot (rodar como usuário atual)
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo "Corre Logo instalado com sucesso em $APP_DIR"
