import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download, TrendingUp, RefreshCw, Loader2, ShoppingBag, X,
  FileText, FileSpreadsheet, BarChart2, LineChart as LineChartIcon,
  Store, Calendar, Package, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { DatePickerInput } from "@/components/DatePickerInput";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Area, AreaChart, Cell
} from "recharts";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type VendaItem = {
  data: string;
  ean: string;
  cod_interno: string;
  produto: string;
  qtd: number;
  venda: number;
  custo: number;
};

type VendaLoja = {
  loja: number;
  nome_loja: string;
  cnpj: string;
  vendas: VendaItem[];
  total_venda: number;
  total_itens: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Formato dd/mm/yyyy
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  }
  // Formato yyyy-mm-dd
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

const COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#a855f7",
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CometaVendas() {
  const [search, setSearch] = useState("");
  const [lojaFilter, setLojaFilter] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoGrafico, setTipoGrafico] = useState<"por_loja" | "diario" | "acumulado">("por_loja");
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState<"diario" | "acumulado" | "por_produto" | "matriz">("diario");
  const [isExporting, setIsExporting] = useState(false);

  const { data: vendas = [], isLoading, refetch, isFetching } = trpc.cometa.vendas.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => { refetch(); toast.success("Dados de vendas atualizados!"); },
    onError: () => toast.error("Erro ao atualizar dados."),
  });

  // ─── Filtros aplicados ──────────────────────────────────────────────────────
  const allItems = useMemo(() => {
    const items: Array<VendaItem & { nome_loja: string; loja_num: number }> = [];
    (vendas as VendaLoja[]).forEach(v => {
      v.vendas.forEach(item => {
        items.push({ ...item, nome_loja: v.nome_loja, loja_num: v.loja });
      });
    });
    return items;
  }, [vendas]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (lojaFilter !== "todas" && item.loja_num !== parseInt(lojaFilter)) return false;
      if (search && !item.produto.toLowerCase().includes(search.toLowerCase()) &&
          !item.ean?.includes(search) && !item.cod_interno?.includes(search)) return false;
      if (dataInicio || dataFim) {
        const d = parseDate(item.data);
        if (!d) return true;
        if (dataInicio && d < new Date(dataInicio + "T00:00:00")) return false;
        if (dataFim && d > new Date(dataFim + "T23:59:59")) return false;
      }
      return true;
    });
  }, [allItems, lojaFilter, search, dataInicio, dataFim]);

  // ─── Métricas ───────────────────────────────────────────────────────────────
  const totalVendas = useMemo(() => filteredItems.reduce((s, i) => s + i.venda, 0), [filteredItems]);
  const totalItens = useMemo(() => filteredItems.reduce((s, i) => s + i.qtd, 0), [filteredItems]);
  const ticketMedio = useMemo(() => {
    const dias = new Set(filteredItems.map(i => i.data)).size;
    return dias > 0 ? totalVendas / dias : 0;
  }, [filteredItems, totalVendas]);
  const lojaTop = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach(i => map.set(i.nome_loja, (map.get(i.nome_loja) || 0) + i.venda));
    let best = { nome: "—", valor: 0 };
    map.forEach((v, k) => { if (v > best.valor) best = { nome: k, valor: v }; });
    return best;
  }, [filteredItems]);

  // ─── Dados para gráficos ────────────────────────────────────────────────────

  // Gráfico 1: Vendas por loja (barras horizontais)
  const chartPorLoja = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach(i => map.set(i.nome_loja, (map.get(i.nome_loja) || 0) + i.venda));
    return Array.from(map.entries())
      .map(([nome, valor]) => ({
        nome: nome.replace(/^\d+ - /, "").substring(0, 20),
        valor: parseFloat(valor.toFixed(2)),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);
  }, [filteredItems]);

  // Gráfico 2: Vendas diárias (total por dia)
  const chartDiario = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach(i => {
      const d = i.data || "—";
      map.set(d, (map.get(d) || 0) + i.venda);
    });
    return Array.from(map.entries())
      .map(([data, valor]) => ({ data, valor: parseFloat(valor.toFixed(2)) }))
      .sort((a, b) => {
        const da = parseDate(a.data), db = parseDate(b.data);
        if (!da || !db) return 0;
        return da.getTime() - db.getTime();
      });
  }, [filteredItems]);

  // Gráfico 2b: Vendas diárias por produto (barras empilhadas)
  const chartDiarioPorProduto = useMemo(() => {
    // Coletar datas e produtos únicos
    const datas = Array.from(new Set(filteredItems.map(i => i.data))).sort((a, b) => {
      const da = parseDate(a), db = parseDate(b);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    });
    const produtos = Array.from(new Set(filteredItems.map(i => i.produto))).slice(0, 10);
    // Montar tabela cruzada: { data, [produto]: valor }
    return datas.map(data => {
      const row: Record<string, any> = { data };
      produtos.forEach(p => {
        row[p] = parseFloat(
          filteredItems
            .filter(i => i.data === data && i.produto === p)
            .reduce((s, i) => s + i.venda, 0)
            .toFixed(2)
        );
      });
      return row;
    });
  }, [filteredItems]);

  const produtosUnicos = useMemo(() =>
    Array.from(new Set(filteredItems.map(i => i.produto))).slice(0, 10),
  [filteredItems]);

  // Gráfico 3: Vendas acumuladas
  const chartAcumulado = useMemo(() => {
    let acc = 0;
    return chartDiario.map(d => {
      acc += d.valor;
      return { data: d.data, diario: d.valor, acumulado: parseFloat(acc.toFixed(2)) };
    });
  }, [chartDiario]);

  // ─── Chips de filtros ativos ─────────────────────────────────────────────────
  const activeFilters: Array<{ label: string; onRemove: () => void }> = [];
  if (lojaFilter !== "todas") {
    const loja = (vendas as VendaLoja[]).find(v => v.loja === parseInt(lojaFilter));
    activeFilters.push({ label: `Loja: ${loja?.nome_loja || lojaFilter}`, onRemove: () => setLojaFilter("todas") });
  }
  if (dataInicio) activeFilters.push({ label: `De: ${dataInicio}`, onRemove: () => setDataInicio("") });
  if (dataFim) activeFilters.push({ label: `Até: ${dataFim}`, onRemove: () => setDataFim("") });
  if (search) activeFilters.push({ label: `Busca: "${search}"`, onRemove: () => setSearch("") });

  // ─── Exportação ─────────────────────────────────────────────────────────────
  const handleExportMatrizPDF = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/trpc/cometa.exportVendasMatrizPDF", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          json: {
            filtroLoja: lojaFilter !== "todas" ? lojaFilter : undefined,
            filtroDataInicio: dataInicio || undefined,
            filtroDataFim: dataFim || undefined,
          }
        }),
      });
      const data = await res.json();
      const result = data?.result?.data?.json;
      if (!result?.base64 || result.base64.length === 0) {
        toast.error("Sem dados para gerar PDF. Clique em Atualizar para recarregar os dados do Cometa.");
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF Matriz gerado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF Matriz.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMatrizExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/trpc/cometa.exportVendasMatrizExcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          json: {
            filtroLoja: lojaFilter !== "todas" ? lojaFilter : undefined,
            filtroDataInicio: dataInicio || undefined,
            filtroDataFim: dataFim || undefined,
          }
        }),
      });
      const data = await res.json();
      const result = data?.result?.data?.json;
      if (!result?.base64) throw new Error("Sem dados");
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel Matriz gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar Excel Matriz.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (tipoRelatorio === "matriz") { handleExportMatrizPDF(); return; }
    setIsExporting(true);
    try {
      const res = await fetch("/api/trpc/cometa.exportVendasPDF", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          json: {
            tipo: tipoRelatorio,
            filtroLoja: lojaFilter !== "todas" ? parseInt(lojaFilter) : undefined,
            filtroDataInicio: dataInicio || undefined,
            filtroDataFim: dataFim || undefined,
          }
        }),
      });
      const data = await res.json();
      const result = data?.result?.data?.json;
      if (!result?.base64 || result.base64.length === 0) {
        toast.error("Sem dados para gerar PDF. Clique em Atualizar para recarregar os dados do Cometa.");
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF. Tente atualizar os dados primeiro.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (tipoRelatorio === "matriz") { handleExportMatrizExcel(); return; }
    setIsExporting(true);
    try {
      const res = await fetch("/api/trpc/cometa.exportVendasExcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          json: {
            tipo: tipoRelatorio,
            filtroLoja: lojaFilter !== "todas" ? parseInt(lojaFilter) : undefined,
            filtroDataInicio: dataInicio || undefined,
            filtroDataFim: dataFim || undefined,
          }
        }),
      });
      const data = await res.json();
      const result = data?.result?.data?.json;
      if (!result?.base64) throw new Error("Sem dados");
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Vendas Cometa</h1>
          <p className="text-muted-foreground text-sm">Vendas reais sincronizadas do Cometa Supermercados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending || isFetching}>
            {(forceSyncMutation.isPending || isFetching) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
          <Button onClick={() => setShowRelatorio(!showRelatorio)} variant={showRelatorio ? "default" : "outline"}>
            <FileText className="h-4 w-4 mr-2" />
            {showRelatorio ? "Fechar Relatório" : "Gerar Relatório"}
          </Button>
        </div>
      </div>

      {/* Painel de Relatório */}
      {showRelatorio && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <FileText className="h-5 w-5" /> Emissão de Relatório de Vendas
            </CardTitle>
            <CardDescription className="text-blue-700">
              Os filtros ativos serão aplicados ao relatório gerado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-blue-800">Tipo de Relatório</Label>
                <Select value={tipoRelatorio} onValueChange={(v: any) => setTipoRelatorio(v)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">📅 Venda Diária (por dia)</SelectItem>
                    <SelectItem value="acumulado">📈 Venda Acumulada (cumulativo)</SelectItem>
                    <SelectItem value="por_produto">📦 Por Produto (ranking)</SelectItem>
                    <SelectItem value="matriz">📊 Matriz Produto × Dia (planilha cruzada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-800">Filtros Ativos</Label>
                <div className="flex flex-wrap gap-1 min-h-9 items-center">
                  {activeFilters.length === 0 ? (
                    <span className="text-sm text-blue-600">Sem filtros — relatório completo</span>
                  ) : activeFilters.map((f, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 bg-blue-100 text-blue-800">
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-800">Resumo</Label>
                <div className="text-sm text-blue-700 space-y-0.5">
                  <p><strong>{filteredItems.length}</strong> registros de venda</p>
                  <p>Total: <strong>{fmt(totalVendas)}</strong></p>
                  <p>Período: <strong>{chartDiario.length} dias</strong></p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleExportPDF} disabled={isExporting || filteredItems.length === 0} className="bg-red-600 hover:bg-red-700">
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Baixar PDF
              </Button>
              <Button onClick={handleExportExcel} disabled={isExporting || filteredItems.length === 0} className="bg-green-700 hover:bg-green-800">
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Baixar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de métricas */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-green-600">
              <DollarSign className="h-3.5 w-3.5" /> Total de Vendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{isLoading ? "..." : fmt(totalVendas)}</p>
            <p className="text-xs text-muted-foreground mt-1">no período filtrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Média Diária
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{isLoading ? "..." : fmt(ticketMedio)}</p>
            <p className="text-xs text-muted-foreground mt-1">por dia de venda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Unidades Vendidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{isLoading ? "..." : totalItens.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">total de itens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-blue-600">
              <Store className="h-3.5 w-3.5" /> Maior Loja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold text-blue-600 truncate">{isLoading ? "..." : lojaTop.nome.replace(/^\d+ - /, "").substring(0, 18)}</p>
            <p className="text-xs text-muted-foreground mt-1">{isLoading ? "" : fmt(lojaTop.valor)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Buscar produto / EAN</Label>
              <Input placeholder="Nome, código ou EAN..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Loja</Label>
              <Select value={lojaFilter} onValueChange={setLojaFilter}>
                <SelectTrigger><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {(vendas as VendaLoja[]).map(v => (
                    <SelectItem key={v.loja} value={String(v.loja)}>{v.nome_loja}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data inicial</Label>
              <DatePickerInput value={dataInicio} onChange={setDataInicio} placeholder="Data inicial" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data final</Label>
              <DatePickerInput value={dataFim} onChange={setDataFim} placeholder="Data final" />
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {activeFilters.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={f.onRemove}>
                  {f.label} <X className="h-3 w-3" />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => {
                setSearch(""); setLojaFilter("todas"); setDataInicio(""); setDataFim("");
              }}>
                Limpar tudo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seletor de gráfico */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={tipoGrafico === "por_loja" ? "default" : "outline"}
          size="sm"
          onClick={() => setTipoGrafico("por_loja")}
        >
          <BarChart2 className="h-4 w-4 mr-1" /> Por Loja
        </Button>
        <Button
          variant={tipoGrafico === "diario" ? "default" : "outline"}
          size="sm"
          onClick={() => setTipoGrafico("diario")}
        >
          <BarChart2 className="h-4 w-4 mr-1" /> Venda Diária
        </Button>
        <Button
          variant={tipoGrafico === "acumulado" ? "default" : "outline"}
          size="sm"
          onClick={() => setTipoGrafico("acumulado")}
        >
          <LineChartIcon className="h-4 w-4 mr-1" /> Acumulado
        </Button>
      </div>

      {/* Gráficos */}
      {!isLoading && (
        <>
          {tipoGrafico === "por_loja" && chartPorLoja.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" /> Vendas por Loja (R$)
                </CardTitle>
                <CardDescription>Top {chartPorLoja.length} lojas por volume de vendas no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, chartPorLoja.length * 32)}>
                  <BarChart
                    data={chartPorLoja}
                    layout="vertical"
                    margin={{ top: 5, right: 60, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [fmt(Number(value)), "Vendas"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="valor" name="Vendas (R$)" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {chartPorLoja.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {tipoGrafico === "diario" && chartDiarioPorProduto.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-blue-600" /> Venda Diária por Produto (R$)
                </CardTitle>
                <CardDescription>Vendas de cada produto por dia — {produtosUnicos.length} produtos, {chartDiarioPorProduto.length} dias</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartDiarioPorProduto}
                    margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={v => `R$${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any, name: string) => [fmt(Number(value)), name]}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                    {produtosUnicos.map((p, idx) => (
                      <Bar key={p} dataKey={p} stackId="a" fill={COLORS[idx % COLORS.length]} maxBarSize={60} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {/* Tabela resumo por produto/dia */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border px-2 py-1 text-left font-semibold">Produto</th>
                        {chartDiarioPorProduto.map(d => (
                          <th key={d.data} className="border px-2 py-1 text-center font-semibold">{d.data}</th>
                        ))}
                        <th className="border px-2 py-1 text-center font-semibold bg-blue-100">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtosUnicos.map((p, idx) => {
                        const total = chartDiarioPorProduto.reduce((s, d) => s + (d[p] || 0), 0);
                        return (
                          <tr key={p} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border px-2 py-1 font-medium max-w-[160px] truncate" title={p}>{p}</td>
                            {chartDiarioPorProduto.map(d => (
                              <td key={d.data} className="border px-2 py-1 text-right">
                                {d[p] > 0 ? fmt(d[p]) : <span className="text-gray-300">—</span>}
                              </td>
                            ))}
                            <td className="border px-2 py-1 text-right font-bold bg-blue-50">{fmt(total)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-blue-100 font-bold">
                        <td className="border px-2 py-1">TOTAL DO DIA</td>
                        {chartDiarioPorProduto.map(d => {
                          const tot = produtosUnicos.reduce((s, p) => s + (d[p] || 0), 0);
                          return <td key={d.data} className="border px-2 py-1 text-right">{fmt(tot)}</td>;
                        })}
                        <td className="border px-2 py-1 text-right">{fmt(filteredItems.reduce((s,i)=>s+i.venda,0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {tipoGrafico === "acumulado" && chartAcumulado.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-purple-600" /> Venda Acumulada (R$)
                </CardTitle>
                <CardDescription>Evolução cumulativa das vendas no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={chartAcumulado}
                    margin={{ top: 5, right: 20, left: 10, bottom: chartAcumulado.length > 10 ? 60 : 20 }}
                  >
                    <defs>
                      <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorDia" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 11 }}
                      angle={chartAcumulado.length > 10 ? -40 : 0}
                      textAnchor={chartAcumulado.length > 10 ? "end" : "middle"}
                      interval={chartAcumulado.length > 20 ? Math.floor(chartAcumulado.length / 15) : 0}
                    />
                    <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any, name: string) => [fmt(Number(value)), name === "Acumulado" ? "Acumulado" : "Diário"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="diario" name="Diário" stroke="#3b82f6" fill="url(#colorDia)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="#8b5cf6" fill="url(#colorAcc)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tabela de vendas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Detalhamento de Vendas
          </CardTitle>
          <CardDescription>
            {isLoading ? "Carregando dados da API do Cometa..." : `${filteredItems.length} registro(s) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Carregando vendas do Cometa...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Nenhuma venda encontrada</p>
              <p className="text-sm mt-1">Ajuste os filtros para ver os dados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Produto</th>
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Loja</th>
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Data</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Qtd</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Venda</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground hidden md:table-cell">Custo</th>
                    <th className="py-2 px-3 text-right font-semibold text-muted-foreground hidden md:table-cell">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.slice(0, 200).map((item, idx) => {
                    const margem = item.venda > 0 ? ((item.venda - item.custo) / item.venda * 100) : 0;
                    return (
                      <tr key={idx} className={`border-b hover:bg-muted/40 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="py-2 px-3">
                          <p className="font-medium">{item.produto}</p>
                          <p className="text-xs text-muted-foreground">EAN: {item.ean?.replace(",", "")} | Cód: {item.cod_interno}</p>
                        </td>
                        <td className="py-2 px-3 text-sm text-muted-foreground hidden sm:table-cell">{item.nome_loja}</td>
                        <td className="py-2 px-3 text-muted-foreground whitespace-nowrap hidden sm:table-cell">{item.data}</td>
                        <td className="py-2 px-3 text-right font-medium">{item.qtd}</td>
                        <td className="py-2 px-3 text-right font-bold text-green-600">{fmt(item.venda)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground hidden md:table-cell">{fmt(item.custo)}</td>
                        <td className="py-2 px-3 text-right hidden md:table-cell">
                          <span className={`font-medium ${margem >= 30 ? "text-green-600" : margem >= 15 ? "text-yellow-600" : "text-red-600"}`}>
                            {margem.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredItems.length > 200 && (
                <p className="text-center text-xs text-muted-foreground mt-3 py-2 border-t">
                  Exibindo 200 de {filteredItems.length} registros. Use os filtros para refinar os resultados.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
