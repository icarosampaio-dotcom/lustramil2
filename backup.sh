#!/bin/bash

# Script de Backup - LustraMil
# Realiza backup do banco de dados SQLite

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/backup.log"

# Criar diretórios se não existirem
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# Configurações de backup
DB_FILE="$DATA_DIR/lustramil.db"
BACKUP_FILE="$BACKUP_DIR/lustramil-$(date +%Y%m%d-%H%M%S).db"
MAX_BACKUPS=10

# Função para registrar log
log_message() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Verificar se banco de dados existe
if [ ! -f "$DB_FILE" ]; then
  log_message "Banco de dados não encontrado: $DB_FILE"
  exit 1
fi

# Realizar backup
log_message "Iniciando backup do banco de dados..."

# Copiar banco de dados
if cp "$DB_FILE" "$BACKUP_FILE"; then
  log_message "Backup realizado com sucesso: $BACKUP_FILE"
  
  # Limpar backups antigos (manter apenas os últimos N backups)
  log_message "Limpando backups antigos (mantendo últimos $MAX_BACKUPS)..."
  ls -t "$BACKUP_DIR"/lustramil-*.db 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f
  
  log_message "Backup concluído com sucesso"
  exit 0
else
  log_message "Erro ao realizar backup"
  exit 1
fi
