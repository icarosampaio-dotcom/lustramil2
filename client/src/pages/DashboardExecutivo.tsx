import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  DollarSign,
  BarChart3,
  Search,
  ArrowUpDown,
  Boxes,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
  Cell,
} from "recharts";

export default function DashboardExecutivo() {
  return (
    <DashboardLayout>
      <DashboardExecutivoContent />
    </DashboardLayout>
  );
}

type MarginSort = "name" | "salePrice" | "productionCost" | "margin" | "marginPercent";
type SortDir = "asc" | "desc";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number) {
  return v.toFixed(1) + "%";
}

function fmtNum(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function DashboardExecutivoContent() {
  const [marginSearch, setMarginSearch] = useState("");
  const [marginSort, setMarginSort] = useState<MarginSort>("marginPercent");
  const [marginSortDir, setMarginSortDir] = useState<SortDir>("desc");
  const [marginFilter, setMarginFilter] = useState<"all" | "positive" | "negative" | "zero">("all");

  const { data: margemData, isLoading: loadingMargem } = trpc.reports.margemBrutaProdutos.useQuery();
  const { data: revenueData, isLoading: loadingRevenue } = trpc.reports.monthlyRevenue.useQuery();
  const { data: alertas, isLoading: loadingAlertas } = trpc.reports.insumosClasseAAlerta.useQuery();

  // ─── Margem bruta filtering and sorting ───
  const filteredMargem = useMemo(() => {
    if (!margemData) return [];
    let items = [...margemData];
    if (marginSearch) {
      const q = marginSearch.toLowerCase();
      items = items.filter(i => i.productName.toLowerCase().includes(q) || (i.reference && i.reference.toLowerCase().includes(q)));
    }
    if (marginFilter === "positive") items = items.filter(i => i.margin > 0);
    else if (marginFilter === "negative") items = items.filter(i => i.margin < 0);
    else if (marginFilter === "zero") items = items.filter(i => i.margin === 0 || i.productionCost === 0);

    items.sort((a: any, b: any) => {
      const av = a[marginSort] ?? 0;
      const bv = b[marginSort] ?? 0;
      if (typeof av === "string") return marginSortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      return marginSortDir === "desc" ? bv - av : av - bv;
    });
    return items;
  }, [margemData, marginSearch, marginSort, marginSortDir, marginFilter]);

  const toggleMarginSort = (field: MarginSort) => {
    if (marginSort === field) setMarginSortDir(d => d === "asc" ? "desc" : "asc");
    else { setMarginSort(field); setMarginSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: MarginSort }) => (
    <ArrowUpDown className={`inline ml-1 h-3 w-3 cursor-pointer ${marginSort === field ? "text-primary" : "text-muted-foreground/40"}`} />
  );

  // ─── Summary stats ───
  const margemSummary = useMemo(() => {
    if (!margemData || margemData.length === 0) return null;
    const withCost = margemData.filter(i => i.productionCost > 0);
    const avgMargin = withCost.length > 0 ? withCost.reduce((s, i) => s + i.marginPercent, 0) / withCost.length : 0;
    const negativeCount = margemData.filter(i => i.margin < 0).length;
    const noCostCount = margemData.filter(i => i.productionCost === 0 && i.salePrice > 0).length;
    const totalRevenue = margemData.reduce((s, i) => s + i.salePrice, 0);
    const totalCost = margemData.reduce((s, i) => s + i.productionCost, 0);
    return { avgMargin, negativeCount, noCostCount, totalProducts: margemData.length, totalRevenue, totalCost, withCostCount: withCost.length };
  }, [margemData]);

  // ─── Revenue chart data ───
  const chartData = useMemo(() => {
    if (!revenueData || revenueData.length === 0) return [];
    return revenueData.map(r => {
      const [year, month] = r.yearMonth.split("-");
      return {
        label: `${MONTH_NAMES[month] || month}/${year.slice(2)}`,
        vendas: r.vendas,
        compras: r.compras,
        resultado: r.resultado,
        notasVenda: r.notasVenda,
        notasCompra: r.notasCompra,
      };
    });
  }, [revenueData]);

  const revenueSummary = useMemo(() => {
    if (!revenueData || revenueData.length === 0) return null;
    const totalVendas = revenueData.reduce((s, r) => s + r.vendas, 0);
    const totalCompras = revenueData.reduce((s, r) => s + r.compras, 0);
    const lastMonth = revenueData[revenueData.length - 1];
    const prevMonth = revenueData.length >= 2 ? revenueData[revenueData.length - 2] : null;
    const growth = prevMonth && prevMonth.vendas > 0
      ? ((lastMonth.vendas - prevMonth.vendas) / prevMonth.vendas) * 100
      : 0;
    return { totalVendas, totalCompras, resultado: totalVendas - totalCompras, lastMonth, growth, months: revenueData.length };
  }, [revenueData]);

  const getMarginColor = (pct: number) => {
    if (pct >= 30) return "text-emerald-700";
    if (pct >= 15) return "text-yellow-700";
    if (pct >= 0) return "text-orange-700";
    return "text-red-700";
  };

  const getMarginBg = (pct: number) => {
    if (pct >= 30) return "bg-emerald-100 text-emerald-800";
    if (pct >= 15) return "bg-yellow-100 text-yellow-800";
    if (pct >= 0) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gauge className="h-6 w-6 text-blue-600" />
          Dashboard Executivo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão consolidada: margem bruta, faturamento mensal e alertas de insumos críticos
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════
         SEÇÃO 1: EVOLUÇÃO MENSAL DE FATURAMENTO
         ═══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Evolução Mensal de Faturamento — Últimos 12 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRevenue ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : !revenueSummary ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dado de faturamento encontrado.</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-emerald-600 font-semibold tracking-wider">Vendas ({revenueSummary.months}m)</p>
                  <p className="text-lg font-bold text-emerald-700 mt-1">{fmtBRL(revenueSummary.totalVendas)}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-orange-600 font-semibold tracking-wider">Compras ({revenueSummary.months}m)</p>
                  <p className="text-lg font-bold text-orange-700 mt-1">{fmtBRL(revenueSummary.totalCompras)}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${revenueSummary.resultado >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
                  <p className={`text-[10px] uppercase font-semibold tracking-wider ${revenueSummary.resultado >= 0 ? "text-blue-600" : "text-red-600"}`}>Resultado</p>
                  <p className={`text-lg font-bold mt-1 ${revenueSummary.resultado >= 0 ? "text-blue-700" : "text-red-700"}`}>{fmtBRL(revenueSummary.resultado)}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${revenueSummary.growth >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Var. Mês Anterior</p>
                  <p className={`text-lg font-bold mt-1 flex items-center justify-center gap-1 ${revenueSummary.growth >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {revenueSummary.growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {fmtPct(revenueSummary.growth)}
                  </p>
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
                            <p className="font-semibold mb-1">{d?.label}</p>
                            <p className="text-emerald-700">Vendas: <strong>{fmtBRL(d?.vendas || 0)}</strong> ({d?.notasVenda} notas)</p>
                            <p className="text-orange-700">Compras: <strong>{fmtBRL(d?.compras || 0)}</strong> ({d?.notasCompra} notas)</p>
                            <p className={d?.resultado >= 0 ? "text-blue-700" : "text-red-700"}>
                              Resultado: <strong>{fmtBRL(d?.resultado || 0)}</strong>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar dataKey="vendas" name="Vendas" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="compras" name="Compras" fill="#d97706" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
         SEÇÃO 2: ALERTAS DE INSUMOS CLASSE A COM ESTOQUE BAIXO
         ═══════════════════════════════════════════════════════ */}
      <Card className={alertas && alertas.length > 0 ? "border-red-300 bg-red-50/30" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${alertas && alertas.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              Alertas — Insumos Classe A com Estoque Baixo
              {alertas && alertas.length > 0 && (
                <Badge variant="destructive" className="text-xs ml-1">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAlertas ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600" />
            </div>
          ) : !alertas || alertas.length === 0 ? (
            <div className="text-center py-6">
              <Boxes className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum insumo classe A com estoque baixo. Tudo em ordem!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`rounded-lg border p-3 ${
                    alerta.status === "zerado"
                      ? "bg-red-100 border-red-300"
                      : "bg-amber-50 border-amber-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" title={alerta.name}>{alerta.name}</p>
                      <p className="text-[10px] text-muted-foreground">{alerta.category || "Sem categoria"} — {alerta.unit}</p>
                    </div>
                    <Badge variant={alerta.status === "zerado" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                      {alerta.status === "zerado" ? "ZERADO" : "BAIXO"}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[9px] uppercase text-muted-foreground">Atual</p>
                      <p className={`text-sm font-bold ${alerta.status === "zerado" ? "text-red-700" : "text-amber-700"}`}>
                        {fmtNum(alerta.currentStock)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-muted-foreground">Mínimo</p>
                      <p className="text-sm font-bold text-muted-foreground">{fmtNum(alerta.minStock)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-muted-foreground">Déficit</p>
                      <p className="text-sm font-bold text-red-700">{fmtNum(alerta.deficit)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Preço: {fmtBRL(alerta.unitPrice)}</span>
                    <span>Usado em {alerta.usedInProducts} prod.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
         SEÇÃO 3: MARGEM BRUTA POR PRODUTO
         ═══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Margem Bruta por Produto
            <span className="text-xs font-normal text-muted-foreground ml-1">(Custo Ficha Técnica vs Preço de Venda)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMargem ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : !margemSummary ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum produto com preço de venda ou ficha técnica cadastrada.</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Produtos</p>
                  <p className="text-lg font-bold">{margemSummary.totalProducts}</p>
                  <p className="text-[10px] text-muted-foreground">{margemSummary.withCostCount} com ficha</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-emerald-600 font-semibold">Margem Média</p>
                  <p className={`text-lg font-bold ${getMarginColor(margemSummary.avgMargin)}`}>{fmtPct(margemSummary.avgMargin)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-red-600 font-semibold">Margem Negativa</p>
                  <p className="text-lg font-bold text-red-700">{margemSummary.negativeCount}</p>
                  <p className="text-[10px] text-muted-foreground">produtos</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-amber-600 font-semibold">Sem Ficha</p>
                  <p className="text-lg font-bold text-amber-700">{margemSummary.noCostCount}</p>
                  <p className="text-[10px] text-muted-foreground">produtos</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-blue-600 font-semibold">Margem Total</p>
                  <p className="text-lg font-bold text-blue-700">{fmtBRL(margemSummary.totalRevenue - margemSummary.totalCost)}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={marginSearch}
                    onChange={(e) => setMarginSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Select value={marginFilter} onValueChange={(v) => setMarginFilter(v as any)}>
                  <SelectTrigger className="w-[160px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="positive">Margem Positiva</SelectItem>
                    <SelectItem value="negative">Margem Negativa</SelectItem>
                    <SelectItem value="zero">Sem Ficha / Zero</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="h-9 px-3 text-xs flex items-center">
                  {filteredMargem.length} produtos
                </Badge>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-left py-2 px-3 font-medium cursor-pointer hover:text-primary" onClick={() => toggleMarginSort("name")}>
                        Produto <SortIcon field="name" />
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-xs">Ref.</th>
                      <th className="text-right py-2 px-3 font-medium cursor-pointer hover:text-primary" onClick={() => toggleMarginSort("salePrice")}>
                        Preço Venda <SortIcon field="salePrice" />
                      </th>
                      <th className="text-right py-2 px-3 font-medium cursor-pointer hover:text-primary" onClick={() => toggleMarginSort("productionCost")}>
                        Custo Ficha <SortIcon field="productionCost" />
                      </th>
                      <th className="text-right py-2 px-3 font-medium cursor-pointer hover:text-primary" onClick={() => toggleMarginSort("margin")}>
                        Margem (R$) <SortIcon field="margin" />
                      </th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-primary" onClick={() => toggleMarginSort("marginPercent")}>
                        Margem % <SortIcon field="marginPercent" />
                      </th>
                      <th className="text-center py-2 px-3 font-medium text-xs">Insumos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMargem.map((item, idx) => (
                      <tr key={item.productId} className={`border-b hover:bg-muted/30 transition-colors ${item.margin < 0 ? "bg-red-50/50" : ""}`}>
                        <td className="py-2 px-3 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium max-w-[220px] truncate" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{item.reference || "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtBRL(item.salePrice)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {item.productionCost > 0 ? fmtBRL(item.productionCost) : (
                            <span className="text-amber-600 text-xs">Sem ficha</span>
                          )}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums font-semibold ${getMarginColor(item.marginPercent)}`}>
                          {item.productionCost > 0 ? fmtBRL(item.margin) : "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.productionCost > 0 ? (
                            <Badge className={`text-xs ${getMarginBg(item.marginPercent)}`}>
                              {fmtPct(item.marginPercent)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className="text-[10px]">{item.insumoCount}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredMargem.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          Nenhum produto encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredMargem.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td colSpan={3} className="py-2 px-3">TOTAL ({filteredMargem.length} produtos)</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtBRL(filteredMargem.reduce((s, i) => s + i.salePrice, 0))}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtBRL(filteredMargem.filter(i => i.productionCost > 0).reduce((s, i) => s + i.productionCost, 0))}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtBRL(filteredMargem.filter(i => i.productionCost > 0).reduce((s, i) => s + i.margin, 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span>Margem &ge; 30%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span>15% &ndash; 30%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span>0% &ndash; 15%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Negativa</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
