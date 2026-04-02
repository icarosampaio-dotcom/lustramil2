#!/bin/bash

# Script de Health Check - LustraMil
# Verifica a saúde do servidor e registra em log

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/health-check.log"
HEALTH_FILE="$LOG_DIR/health-status.json"

# Criar diretório de logs se não existir
mkdir -p "$LOG_DIR"

# Porta do servidor
PORT=3000
HEALTH_URL="http://localhost:$PORT"

# Função para registrar log
log_message() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Função para verificar saúde
check_health() {
  local status="UNKNOWN"
  local response_time=0
  local http_code=0
  
  # Tentar conectar ao servidor
  start_time=$(date +%s%N)
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$HEALTH_URL" 2>/dev/null || echo "000")
  end_time=$(date +%s%N)
  
  response_time=$(( (end_time - start_time) / 1000000 ))
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    status="HEALTHY"
  elif [ "$http_code" = "000" ]; then
    status="UNREACHABLE"
  else
    status="UNHEALTHY"
  fi
  
  # Criar JSON de status
  cat > "$HEALTH_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "$status",
  "http_code": "$http_code",
  "response_time_ms": $response_time,
  "server_url": "$HEALTH_URL",
  "port": $PORT
}
EOF
  
  log_message "Health Check: $status (HTTP $http_code, Response: ${response_time}ms)"
  
  if [ "$status" = "HEALTHY" ]; then
    return 0
  else
    return 1
  fi
}

# Função para alertar se servidor está down
alert_if_down() {
  if ! check_health; then
    log_message "ALERTA: Servidor não está respondendo!"
    return 1
  fi
  return 0
}

# Executar health check
alert_if_down
exit $?
