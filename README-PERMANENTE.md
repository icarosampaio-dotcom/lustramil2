# LustraMil - Site Permanente

## 🎯 Visão Geral

**LustraMil** é um sistema completo de gerenciamento de estoque de limpeza, hospedado permanentemente na **Manus**.

### 📊 Funcionalidades Principais

- ✅ **Gestão de Usuários** - Administração de usuários e permissões
- ✅ **Controle de Estoque** - Gerenciamento de inventário em tempo real
- ✅ **Vendas** - Processamento e rastreamento de vendas
- ✅ **Caixa** - Gestão de caixa e movimentações
- ✅ **Contas a Pagar/Receber** - Gestão financeira
- ✅ **Análise ABC** - Classificação de produtos por importância
- ✅ **Ficha Técnica** - Documentação de produtos
- ✅ **Relatórios** - Geração de relatórios detalhados
- ✅ **Integração Cometa** - Sincronização com sistema externo
- ✅ **Upload de Arquivos** - Importação de dados em lote

---

## 🌐 Acesso

### URL Pública

```
https://3000-i1kg24puzap5fjfizaqtg-1a5824a4.us1.manus.computer
```

Clique no link acima para acessar o aplicativo!

### Credenciais Padrão

- **Usuário:** admin
- **Senha:** [Será criada na primeira execução]

---

## 🚀 Como Usar

### 1. Acessar o Site

1. Abra o navegador
2. Acesse a URL pública acima
3. Faça login com suas credenciais

### 2. Navegar pelos Módulos

A interface principal oferece acesso aos seguintes módulos:

| Módulo | Descrição |
|--------|-----------|
| **Home** | Dashboard principal com resumo |
| **Estoque** | Gerenciamento de inventário |
| **Vendas** | Processamento de vendas |
| **Caixa** | Movimentações de caixa |
| **Contas** | Contas a pagar e receber |
| **Relatórios** | Geração de relatórios |
| **Admin** | Administração de usuários |

### 3. Importar Dados

1. Acesse o módulo **Upload**
2. Selecione o arquivo (CSV, Excel, etc.)
3. Clique em **Importar**
4. Verifique os dados importados

### 4. Gerar Relatórios

1. Acesse **Relatórios**
2. Selecione o tipo de relatório
3. Configure os filtros
4. Clique em **Gerar**
5. Exporte em PDF ou Excel

---

## 💾 Dados e Backup

### Banco de Dados

- **Tipo:** SQLite (arquivo local)
- **Localização:** `/home/ubuntu/lustramil/data/lustramil.db`
- **Backup automático:** Sim (via cron job)

### Backups Disponíveis

```bash
# Listar backups
ls -la /home/ubuntu/lustramil/backups/

# Realizar backup manual
/home/ubuntu/lustramil/backup.sh
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Arquivo: `/home/ubuntu/lustramil/.env`

```env
DATABASE_URL="file:./data/lustramil.db"
JWT_SECRET="lustramil-production-secret-key-2024-change-this-in-production"
VITE_APP_ID="lustramil-app"
NODE_ENV="production"
```

### Alterar Configurações

1. Editar `.env`
2. Reiniciar o servidor
3. Mudanças entram em efeito

---

## 🔧 Operação

### Iniciar o Servidor

```bash
cd /home/ubuntu/lustramil
./start-server.sh
```

### Parar o Servidor

```bash
kill $(cat /home/ubuntu/lustramil/server.pid)
```

### Verificar Status

```bash
./health-check.sh
cat logs/health-status.json
```

### Ver Logs

```bash
# Logs do servidor
tail -f logs/server.log

# Logs de health check
tail -f logs/health-check.log
```

---

## 📱 Recursos Técnicos

### Stack Tecnológico

- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS
- **Backend:** Express + tRPC + Node.js
- **Banco:** SQLite (Drizzle ORM)
- **UI:** Radix UI + Componentes customizados
- **Autenticação:** JWT com bcryptjs

### Dependências Principais

```json
{
  "react": "19.2.1",
  "express": "4.21.2",
  "drizzle-orm": "0.44.5",
  "tailwindcss": "4.1.14",
  "typescript": "5.9.3"
}
```

---

## 🐛 Troubleshooting

### Servidor não responde

1. Verificar logs: `tail -f logs/server.log`
2. Executar health check: `./health-check.sh`
3. Reiniciar: `kill $(cat server.pid) && ./start-server.sh`

### Dados não aparecem

1. Verificar banco de dados: `ls -la data/`
2. Fazer backup e restaurar: `./backup.sh`
3. Reiniciar servidor

### Performance lenta

1. Verificar recursos: `top -p $(cat server.pid)`
2. Limpar logs antigos: `find logs -name "*.log" -mtime +30 -delete`
3. Reiniciar servidor

---

## 📞 Suporte e Documentação

- **Documentação de Manutenção:** `MANUTENCAO.md`
- **Logs:** `logs/`
- **Backups:** `backups/`
- **Código-fonte:** `client/`, `server/`, `shared/`

---

## 🔐 Segurança

### Recomendações

1. **Altere o JWT_SECRET em produção**
2. **Use HTTPS** (já incluído na Manus)
3. **Faça backups regulares**
4. **Monitore os logs**
5. **Atualize dependências regularmente**

### Permissões

```bash
# Proteger arquivo .env
chmod 600 .env

# Proteger diretório de dados
chmod 700 data/

# Proteger diretório de backups
chmod 700 backups/
```

---

## 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| **Versão** | 1.0.0 |
| **Linguagem** | TypeScript |
| **Banco de Dados** | SQLite |
| **Servidor** | Node.js |
| **Porta** | 3000 |
| **Ambiente** | Manus (Produção) |

---

## 📝 Changelog

### Versão 1.0.0 (02 de Abril de 2026)

- ✅ Site permanente hospedado na Manus
- ✅ Banco de dados SQLite configurado
- ✅ Scripts de inicialização e monitoramento
- ✅ Sistema de backup automático
- ✅ Health check e monitoramento
- ✅ Documentação completa

---

## 📄 Licença

MIT License - Veja LICENSE.md para detalhes

---

**Desenvolvido com ❤️ para LustraMil**

*Última atualização: 02 de Abril de 2026*
