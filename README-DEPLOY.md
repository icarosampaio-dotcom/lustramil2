# LustraMil - Deploy na Manus App Platform

## 🎯 Resumo Rápido

Este projeto está **100% pronto** para fazer deploy na **Manus App Platform** como um site **permanente 24/7**.

---

## ⚡ Quick Start (5 minutos)

### 1. Criar Repositório no GitHub

```bash
# Já dentro do diretório do projeto
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/lustramil.git
git push -u origin main
```

### 2. Acessar Manus App Platform

1. Vá para https://manus.im
2. Faça login
3. Clique em "Deploy New App"
4. Selecione "Import from GitHub"
5. Escolha o repositório `lustramil`

### 3. Configurar Variáveis

Adicione na interface da Manus:

```
NODE_ENV = production
DATABASE_URL = file:./data/lustramil.db
JWT_SECRET = seu-secret-super-seguro-aqui
VITE_APP_ID = lustramil-app
```

### 4. Deploy

Clique em "Deploy" e pronto! 🚀

---

## 📋 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `DEPLOY-MANUS.md` | Guia completo de deploy (passo a passo) |
| `manus.yml` | Configuração da aplicação para Manus |
| `Dockerfile` | Configuração do container |
| `.env.example` | Exemplo de variáveis de ambiente |
| `.gitignore` | Arquivos ignorados pelo Git |

---

## 🌐 Resultado Final

Após o deploy, você terá:

✅ **URL Permanente:** `https://lustramil.manus.app`  
✅ **Auto-restart:** Em caso de falha  
✅ **SSL/HTTPS:** Automático  
✅ **Backups:** Diários automáticos  
✅ **Monitoramento:** 24/7  
✅ **Escalabilidade:** Automática  
✅ **Logs:** Em tempo real  

---

## 📖 Documentação Completa

Para instruções detalhadas, consulte:

- **DEPLOY-MANUS.md** - Guia passo a passo completo
- **MANUTENCAO.md** - Operação e manutenção
- **README-PERMANENTE.md** - Guia de uso

---

## 🔒 Segurança

⚠️ **IMPORTANTE:**
1. Altere o `JWT_SECRET` em variáveis de ambiente
2. Use um banco de dados MySQL em produção (opcional)
3. Configure domínio customizado com SSL

---

## 🚀 Começar Agora!

1. Leia o arquivo **DEPLOY-MANUS.md**
2. Crie repositório no GitHub
3. Conecte à Manus App Platform
4. Configure variáveis
5. Faça deploy!

---

**Seu site permanente está pronto! 🎉**
