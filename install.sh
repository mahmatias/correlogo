#!/bin/bash
# install.sh
# Script imutável para iniciar a instalação do Corre Logo
# Requisito: A chave SSH do servidor já deve estar cadastrada como Deploy Key no repositório.

REPO_URL="git@github.com:mahmatias/correlogo.git" # <-- SUBSTITUA PELA URL SSH DO SEU REPO PRIVADO
INSTALL_DIR="/tmp/correlogo_temp_install"

echo "Iniciando processo de instalação..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
git clone "$REPO_URL" "$INSTALL_DIR"

if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    chmod +x install_server.sh
    ./install_server.sh
else
    echo "Erro: Falha ao clonar o repositório. Verifique a chave SSH."
    exit 1
fi
