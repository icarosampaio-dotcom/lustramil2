#!/bin/bash

# Script de Inicialização Permanente - LustraMil
# Este script inicia o servidor LustraMil em modo produção com monitoramento

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/server.log"
PID_FILE="$PROJECT_DIR/server.pid"

# Criar diretório de logs se não existir
mkdir -p "$LOG_DIR"
mkdir -p "$PROJECT_DIR/data"

# Função para limpar ao sair
cleanup() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Encerrando servidor LustraMil..." >> "$LOG_FILE"
  if [ -f "$PID_FILE" ]; then
    kill $(cat "$PID_FILE") 2>/dev/null || true
    rm "$PID_FILE"
  fi
}

# Registrar trap para limpeza
trap cleanup EXIT

# Função para verificar se o servidor está rodando
check_health() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      return 0
    else
      return 1
    fi
  else
    return 1
  fi
}

# Função para reiniciar se necessário
restart_if_needed() {
  if ! check_health; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Servidor não está respondendo. Reiniciando..." >> "$LOG_FILE"
    start_server
  fi
}

# Função para iniciar o servidor
start_server() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando servidor LustraMil..." >> "$LOG_FILE"
  
  cd "$PROJECT_DIR"
  
  # Carregar variáveis de ambiente
  export NODE_ENV=production
  export DATABASE_URL="file:$PROJECT_DIR/data/lustramil.db"
  export JWT_SECRET="lustramil-production-secret-key-2024-change-this-in-production"
  export VITE_APP_ID="lustramil-app"
  
  # Iniciar o servidor em background
  nohup node dist/index.js >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Servidor iniciado com PID $(cat $PID_FILE)" >> "$LOG_FILE"
  
  # Aguardar alguns segundos para verificar se iniciou corretamente
  sleep 3
  
  if check_health; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Servidor iniciado com sucesso!" >> "$LOG_FILE"
    return 0
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Erro ao iniciar servidor. Verifique os logs." >> "$LOG_FILE"
    return 1
  fi
}

# Função para monitorar o servidor
monitor_server() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando monitoramento do servidor..." >> "$LOG_FILE"
  
  while true; do
    restart_if_needed
    sleep 30
  done
}

# Iniciar servidor
start_server

# Monitorar servidor
monitor_server
