
## Relatórios de Pedidos Cometa

- [x] Rota backend: gerar PDF de pedidos pendentes para expedição
- [x] Rota backend: gerar PDF de pedidos por período (todos os status)
- [x] Rota backend: gerar Excel consolidado de pedidos pendentes
- [x] Frontend: botão "Gerar Relatório" na página de Pedidos Cometa
- [x] Modal de seleção: tipo de relatório (Pendentes / Todos / Por período)
- [x] Relatório PDF com cabeçalho LustraMil, lista de pedidos agrupados por loja, produtos e quantidades
- [x] Relatório Excel com todos os campos dos pedidos

## Melhorias de Relatórios e Filtros (v2)

- [ ] Filtros avançados na página de Pedidos: por data inicial/final, loja específica, produto, status
- [ ] Painel de prévia com resumo dos dados filtrados antes de gerar o relatório
- [ ] Chips/tags mostrando filtros ativos na lista de pedidos
- [ ] Backend: aceitar filtros (lojas, produtos, datas) nas rotas exportPedidosPDF e exportPedidosExcel
- [ ] PDF com filtros aplicados no cabeçalho do relatório
- [ ] Excel com filtros aplicados no cabeçalho da planilha
- [ ] Visualização por loja: agrupar pedidos por loja na tela com expansão/colapso
- [ ] Botão de impressão rápida (atalho para PDF pendentes sem abrir modal)

## Bugs Reportados (03/04/2026)

- [ ] Bug 1: Logo do Cometa não aparece dentro da aba Integração Cometa
- [ ] Bug 2: Nomes "Gestão de Usuários" e "Ranking" aparecem sobrepostos na sidebar da tela principal
- [ ] Bug 3: Símbolo R$ aparece na margem direita vertical em toda a página do PDF (erro de paginação)
- [ ] Bug 4: Aba Monitoramento Cometa apresenta erros - verificar e corrigir

## Melhorias Aba Vendas Cometa (03/04/2026)
- [x] Filtros: período (data inicial/final), loja (todas ou específica), tipo (diária/acumulada)
- [x] Gráfico de vendas diárias legível (barras por dia, cores distintas por loja)
- [x] Gráfico de vendas acumuladas (linha cumulativa por período)
- [x] Cards de métricas: total vendido, ticket médio, qtd de vendas, loja com maior volume
- [x] Tabela de vendas com colunas: data, loja, produto, qtd, valor unitário, total
- [x] Relatório PDF: venda diária e acumulada por período/loja
- [x] Relatório Excel: aba diária + aba acumulada + aba por produto
- [x] Chips de filtros ativos com remoção individual

## Bugs Vendas (03/04/2026 - sessão 2)
- [x] Corrigir tooltip gráfico acumulado: ambas as linhas mostram "Diário" em vez de "Diário" e "Acumulado"
- [x] Corrigir erro ao gerar PDF de vendas
- [x] Corrigir erro ao gerar Excel de vendas

## Bugs Vendas (04/04/2026)
- [ ] Gráfico diário mostra apenas 1 dia mesmo com mês inteiro selecionado - corrigir lógica de agrupamento
- [ ] Venda diária deve mostrar todos os dias do período com venda por produto
- [ ] PDF de vendas continua com erro - investigar causa raiz

## Responsividade Mobile (03/04/2026)
- [ ] DashboardLayout: sidebar vira drawer/menu hambúrguer no mobile (md:hidden)
- [ ] DashboardLayout: botão hambúrguer no header mobile para abrir/fechar menu
- [ ] DashboardLayout: overlay escuro ao abrir menu mobile
- [ ] DashboardLayout: header mobile com logo e nome do sistema
- [ ] Cards de métricas: grid 2 colunas no mobile (grid-cols-2)
- [ ] Tabelas: scroll horizontal no mobile (overflow-x-auto)
- [ ] Tabelas: colunas menos importantes ocultadas no mobile (hidden sm:table-cell)
- [ ] Filtros: empilhados verticalmente no mobile (flex-col)
- [ ] Botões de ação: tamanho adequado para toque no mobile (min-h-10)
- [ ] Gráficos: altura reduzida no mobile (h-48 sm:h-72)
- [ ] Painel de relatório: layout vertical no mobile
- [ ] Textos de título: tamanho reduzido no mobile (text-xl sm:text-3xl)

## Bug Sidebar (04/04/2026)
- [x] Corrigir espaçamento entre label ADMINISTRAÇÃO e itens do menu (muito próximos)

## Relatório Matriz Cruzada Vendas (04/04/2026)
- [ ] PDF: matriz produtos (linhas) × dias (colunas) com total vendido por célula
- [ ] Excel: aba "Matriz Diária" com produtos nas linhas e dias nas colunas
- [ ] Totais por produto (linha) e totais por dia (coluna)
- [ ] Rota backend: exportVendasMatrizPDF e exportVendasMatrizExcel
- [ ] Frontend: opção "Matriz Diária" no modal de relatório de Vendas

## Bug Seletor de Datas (04/04/2026)
- [x] Calendário fecha ao mover o mouse para selecionar um dia — corrigido com DatePickerInput customizado (Popover + Calendar shadcn/ui)

## Bugs Relatórios Vendas (04/04/2026 - sessão 3)
- [ ] PDF retorna "sem dados" mesmo quando Excel gera corretamente — PDF deve usar os mesmos dados do Excel
- [ ] Tabela diária por produto não exibe corretamente — verificar lógica de agrupamento e renderização
