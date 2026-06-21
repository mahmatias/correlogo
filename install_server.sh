#!/bin/bash
# install_server.sh
# Script completo para configurar o ambiente e instalar o Corre Logo

set -e # Sai se houver erro

APP_DIR="/opt/correlogo"

echo "Configurando servidor..."

# 1. Atualizar e instalar dependências básicas
sudo apt update && sudo apt install -y curl git

# 2. Instalar Node.js (via NVM)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install node
nvm use node

# 3. Instalar PM2
npm install -g pm2

# 4. Preparar pasta e mover código
sudo mkdir -p "$APP_DIR"
sudo chown -R $USER:$USER "$APP_DIR"
mv * "$APP_DIR" # Move o conteúdo clonado para a pasta destino
cd "$APP_DIR"

# 5. Instalar dependências e build
npm install
npm run build

# 6. Configurar PM2
pm2 start dist/server.cjs --name "correlogo"
pm2 save
pm2 startup | sudo bash # Configura para iniciar no boot

echo "Corre Logo instalado com sucesso em $APP_DIR"
