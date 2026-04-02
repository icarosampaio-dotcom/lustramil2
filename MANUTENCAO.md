# Documentação de Manutenção - LustraMil

## 📋 Visão Geral

Este documento descreve como manter e operar o site permanente **LustraMil** hospedado na Manus.

---

## 🚀 Inicialização do Servidor

### Iniciar o Servidor

Para iniciar o servidor com monitoramento automático:

```bash
cd /home/ubuntu/lustramil
./start-server.sh
```

O servidor iniciará em modo produção na **porta 3000** e será monitorado automaticamente. Se o servidor cair, será reiniciado automaticamente.

### Parar o Servidor

Para parar o servidor:

```bash
# Encontrar o PID
cat /home/ubuntu/lustramil/server.pid

# Matar o processo
kill <PID>
```

---

## 🏥 Monitoramento e Health Check

### Executar Health Check Manual

Para verificar se o servidor está saudável:

```bash
cd /home/ubuntu/lustramil
./health-check.sh
```

O resultado será salvo em `logs/health-status.json`.

### Verificar Status do Servidor

```bash
# Ver logs do servidor
tail -f /home/ubuntu/lustramil/logs/server.log

# Ver logs de health check
tail -f /home/ubuntu/lustramil/logs/health-check.log

# Ver status atual
cat /home/ubuntu/lustramil/logs/health-status.json
```

---

## 💾 Backup e Recuperação

### Realizar Backup Manual

Para fazer backup do banco de dados:

```bash
cd /home/ubuntu/lustramil
./backup.sh
```

Os backups serão salvos em `backups/` com timestamp.

### Agendar Backup Automático

Para agendar backups diários às 2:00 AM, adicione ao crontab:

```bash
crontab -e

# Adicionar a linha:
0 2 * * * /home/ubuntu/lustramil/backup.sh
```

### Recuperar de um Backup

```bash
# Listar backups disponíveis
ls -la /home/ubuntu/lustramil/backups/

# Restaurar um backup específico
cp /home/ubuntu/lustramil/backups/lustramil-YYYYMMDD-HHMMSS.db /home/ubuntu/lustramil/data/lustramil.db

# Reiniciar o servidor
kill $(cat /home/ubuntu/lustramil/server.pid)
./start-server.sh
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

O arquivo `.env` contém as configurações principais:

```bash
# Banco de Dados
DATABASE_URL="file:./data/lustramil.db"

# Segurança (MUDE EM PRODUÇÃO!)
JWT_SECRET="lustramil-production-secret-key-2024-change-this-in-production"

# Configuração da Aplicação
VITE_APP_ID="lustramil-app"
NODE_ENV="production"
```

**⚠️ IMPORTANTE:** Altere o `JWT_SECRET` em produção!

### Alterar Configurações

1. Editar o arquivo `.env`:
   ```bash
   nano /home/ubuntu/lustramil/.env
   ```

2. Reiniciar o servidor:
   ```bash
   kill $(cat /home/ubuntu/lustramil/server.pid)
   ./start-server.sh
   ```

---

## 📊 Estrutura de Diretórios

```
/home/ubuntu/lustramil/
├── data/                    # Banco de dados SQLite
│   └── lustramil.db
├── backups/                 # Backups do banco de dados
├── logs/                    # Arquivos de log
│   ├── server.log
│   ├── health-check.log
│   ├── backup.log
│   └── health-status.json
├── dist/                    # Código compilado
├── node_modules/            # Dependências
├── .env                     # Variáveis de ambiente
├── start-server.sh          # Script de inicialização
├── health-check.sh          # Script de health check
├── backup.sh                # Script de backup
└── MANUTENCAO.md           # Este arquivo
```

---

## 🔍 Troubleshooting

### Servidor não inicia

1. Verificar logs:
   ```bash
   tail -100 /home/ubuntu/lustramil/logs/server.log
   ```

2. Verificar se porta 3000 está em uso:
   ```bash
   lsof -i :3000
   ```

3. Limpar e reconstruir:
   ```bash
   cd /home/ubuntu/lustramil
   rm -rf dist
   pnpm run build
   ./start-server.sh
   ```

### Banco de dados corrompido

1. Fazer backup do banco corrompido:
   ```bash
   cp /home/ubuntu/lustramil/data/lustramil.db /home/ubuntu/lustramil/data/lustramil.db.corrupted
   ```

2. Restaurar de um backup anterior:
   ```bash
   cp /home/ubuntu/lustramil/backups/lustramil-YYYYMMDD-HHMMSS.db /home/ubuntu/lustramil/data/lustramil.db
   ```

3. Reiniciar servidor:
   ```bash
   kill $(cat /home/ubuntu/lustramil/server.pid)
   ./start-server.sh
   ```

### Servidor consome muita memória

1. Verificar processos:
   ```bash
   ps aux | grep node
   ```

2. Reiniciar o servidor:
   ```bash
   kill $(cat /home/ubuntu/lustramil/server.pid)
   sleep 5
   ./start-server.sh
   ```

---

## 📈 Performance e Otimização

### Monitorar Uso de Recursos

```bash
# Ver uso de memória e CPU
top -p $(cat /home/ubuntu/lustramil/server.pid)

# Ver tamanho do banco de dados
du -sh /home/ubuntu/lustramil/data/lustramil.db
```

### Limpeza de Logs Antigos

```bash
# Remover logs com mais de 30 dias
find /home/ubuntu/lustramil/logs -name "*.log" -mtime +30 -delete
```

---

## 🔐 Segurança

### Alterar JWT Secret

**IMPORTANTE:** Altere o JWT_SECRET em produção!

```bash
# Editar .env
nano /home/ubuntu/lustramil/.env

# Alterar JWT_SECRET para um valor seguro
JWT_SECRET="seu-novo-secret-super-seguro-aqui"

# Reiniciar servidor
kill $(cat /home/ubuntu/lustramil/server.pid)
./start-server.sh
```

### Permissões de Arquivo

```bash
# Garantir que apenas o proprietário pode ler .env
chmod 600 /home/ubuntu/lustramil/.env

# Garantir que o diretório de dados é seguro
chmod 700 /home/ubuntu/lustramil/data
```

---

## 📞 Suporte

Para problemas ou dúvidas, consulte:

- **Logs do servidor:** `/home/ubuntu/lustramil/logs/server.log`
- **Documentação do projeto:** `/home/ubuntu/lustramil/README.md`
- **Contato:** [Seu contato aqui]

---

## 📝 Checklist de Manutenção Mensal

- [ ] Verificar saúde do servidor
- [ ] Revisar logs de erro
- [ ] Realizar backup manual
- [ ] Limpar logs antigos
- [ ] Verificar uso de disco
- [ ] Atualizar dependências (se necessário)
- [ ] Testar recuperação de backup

---

**Última atualização:** 02 de Abril de 2026
**Versão:** 1.0
