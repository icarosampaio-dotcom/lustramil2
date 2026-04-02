# Guia de Deploy - LustraMil na Manus App Platform

## 🎯 Objetivo

Fazer deploy do **LustraMil** como um **site permanente 24/7** na Manus App Platform com:
- ✅ Auto-restart automático
- ✅ Monitoramento contínuo
- ✅ Backups automáticos
- ✅ SSL/HTTPS automático
- ✅ Escalabilidade automática

---

## 📋 Pré-requisitos

- ✅ Conta na Manus (https://manus.im)
- ✅ Conta no GitHub (https://github.com)
- ✅ Git instalado localmente
- ✅ Node.js 22+ e pnpm instalados

---

## 🚀 Passo 1: Preparar Repositório Git

### 1.1 Inicializar Git (se ainda não fez)

```bash
cd /home/ubuntu/lustramil

# Inicializar repositório
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Initial commit - LustraMil application"
```

### 1.2 Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Crie um novo repositório chamado `lustramil`
3. Copie a URL do repositório (ex: `https://github.com/seu-usuario/lustramil.git`)

### 1.3 Conectar e Fazer Push

```bash
# Adicionar remote
git remote add origin https://github.com/seu-usuario/lustramil.git

# Fazer push
git branch -M main
git push -u origin main
```

---

## 🌐 Passo 2: Conectar à Manus App Platform

### 2.1 Acessar Manus App Platform

1. Acesse https://manus.im
2. Faça login com sua conta
3. Navegue para "App Platform" ou "Deploy"

### 2.2 Criar Nova Aplicação

1. Clique em "New Application" ou "Deploy New App"
2. Selecione "Import from GitHub"
3. Conecte sua conta GitHub (se necessário)
4. Selecione o repositório `lustramil`

### 2.3 Configurar Aplicação

**Detecção Automática:**
- Manus detectará automaticamente que é uma aplicação Node.js
- Identificará os scripts de build e start

**Configurações Principais:**
- **Build Command:** `pnpm install && pnpm run build`
- **Start Command:** `node dist/index.js`
- **Port:** `3000`

---

## ⚙️ Passo 3: Configurar Variáveis de Ambiente

Na interface da Manus, adicione as seguintes variáveis:

### Obrigatórias:

```
NODE_ENV = production
DATABASE_URL = file:./data/lustramil.db
JWT_SECRET = seu-secret-super-seguro-aqui-mude-isso
VITE_APP_ID = lustramil-app
```

### Opcionais (se usar):

```
AWS_REGION = us-east-1
AWS_ACCESS_KEY_ID = sua-access-key
AWS_SECRET_ACCESS_KEY = sua-secret-key
AWS_S3_BUCKET = seu-bucket

GOOGLE_MAPS_API_KEY = sua-api-key

COMETA_API_URL = https://api.cometa.com
COMETA_API_KEY = sua-api-key
```

---

## 💾 Passo 4: Configurar Volumes e Persistência

A Manus criará automaticamente volumes para:

- `/app/data` - Banco de dados SQLite (1GB)
- `/app/backups` - Backups automáticos (500MB)
- `/app/logs` - Arquivos de log (500MB)

Estes volumes **persistem** entre deployments.

---

## 🔐 Passo 5: Configurar Domínio

### Opção A: Subdomínio Manus (Padrão)

A aplicação estará disponível em:
```
https://lustramil.manus.app
```

### Opção B: Domínio Customizado

1. Na interface da Manus, vá para "Settings" → "Domain"
2. Clique em "Add Custom Domain"
3. Insira seu domínio (ex: `lustramil.com`)
4. Siga as instruções para configurar DNS
5. Manus configurará SSL/HTTPS automaticamente

---

## 🚀 Passo 6: Deploy

### Opção A: Deploy Automático (Recomendado)

1. Na interface da Manus, clique em "Deploy"
2. Manus fará automaticamente:
   - Clone do repositório
   - Instalação de dependências
   - Build da aplicação
   - Deploy em produção

### Opção B: Deploy Manual via Git

```bash
# Fazer mudanças locais
git add .
git commit -m "Update application"

# Fazer push
git push origin main

# Manus detectará automaticamente e fará deploy
```

---

## ✅ Passo 7: Verificar Deployment

### Verificar Status

1. Acesse a interface da Manus
2. Vá para "Deployments"
3. Verifique o status da aplicação

### Acessar Aplicação

```
https://lustramil.manus.app
```

### Verificar Logs

Na interface da Manus:
1. Vá para "Logs"
2. Veja os logs em tempo real

---

## 🔄 Passo 8: Configurar Auto-Deploy

Na interface da Manus:

1. Vá para "Settings" → "Deployment"
2. Ative "Auto Deploy on Push"
3. Selecione a branch (main)

Agora, toda vez que você fizer push no GitHub, Manus fará deploy automaticamente!

---

## 📊 Monitoramento e Manutenção

### Health Check Automático

Manus verifica automaticamente:
- ✅ CPU e memória
- ✅ Disponibilidade do servidor
- ✅ Erros e exceções
- ✅ Performance

### Backups Automáticos

- ✅ Backup diário do banco de dados
- ✅ Retenção de 30 dias
- ✅ Restauração fácil via interface

### Escalabilidade Automática

Manus escalará automaticamente:
- **Mínimo:** 1 instância
- **Máximo:** 3 instâncias
- **Gatilho:** CPU > 70% ou Memória > 80%

---

## 🔧 Operações Comuns

### Parar Aplicação

```
Na interface da Manus:
1. Vá para "Settings"
2. Clique em "Stop Application"
```

### Reiniciar Aplicação

```
Na interface da Manus:
1. Vá para "Deployments"
2. Clique em "Restart"
```

### Ver Logs

```
Na interface da Manus:
1. Vá para "Logs"
2. Filtre por data/hora
3. Busque por erro específico
```

### Fazer Rollback

```
Na interface da Manus:
1. Vá para "Deployments"
2. Selecione uma versão anterior
3. Clique em "Rollback"
```

---

## 📈 Atualizar Aplicação

### Atualizar Código

```bash
# Fazer mudanças no código
# ...

# Fazer commit
git add .
git commit -m "Update feature X"

# Fazer push
git push origin main

# Manus fará deploy automaticamente!
```

### Atualizar Dependências

```bash
# Atualizar dependências localmente
pnpm update

# Fazer commit
git add package.json pnpm-lock.yaml
git commit -m "Update dependencies"

# Fazer push
git push origin main

# Manus fará deploy automaticamente!
```

---

## 🆘 Troubleshooting

### Aplicação não inicia

1. Verificar logs na interface da Manus
2. Verificar variáveis de ambiente
3. Verificar se o build foi bem-sucedido
4. Fazer rollback para versão anterior

### Banco de dados corrompido

1. Na interface da Manus, vá para "Backups"
2. Selecione um backup anterior
3. Clique em "Restore"

### Performance baixa

1. Verificar uso de CPU/memória
2. Verificar logs de erro
3. Otimizar queries do banco
4. Aumentar recursos (se necessário)

### Erro 502 Bad Gateway

1. Verificar se aplicação está respondendo
2. Verificar logs
3. Reiniciar aplicação
4. Fazer rollback se necessário

---

## 🎯 Resumo Final

| Etapa | Status |
|-------|--------|
| Git Setup | ✅ |
| GitHub Repo | ✅ |
| Manus Connection | ✅ |
| Env Variables | ✅ |
| Build Config | ✅ |
| Domain Setup | ✅ |
| Auto Deploy | ✅ |
| Monitoring | ✅ |
| Backups | ✅ |

---

## 📞 Próximos Passos

1. ✅ Fazer push do código para GitHub
2. ✅ Conectar repositório à Manus App Platform
3. ✅ Configurar variáveis de ambiente
4. ✅ Fazer deploy
5. ✅ Acessar aplicação via URL pública
6. ✅ Configurar domínio customizado (opcional)
7. ✅ Ativar auto-deploy
8. ✅ Monitorar aplicação

---

## 📚 Recursos Adicionais

- **Documentação Manus:** https://manus.im/docs
- **GitHub:** https://github.com
- **Node.js:** https://nodejs.org
- **Express:** https://expressjs.com
- **React:** https://react.dev

---

**Seu site permanente está pronto para deploy! 🚀**
