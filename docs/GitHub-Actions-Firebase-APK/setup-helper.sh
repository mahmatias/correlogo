#!/bin/bash

# ===========================================
# GitHub Actions + Firebase Setup Helper
# ===========================================
# Este script automatiza tarefas repetitivas

set -e

echo "🚀 GitHub Actions + Firebase Setup Helper"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Menu
show_menu() {
    echo ""
    echo "O que você quer fazer?"
    echo "1) Criar keystore.jks"
    echo "2) Converter keystore para Base64"
    echo "3) Preparar estrutura de pastas"
    echo "4) Validar configuração"
    echo "5) Sair"
    echo ""
}

# Opção 1: Criar Keystore
create_keystore() {
    echo -e "${BLUE}Criando keystore.jks...${NC}"
    
    if [ -f "keystore.jks" ]; then
        echo -e "${YELLOW}⚠️  keystore.jks já existe!${NC}"
        read -p "Deseja substituir? (s/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            return
        fi
    fi
    
    read -p "Senha para o keystore: " -s keystore_pass
    echo ""
    read -p "Confirme a senha: " -s keystore_pass_confirm
    echo ""
    
    if [ "$keystore_pass" != "$keystore_pass_confirm" ]; then
        echo -e "${RED}❌ Senhas não correspondem!${NC}"
        return
    fi
    
    echo "Agora responda as perguntas:"
    keytool -genkey -v -keystore keystore.jks -keyalg RSA \
        -keysize 2048 -validity 10000 -alias android-key \
        -storepass "$keystore_pass" -keypass "$keystore_pass"
    
    echo -e "${GREEN}✅ keystore.jks criado com sucesso!${NC}"
    echo -e "${YELLOW}⚠️  GUARDE A SENHA: $keystore_pass${NC}"
}

# Opção 2: Converter para Base64
convert_to_base64() {
    echo -e "${BLUE}Convertendo keystore para Base64...${NC}"
    
    if [ ! -f "keystore.jks" ]; then
        echo -e "${RED}❌ keystore.jks não encontrado!${NC}"
        return
    fi
    
    # Detectar sistema operacional
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        base64 -i keystore.jks > keystore-base64.txt
    else
        # Linux
        base64 keystore.jks > keystore-base64.txt
    fi
    
    echo -e "${GREEN}✅ Arquivo criado: keystore-base64.txt${NC}"
    echo ""
    echo "Conteúdo (copie para GitHub Secrets):"
    echo "---"
    cat keystore-base64.txt
    echo ""
    echo "---"
}

# Opção 3: Preparar estrutura
prepare_structure() {
    echo -e "${BLUE}Preparando estrutura de pastas...${NC}"
    
    # Criar diretórios
    mkdir -p .github/workflows
    echo -e "${GREEN}✅ Pasta .github/workflows/ criada${NC}"
    
    # Criar RELEASE_NOTES.txt se não existir
    if [ ! -f "RELEASE_NOTES.txt" ]; then
        cat > RELEASE_NOTES.txt << 'EOF'
Versão 1.0.0 - $(date +%Y-%m-%d)

✨ Novas funcionalidades:
- App funcional

🐛 Correções:
- N/A

⚡ Melhorias:
- Performance
EOF
        echo -e "${GREEN}✅ RELEASE_NOTES.txt criado${NC}"
    fi
    
    # Criar .gitignore entries
    if [ -f ".gitignore" ]; then
        if ! grep -q "keystore.jks" .gitignore; then
            echo "keystore.jks" >> .gitignore
            echo -e "${GREEN}✅ keystore.jks adicionado ao .gitignore${NC}"
        fi
    else
        cat > .gitignore << 'EOF'
# Keystore
keystore.jks
keystore-base64.txt

# Firebase
firebase-key.json

# Android
*.apk
*.aab
build/
.gradle/

# IDE
.idea/
*.iml
.vscode/

# OS
.DS_Store
Thumbs.db
EOF
        echo -e "${GREEN}✅ .gitignore criado${NC}"
    fi
    
    echo -e "${GREEN}✅ Estrutura preparada!${NC}"
}

# Opção 4: Validar configuração
validate_setup() {
    echo -e "${BLUE}Validando configuração...${NC}"
    echo ""
    
    checks=0
    passed=0
    
    # Verificar keystore
    checks=$((checks + 1))
    if [ -f "keystore.jks" ]; then
        echo -e "${GREEN}✅${NC} keystore.jks encontrado"
        passed=$((passed + 1))
    else
        echo -e "${RED}❌${NC} keystore.jks NÃO encontrado"
    fi
    
    # Verificar estrutura de pastas
    checks=$((checks + 1))
    if [ -d ".github/workflows" ]; then
        echo -e "${GREEN}✅${NC} Pasta .github/workflows existe"
        passed=$((passed + 1))
    else
        echo -e "${RED}❌${NC} Pasta .github/workflows NÃO existe"
    fi
    
    # Verificar workflow file
    checks=$((checks + 1))
    if [ -f ".github/workflows/firebase-deploy.yml" ]; then
        echo -e "${GREEN}✅${NC} firebase-deploy.yml encontrado"
        passed=$((passed + 1))
    else
        echo -e "${YELLOW}⚠️ ${NC} firebase-deploy.yml NÃO encontrado"
    fi
    
    # Verificar build.gradle
    checks=$((checks + 1))
    if grep -q "com.google.firebase.appdistribution" app/build.gradle 2>/dev/null; then
        echo -e "${GREEN}✅${NC} Firebase plugin detectado em build.gradle"
        passed=$((passed + 1))
    else
        echo -e "${YELLOW}⚠️ ${NC} Firebase plugin NÃO detectado em build.gradle"
    fi
    
    # Verificar RELEASE_NOTES
    checks=$((checks + 1))
    if [ -f "RELEASE_NOTES.txt" ]; then
        echo -e "${GREEN}✅${NC} RELEASE_NOTES.txt existe"
        passed=$((passed + 1))
    else
        echo -e "${YELLOW}⚠️ ${NC} RELEASE_NOTES.txt NÃO existe"
    fi
    
    echo ""
    echo "Resultado: $passed/$checks verificações passaram"
    
    if [ $passed -eq $checks ]; then
        echo -e "${GREEN}✅ Tudo pronto! Você pode fazer push.${NC}"
    else
        echo -e "${YELLOW}⚠️  Ainda faltam configurações. Veja acima.${NC}"
    fi
}

# Loop principal
while true; do
    show_menu
    read -p "Escolha uma opção (1-5): " choice
    
    case $choice in
        1)
            create_keystore
            ;;
        2)
            convert_to_base64
            ;;
        3)
            prepare_structure
            ;;
        4)
            validate_setup
            ;;
        5)
            echo -e "${GREEN}Até logo! 👋${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Opção inválida!${NC}"
            ;;
    esac
done
