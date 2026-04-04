import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShoppingCart, Eye, Package, MapPin, Calendar, DollarSign,
  RefreshCw, Loader2, FileText, FileSpreadsheet, Printer,
  Filter, X, ChevronDown, ChevronUp, TrendingUp, Store, Search
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  entregue: { label: "Entregue/Baixado", color: "bg-green-100 text-green-800 border-green-300" },
  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-800 border-blue-300" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-300" },
};

type Produto = {
  nome: string;
  codigo: string;
  ean: string;
  qtd: number;
  qtd_embalagem: number;
  valor_unitario: number;
  valor: string;
  valor_numerico: number;
};

type Order = {
  id: string;
  numero_pedido: string;
  data: string;
  loja: string;
  loja_numero: number;
  cnpj: string;
  status: string;
  status_raw: string;
  frete: string;
  comprador: { nome: string; codigo: string };
  prazo_pagamento: string;
  observacao: string;
  produtos: Produto[];
  valor_total: number;
  total_unidades: number;
  total: string;
  itens: number;
};

function downloadBase64File(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Converte "DD/MM/AAAA" para Date
function parseDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  return null;
}

export default function CometaPedidos() {
  // ─── Filtros de lista ────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterLoja, setFilterLoja] = useState("todas");
  const [filterProduto, setFilterProduto] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // ─── Modal de detalhes ───────────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ─── Modal de relatório ──────────────────────────────────────────────────
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);

  // ─── Agrupamento por loja ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"lista" | "loja">("lista");
  const [expandedLojas, setExpandedLojas] = useState<Set<string>>(new Set());

  const { data: orders = [], isLoading, refetch, isFetching } = trpc.cometa.pedidos.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => { refetch(); toast.success("Dados atualizados!"); },
    onError: () => { toast.error("Erro ao atualizar dados."); },
  });

  const exportPDFMutation = trpc.cometa.exportPedidosPDF.useMutation({
    onSuccess: (result) => {
      downloadBase64File(result.base64, result.filename, result.mimeType);
      toast.success("Relatório PDF gerado!");
      setShowRelatorioModal(false);
    },
    onError: (err) => { toast.error("Erro ao gerar PDF: " + err.message); },
  });

  const exportExcelMutation = trpc.cometa.exportPedidosExcel.useMutation({
    onSuccess: (result) => {
      downloadBase64File(result.base64, result.filename, result.mimeType);
      toast.success("Planilha Excel gerada!");
      setShowRelatorioModal(false);
    },
    onError: (err) => { toast.error("Erro ao gerar Excel: " + err.message); },
  });

  // ─── Listas únicas para selects ──────────────────────────────────────────
  const lojas = useMemo(() => {
    const set = new Map<string, string>();
    orders.forEach((o: Order) => set.set(String(o.loja_numero), o.loja));
    return Array.from(set.entries()).sort((a, b) => +a[0] - +b[0]);
  }, [orders]);

  const produtos = useMemo(() => {
    const set = new Map<string, string>();
    orders.forEach((o: Order) => o.produtos.forEach(p => set.set(p.codigo, p.nome)));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  // ─── Filtragem ────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const dataIni = filterDataInicio ? new Date(filterDataInicio) : null;
    const dataFim = filterDataFim ? new Date(filterDataFim) : null;

    return orders.filter((order: Order) => {
      if (filterStatus !== "todos" && order.status !== filterStatus) return false;
      if (filterLoja !== "todas" && String(order.loja_numero) !== filterLoja) return false;
      if (filterProduto && !order.produtos.some(p => p.codigo === filterProduto)) return false;

      if (dataIni || dataFim) {
        const d = parseDate(order.data);
        if (d) {
          if (dataIni && d < dataIni) return false;
          if (dataFim && d > dataFim) return false;
        }
      }

      if (search) {
        const s = search.toLowerCase();
        const match =
          order.id.toLowerCase().includes(s) ||
          order.loja.toLowerCase().includes(s) ||
          order.cnpj.includes(s) ||
          order.produtos.some(p => p.nome.toLowerCase().includes(s) || p.codigo.toLowerCase().includes(s) || p.ean.includes(s));
        if (!match) return false;
      }

      return true;
    });
  }, [orders, filterStatus, filterLoja, filterProduto, filterDataInicio, filterDataFim, search]);

  // ─── Métricas dos filtrados ───────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalValor = filteredOrders.reduce((s: number, o: Order) => s + o.valor_total, 0);
    const totalUnidades = filteredOrders.reduce((s: number, o: Order) => s + o.total_unidades, 0);
    const pendentes = filteredOrders.filter((o: Order) => o.status === "pendente").length;
    const entregues = filteredOrders.filter((o: Order) => o.status === "entregue").length;
    const prodMap = new Map<string, number>();
    filteredOrders.forEach((o: Order) => o.produtos.forEach(p => {
      prodMap.set(p.codigo, (prodMap.get(p.codigo) || 0) + p.qtd);
    }));
    return { totalValor, totalUnidades, pendentes, entregues, skus: prodMap.size, prodMap };
  }, [filteredOrders]);

  // ─── Top produtos (filtrados) ─────────────────────────────────────────────
  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    filteredOrders.forEach((o: Order) => o.produtos.forEach(p => {
      if (!map.has(p.codigo)) map.set(p.codigo, { nome: p.nome, qtd: 0, valor: 0 });
      const e = map.get(p.codigo)!;
      e.qtd += p.qtd;
      e.valor += p.valor_numerico;
    }));
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [filteredOrders]);

  // ─── Agrupamento por loja ─────────────────────────────────────────────────
  const byLoja = useMemo(() => {
    const map = new Map<string, { loja: string; loja_numero: number; pedidos: Order[]; total: number; unidades: number }>();
    filteredOrders.forEach((o: Order) => {
      const key = String(o.loja_numero);
      if (!map.has(key)) map.set(key, { loja: o.loja, loja_numero: o.loja_numero, pedidos: [], total: 0, unidades: 0 });
      const e = map.get(key)!;
      e.pedidos.push(o);
      e.total += o.valor_total;
      e.unidades += o.total_unidades;
    });
    return Array.from(map.values()).sort((a, b) => a.loja_numero - b.loja_numero);
  }, [filteredOrders]);

  const hasActiveFilters = filterStatus !== "todos" || filterLoja !== "todas" || filterProduto !== "" || filterDataInicio !== "" || filterDataFim !== "" || search !== "";

  const clearFilters = () => {
    setFilterStatus("todos");
    setFilterLoja("todas");
    setFilterProduto("");
    setFilterDataInicio("");
    setFilterDataFim("");
    setSearch("");
  };

  const toggleLoja = (key: string) => {
    setExpandedLojas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isExporting = exportPDFMutation.isPending || exportExcelMutation.isPending;

  // Monta o input de filtros para exportação
  const exportInput = useMemo(() => ({
    filtroStatus: (filterStatus === "todos" ? "todos" : filterStatus) as "pendente" | "entregue" | "todos",
    filtroLoja: filterLoja !== "todas" ? Number(filterLoja) : undefined,
    filtroProdutoCodigo: filterProduto || undefined,
    filtroDataInicio: filterDataInicio || undefined,
    filtroDataFim: filterDataFim || undefined,
    filtroSearch: search || undefined,
  }), [filterStatus, filterLoja, filterProduto, filterDataInicio, filterDataFim, search]);

  return (
    <div className="space-y-5">
      {/* ─── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Pedidos Cometa</h1>
          <p className="text-muted-foreground text-sm">Pedidos reais do Cometa Supermercados • {orders.length} pedidos carregados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending || isFetching}>
            {(forceSyncMutation.isPending || isFetching) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
            <Filter className="h-4 w-4 mr-1" />
            Filtros {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5">!</span>}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowRelatorioModal(true)}
            disabled={isLoading || filteredOrders.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="h-4 w-4 mr-1" />
            Relatório {filteredOrders.length < orders.length && `(${filteredOrders.length})`}
          </Button>
        </div>
      </div>

      {/* ─── Painel de Filtros ───────────────────────────────────────────────── */}
      {showFilters && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3 pt-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" /> Filtros de Pesquisa
              </CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600 hover:text-red-700 h-7 px-2">
                  <X className="h-3 w-3 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Linha 1: Busca geral */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número do pedido, loja, produto, EAN, CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Linha 2: Status + Loja + Produto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status do Pedido</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="pendente">⏳ Pendentes (P)</SelectItem>
                    <SelectItem value="entregue">✅ Entregues (B)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Loja</label>
                <Select value={filterLoja} onValueChange={setFilterLoja}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as lojas</SelectItem>
                    {lojas.map(([num, nome]) => (
                      <SelectItem key={num} value={num}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Produto</label>
                <Select value={filterProduto || "todos"} onValueChange={v => setFilterProduto(v === "todos" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os produtos</SelectItem>
                    {produtos.map(([cod, nome]) => (
                      <SelectItem key={cod} value={cod}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 3: Período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data inicial</label>
                <Input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data final</label>
                <Input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} />
              </div>
            </div>

            {/* Chips de filtros ativos */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 pt-1">
                {filterStatus !== "todos" && (
                  <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-300">
                    Status: {filterStatus === "pendente" ? "Pendente" : "Entregue"}
                    <button onClick={() => setFilterStatus("todos")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filterLoja !== "todas" && (
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border border-blue-300">
                    Loja {filterLoja}
                    <button onClick={() => setFilterLoja("todas")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filterProduto && (
                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full border border-purple-300">
                    Produto: {produtos.find(([c]) => c === filterProduto)?.[1]?.slice(0, 25) || filterProduto}
                    <button onClick={() => setFilterProduto("")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {(filterDataInicio || filterDataFim) && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-300">
                    Período: {filterDataInicio || "..."} → {filterDataFim || "..."}
                    <button onClick={() => { setFilterDataInicio(""); setFilterDataFim(""); }}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {search && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full border border-gray-300">
                    Busca: "{search}"
                    <button onClick={() => setSearch("")}><X className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Cards de Métricas ───────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="text-2xl font-bold">{isLoading ? "..." : filteredOrders.length}</p>
            <p className="text-xs text-muted-foreground">{hasActiveFilters ? `de ${orders.length} total` : "total"}</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{isLoading ? "..." : metrics.pendentes}</p>
            <p className="text-xs text-muted-foreground">para separar</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Entregues</p>
            <p className="text-2xl font-bold text-green-600">{isLoading ? "..." : metrics.entregues}</p>
            <p className="text-xs text-muted-foreground">baixados</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Unidades</p>
            <p className="text-2xl font-bold text-blue-600">{isLoading ? "..." : metrics.totalUnidades}</p>
            <p className="text-xs text-muted-foreground">{metrics.skus} SKUs</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-xl font-bold text-emerald-700">
              {isLoading ? "..." : `R$ ${metrics.totalValor.toFixed(2).replace(".", ",")}`}
            </p>
            <p className="text-xs text-muted-foreground">filtrado</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Top Produtos ────────────────────────────────────────────────────── */}
      {!isLoading && topProdutos.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" /> Top Produtos nos Pedidos Filtrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProdutos.map((p, i) => {
                const max = topProdutos[0].qtd;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium truncate">{p.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.qtd} un • R$ {p.valor.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(p.qtd / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Seletor de Modo de Visualização ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Visualizar por:</span>
        <div className="flex gap-1 border rounded-lg p-1 bg-muted/30">
          <button
            onClick={() => setViewMode("lista")}
            className={`px-3 py-1 rounded text-sm font-medium transition-all ${viewMode === "lista" ? "bg-white shadow text-blue-700" : "text-muted-foreground hover:text-foreground"}`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode("loja")}
            className={`px-3 py-1 rounded text-sm font-medium transition-all ${viewMode === "loja" ? "bg-white shadow text-blue-700" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Store className="h-3.5 w-3.5 inline mr-1" />Por Loja
          </button>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filteredOrders.length} pedido(s) encontrado(s)</span>
      </div>

      {/* ─── Visualização: Lista ─────────────────────────────────────────────── */}
      {viewMode === "lista" && (
        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Carregando pedidos do Cometa...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhum pedido encontrado</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 underline">Limpar filtros</button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((order: Order) => {
                  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pendente;
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">Pedido #{order.id}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {order.loja} • {order.data} • {order.itens} produto(s) • {order.total_unidades} un
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{order.total}</p>
                        </div>
                        <Badge className={`${statusInfo.color} border text-xs shrink-0`}>{statusInfo.label}</Badge>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={e => { e.stopPropagation(); setSelectedOrder(order); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Visualização: Por Loja ──────────────────────────────────────────── */}
      {viewMode === "loja" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Carregando...</span>
            </div>
          ) : byLoja.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma loja encontrada com os filtros aplicados</p>
            </div>
          ) : byLoja.map(grupo => {
            const key = String(grupo.loja_numero);
            const expanded = expandedLojas.has(key);
            const pendentes = grupo.pedidos.filter(p => p.status === "pendente").length;
            return (
              <Card key={key} className={pendentes > 0 ? "border-yellow-200" : "border-green-200"}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => toggleLoja(key)}
                >
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold">{grupo.loja}</p>
                      <p className="text-xs text-muted-foreground">
                        {grupo.pedidos.length} pedido(s) • {grupo.unidades} unidades
                        {pendentes > 0 && <span className="ml-2 text-yellow-700 font-medium">• {pendentes} pendente(s)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-emerald-700">R$ {grupo.total.toFixed(2).replace(".", ",")}</span>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {expanded && (
                  <div className="border-t mx-4 mb-4 pt-3 space-y-2">
                    {grupo.pedidos.map(order => {
                      const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pendente;
                      return (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-2 rounded border hover:bg-muted/30 cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <div>
                            <p className="text-sm font-medium">Pedido #{order.id} — {order.data}</p>
                            <p className="text-xs text-muted-foreground">{order.itens} produto(s) • {order.total_unidades} unidades</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{order.total}</span>
                            <Badge className={`${statusInfo.color} border text-xs`}>{statusInfo.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Modal de Relatório ─────────────────────────────────────────────── */}
      <Dialog open={showRelatorioModal} onOpenChange={setShowRelatorioModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              Gerar Relatório de Pedidos
            </DialogTitle>
            <DialogDescription>
              O relatório será gerado com os <strong>filtros atualmente aplicados</strong> na tela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Resumo dos filtros ativos */}
            <div className="bg-slate-50 border rounded-lg p-3 space-y-1.5 text-sm">
              <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Filtros aplicados no relatório:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{filterStatus === "todos" ? "Todos" : filterStatus === "pendente" ? "Pendentes" : "Entregues"}</span></div>
                <div><span className="text-muted-foreground">Loja:</span> <span className="font-medium">{filterLoja === "todas" ? "Todas" : `Loja ${filterLoja}`}</span></div>
                <div><span className="text-muted-foreground">Produto:</span> <span className="font-medium">{filterProduto ? (produtos.find(([c]) => c === filterProduto)?.[1]?.slice(0, 20) || filterProduto) : "Todos"}</span></div>
                <div><span className="text-muted-foreground">Período:</span> <span className="font-medium">{filterDataInicio || filterDataFim ? `${filterDataInicio || "início"} → ${filterDataFim || "fim"}` : "Todos"}</span></div>
              </div>
            </div>

            {/* Prévia dos dados */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{filteredOrders.length}</p>
                <p className="text-xs text-blue-600">pedidos no relatório</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{metrics.totalUnidades}</p>
                <p className="text-xs text-emerald-600">unidades totais</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{metrics.skus}</p>
                <p className="text-xs text-yellow-600">SKUs distintos</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-purple-700">R$ {metrics.totalValor.toFixed(2).replace(".", ",")}</p>
                <p className="text-xs text-purple-600">valor total</p>
              </div>
            </div>

            {/* Conteúdo do relatório */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1.5">📄 O relatório incluirá:</p>
              <div className="grid grid-cols-1 gap-1 text-xs text-blue-700">
                <p>✓ Resumo com totais de pedidos, unidades, SKUs e valor</p>
                <p>✓ <strong>Consolidado por produto</strong> — soma de quantidades de todos os pedidos filtrados</p>
                <p>✓ Detalhamento por pedido agrupado por loja</p>
                <p>✓ Produtos, EANs, quantidades, embalagens e valores</p>
                <p>✓ Filtros aplicados impressos no cabeçalho</p>
              </div>
            </div>

            {/* Botões */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => exportPDFMutation.mutate(exportInput)}
                disabled={isExporting || filteredOrders.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white h-14 flex-col gap-0.5"
              >
                {exportPDFMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                <span className="text-xs font-medium">{exportPDFMutation.isPending ? "Gerando PDF..." : "Baixar PDF"}</span>
                <span className="text-xs opacity-75">Ideal para imprimir</span>
              </Button>
              <Button
                onClick={() => exportExcelMutation.mutate(exportInput)}
                disabled={isExporting || filteredOrders.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white h-14 flex-col gap-0.5"
              >
                {exportExcelMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
                <span className="text-xs font-medium">{exportExcelMutation.isPending ? "Gerando Excel..." : "Baixar Excel"}</span>
                <span className="text-xs opacity-75">Para análise detalhada</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal de Detalhes do Pedido ────────────────────────────────────── */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5" />
                  Pedido #{selectedOrder.id}
                  <Badge className={`${(statusConfig[selectedOrder.status as keyof typeof statusConfig] || statusConfig.pendente).color} border`}>
                    {(statusConfig[selectedOrder.status as keyof typeof statusConfig] || statusConfig.pendente).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>Detalhes completos do pedido</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Informações da Loja
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Loja:</span><span className="font-medium">{selectedOrder.loja}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">CNPJ:</span><span className="font-medium">{selectedOrder.cnpj}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Comprador:</span><span className="font-medium">{selectedOrder.comprador?.nome} (Cód: {selectedOrder.comprador?.codigo})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Frete:</span><span className="font-medium">{selectedOrder.frete === "C" ? "CIF (por conta do fornecedor)" : selectedOrder.frete}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Prazo Pagamento:</span><span className="font-medium">{selectedOrder.prazo_pagamento} dias</span></div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Calendar className="h-4 w-4" /> Data do Pedido</div>
                      <p className="text-lg font-bold">{selectedOrder.data}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><DollarSign className="h-4 w-4" /> Valor Total</div>
                      <p className="text-lg font-bold text-green-600">{selectedOrder.total}</p>
                    </CardContent>
                  </Card>
                </div>

                {selectedOrder.observacao && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Observação</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground">{selectedOrder.observacao}</p></CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" /> Produtos ({selectedOrder.itens} produto(s) — {selectedOrder.total_unidades} unidades)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOrder.produtos.map((produto, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm">{produto.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Cód: {produto.codigo} | EAN: {produto.ean} | Qtd: {produto.qtd} un | R$ {produto.valor_unitario.toFixed(2).replace(".", ",")} /un
                            </p>
                          </div>
                          <p className="font-semibold text-sm">{produto.valor}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
