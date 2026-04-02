import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { formatDateBR } from "../../../shared/dateUtils";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Package,
  Filter,
  TrendingUp,
  Search,
  ArrowUpDown,
  Download,
  ShoppingCart,
  Truck,
  Boxes,
  FileText,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  Cell,
} from "recharts";

export default function CurvaAbcPage() {
  return (
    <DashboardLayout>
      <CurvaAbcContent />
    </DashboardLayout>
  );
}

type PeriodType = "mes_atual" | "mes_anterior" | "ultimos_3_meses" | "ultimos_6_meses" | "ano_atual" | "custom";
type ViewMode = "financeiro" | "quantidade";
type DataSection = "vendas" | "compras" | "insumos";
type SortField = "name" | "qty" | "value" | "percent" | "accum";
type SortDir = "asc" | "desc";

function getDateRange(period: PeriodType, customStart?: string, customEnd?: string) {
  if (period === "custom" && customStart && customEnd) {
    const s = new Date(customStart + "T00:00:00");
    const e = new Date(customEnd + "T23:59:59.999");
    return { start: s, end: e, label: `${formatDateBR(s)} a ${formatDateBR(e)}` };
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case "mes_anterior": {
      const s = new Date(year, month - 1, 1);
      const e = new Date(year, month, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: s.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) };
    }
    case "ultimos_3_meses": {
      const s = new Date(year, month - 2, 1);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: "Últimos 3 meses" };
    }
    case "ultimos_6_meses": {
      const s = new Date(year, month - 5, 1);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: "Últimos 6 meses" };
    }
    case "ano_atual": {
      const s = new Date(year, 0, 1);
      const e = new Date(year, 11, 31, 23, 59, 59, 999);
      return { start: s, end: e, label: `Ano ${year}` };
    }
    default: {
      const s = new Date(year, month, 1);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: s.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) };
    }
  }
}

const CLASS_COLORS = { A: "#22c55e", B: "#eab308", C: "#ef4444" };
const CLASS_BG = { A: "bg-green-100 text-green-800", B: "bg-yellow-100 text-yellow-800", C: "bg-red-100 text-red-800" };

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return v.toFixed(2) + "%";
}

function CurvaAbcContent() {
  const [period, setPeriod] = useState<PeriodType>("ano_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("financeiro");
  const [dataSection, setDataSection] = useState<DataSection>("vendas");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { start, end, label: periodLabel } = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const { data: vendasData, isLoading: loadingVendas } = trpc.reports.curvaAbcVendas.useQuery(
    { startDate: start, endDate: end },
    { enabled: dataSection === "vendas" }
  );

  const { data: comprasData, isLoading: loadingCompras } = trpc.reports.curvaAbcCompras.useQuery(
    { startDate: start, endDate: end },
    { enabled: dataSection === "compras" }
  );

  const { data: insumosData, isLoading: loadingInsumos } = trpc.reports.curvaAbcInsumos.useQuery(
    undefined,
    { enabled: dataSection === "insumos" }
  );

  // Normalize insumos data to match the same interface as vendas/compras
  const normalizedInsumosData = useMemo(() => {
    if (!insumosData) return undefined;
    return insumosData.map((i) => ({
      productName: i.insumoName,
      productReference: i.category || "—",
      totalQty: i.currentStock,
      totalValue: i.stockValue,
      percentValue: i.percentValue,
      percentQty: i.percentStock,
      accumValue: i.accumValue,
      accumQty: i.accumStock,
      classValue: i.classValue,
      classQty: i.classStock,
      // Extra insumo fields
      unit: i.unit,
      unitPrice: i.unitPrice,
      usedInProducts: i.usedInProducts,
    }));
  }, [insumosData]);

  const rawData = dataSection === "vendas" ? vendasData : dataSection === "compras" ? comprasData : normalizedInsumosData;
  const isLoading = dataSection === "vendas" ? loadingVendas : dataSection === "compras" ? loadingCompras : loadingInsumos;

  // Filter and sort
  const filteredData = useMemo(() => {
    if (!rawData) return [];
    let items = [...rawData];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          (i.productReference && i.productReference.toLowerCase().includes(q))
      );
    }

    if (classFilter !== "all") {
      items = items.filter((i) =>
        viewMode === "financeiro" ? i.classValue === classFilter : i.classQty === classFilter
      );
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.productName.localeCompare(b.productName);
          break;
        case "qty":
          cmp = a.totalQty - b.totalQty;
          break;
        case "value":
          cmp = a.totalValue - b.totalValue;
          break;
        case "percent":
          cmp = viewMode === "financeiro" ? a.percentValue - b.percentValue : a.percentQty - b.percentQty;
          break;
        case "accum":
          cmp = viewMode === "financeiro" ? a.accumValue - b.accumValue : a.accumQty - b.accumQty;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [rawData, search, classFilter, sortField, sortDir, viewMode]);

  // Summary stats
  const summary = useMemo(() => {
    if (!rawData || rawData.length === 0) return null;
    const countA = rawData.filter((i) => (viewMode === "financeiro" ? i.classValue : i.classQty) === "A").length;
    const countB = rawData.filter((i) => (viewMode === "financeiro" ? i.classValue : i.classQty) === "B").length;
    const countC = rawData.filter((i) => (viewMode === "financeiro" ? i.classValue : i.classQty) === "C").length;
    const totalValue = rawData.reduce((s, i) => s + i.totalValue, 0);
    const totalQty = rawData.reduce((s, i) => s + i.totalQty, 0);
    const valueA = rawData.filter((i) => i.classValue === "A").reduce((s, i) => s + i.totalValue, 0);
    const valueB = rawData.filter((i) => i.classValue === "B").reduce((s, i) => s + i.totalValue, 0);
    const valueC = rawData.filter((i) => i.classValue === "C").reduce((s, i) => s + i.totalValue, 0);
    return { countA, countB, countC, totalValue, totalQty, valueA, valueB, valueC, total: rawData.length };
  }, [rawData, viewMode]);

  // Pareto chart data (top 30 items for readability)
  const paretoData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const sorted = viewMode === "financeiro"
      ? [...rawData].sort((a, b) => b.totalValue - a.totalValue)
      : [...rawData].sort((a, b) => b.totalQty - a.totalQty);
    return sorted.slice(0, 30).map((item, idx) => {
      const accum = viewMode === "financeiro" ? item.accumValue : item.accumQty;
      const cls = viewMode === "financeiro" ? item.classValue : item.classQty;
      return {
        name: item.productName.length > 20 ? item.productName.substring(0, 20) + "…" : item.productName,
        fullName: item.productName,
        value: viewMode === "financeiro" ? item.totalValue : item.totalQty,
        accum: accum,
        class: cls,
        idx: idx + 1,
      };
    });
  }, [rawData, viewMode]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`inline ml-1 h-3 w-3 cursor-pointer ${sortField === field ? "text-blue-600" : "text-gray-400"}`}
    />
  );

  const sectionLabel = dataSection === "vendas" ? "Vendas" : dataSection === "compras" ? "Compras" : "Insumos";
  const itemLabel = dataSection === "insumos" ? "insumos" : "materiais";
  const qtyLabel = dataSection === "insumos" ? "Estoque" : "Qtd";
  const valueLabel = dataSection === "insumos" ? "Valor em Estoque" : "Valor (R$)";

  const handleExportPDF = useCallback(() => {
    exportCurvaAbcPDF(filteredData, summary, {
      sectionLabel, itemLabel, qtyLabel, valueLabel, viewMode, periodLabel, dataSection,
    });
    toast.success("PDF da Curva ABC gerado! Use Ctrl+P para salvar.");
  }, [filteredData, summary, sectionLabel, itemLabel, qtyLabel, valueLabel, viewMode, periodLabel, dataSection]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Curva ABC — {sectionLabel}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Classificação por participação acumulada
            {dataSection !== "insumos" && <> — {periodLabel}</>}
            {dataSection === "insumos" && <> — Estoque atual de insumos</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={!filteredData || filteredData.length === 0}
            className="gap-1.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
          <Tabs value={dataSection} onValueChange={(v) => { setDataSection(v as DataSection); setSearch(""); setClassFilter("all"); }}>
            <TabsList>
              <TabsTrigger value="vendas" className="gap-1">
                <ShoppingCart className="h-3.5 w-3.5" /> Vendas
              </TabsTrigger>
              <TabsTrigger value="compras" className="gap-1">
                <Truck className="h-3.5 w-3.5" /> Compras
              </TabsTrigger>
              <TabsTrigger value="insumos" className="gap-1">
                <Boxes className="h-3.5 w-3.5" /> Insumos
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="financeiro" className="gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Financeiro
              </TabsTrigger>
              <TabsTrigger value="quantidade" className="gap-1">
                <Package className="h-3.5 w-3.5" /> {dataSection === "insumos" ? "Estoque" : "Quantidade"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            {dataSection !== "insumos" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Período</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mes_atual">Mês Atual</SelectItem>
                      <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                      <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                      <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
                      <SelectItem value="ano_atual">Ano Atual</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {period === "custom" && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-9 w-[150px]" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                      <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-9 w-[150px]" />
                    </div>
                  </>
                )}
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Classe</Label>
              <Select value={classFilter} onValueChange={(v) => setClassFilter(v as any)}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="A">Classe A</SelectItem>
                  <SelectItem value="B">Classe B</SelectItem>
                  <SelectItem value="C">Classe C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                {dataSection === "insumos" ? "Buscar insumo" : "Buscar material"}
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={dataSection === "insumos" ? "Nome ou categoria..." : "Nome ou referência..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !summary ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>
              {dataSection === "insumos"
                ? "Nenhum insumo cadastrado. Cadastre insumos na página de Insumos."
                : "Nenhum dado encontrado para o período selecionado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Classe A</p>
                    <p className="text-2xl font-bold text-green-700">{summary.countA}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtPct((summary.countA / summary.total) * 100)} dos itens
                    </p>
                    <p className="text-xs font-medium text-green-600 mt-1">
                      {fmtBRL(summary.valueA)} ({fmtPct(summary.totalValue > 0 ? (summary.valueA / summary.totalValue) * 100 : 0)})
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Classe B</p>
                    <p className="text-2xl font-bold text-yellow-700">{summary.countB}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtPct((summary.countB / summary.total) * 100)} dos itens
                    </p>
                    <p className="text-xs font-medium text-yellow-600 mt-1">
                      {fmtBRL(summary.valueB)} ({fmtPct(summary.totalValue > 0 ? (summary.valueB / summary.totalValue) * 100 : 0)})
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Classe C</p>
                    <p className="text-2xl font-bold text-red-700">{summary.countC}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtPct((summary.countC / summary.total) * 100)} dos itens
                    </p>
                    <p className="text-xs font-medium text-red-600 mt-1">
                      {fmtBRL(summary.valueC)} ({fmtPct(summary.totalValue > 0 ? (summary.valueC / summary.totalValue) * 100 : 0)})
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Total Geral</p>
                    <p className="text-2xl font-bold text-blue-700">{summary.total}</p>
                    <p className="text-xs text-muted-foreground">{itemLabel}</p>
                    <p className="text-xs font-medium text-blue-600 mt-1">
                      {fmtBRL(summary.totalValue)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pareto Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Gráfico de Pareto — {valueLabel} — Top {Math.min(30, paretoData.length)} {itemLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paretoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={paretoData} margin={{ top: 10, right: 30, left: 10, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        viewMode === "financeiro"
                          ? v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                          : fmtNum(v)
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
                            <p className="font-semibold mb-1">{d?.fullName}</p>
                            <p>
                              {viewMode === "financeiro" ? "Valor" : qtyLabel}: <strong>
                                {viewMode === "financeiro" ? fmtBRL(d?.value || 0) : fmtNum(d?.value || 0)}
                              </strong>
                            </p>
                            <p>% Acumulado: <strong>{fmtPct(d?.accum || 0)}</strong></p>
                            <p>Classe: <Badge className={CLASS_BG[d?.class as keyof typeof CLASS_BG]}>{d?.class}</Badge></p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="value"
                      name={viewMode === "financeiro" ? valueLabel : qtyLabel}
                      radius={[4, 4, 0, 0]}
                    >
                      {paretoData.map((entry, index) => (
                        <Cell key={index} fill={CLASS_COLORS[entry.class as keyof typeof CLASS_COLORS]} />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="accum"
                      name="% Acumulado"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#3b82f6" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados para exibir</p>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Detalhamento — {filteredData.length} {itemLabel}
                  {classFilter !== "all" && <Badge className={`ml-2 ${CLASS_BG[classFilter]}`}>Classe {classFilter}</Badge>}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th
                        className="text-left py-2 px-3 font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => toggleSort("name")}
                      >
                        {dataSection === "insumos" ? "Insumo" : "Material"} <SortIcon field="name" />
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        {dataSection === "insumos" ? "Categoria" : "Referência"}
                      </th>
                      {dataSection === "insumos" && (
                        <>
                          <th className="text-center py-2 px-3 font-medium">Unidade</th>
                          <th className="text-right py-2 px-3 font-medium">Preço Unit.</th>
                          <th className="text-center py-2 px-3 font-medium">Usado em</th>
                        </>
                      )}
                      <th
                        className="text-right py-2 px-3 font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => toggleSort("qty")}
                      >
                        {qtyLabel} <SortIcon field="qty" />
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => toggleSort("value")}
                      >
                        {dataSection === "insumos" ? "Valor Estoque" : "Valor"} <SortIcon field="value" />
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => toggleSort("percent")}
                      >
                        % Part. <SortIcon field="percent" />
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => toggleSort("accum")}
                      >
                        % Acum. <SortIcon field="accum" />
                      </th>
                      <th className="text-center py-2 px-3 font-medium">Classe R$</th>
                      <th className="text-center py-2 px-3 font-medium">
                        {dataSection === "insumos" ? "Classe Est." : "Classe Qtd"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium max-w-[250px] truncate" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {item.productReference || "—"}
                        </td>
                        {dataSection === "insumos" && (
                          <>
                            <td className="py-2 px-3 text-center text-xs">{item.unit}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtBRL(item.unitPrice || 0)}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant="outline" className="text-xs">
                                {item.usedInProducts || 0} prod.
                              </Badge>
                            </td>
                          </>
                        )}
                        <td className="py-2 px-3 text-right tabular-nums">{fmtNum(item.totalQty)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">{fmtBRL(item.totalValue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {viewMode === "financeiro" ? fmtPct(item.percentValue) : fmtPct(item.percentQty)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {viewMode === "financeiro" ? fmtPct(item.accumValue) : fmtPct(item.accumQty)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge className={`text-xs ${CLASS_BG[item.classValue as keyof typeof CLASS_BG]}`}>{item.classValue}</Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge className={`text-xs ${CLASS_BG[item.classQty as keyof typeof CLASS_BG]}`}>{item.classQty}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={dataSection === "insumos" ? 12 : 9} className="py-8 text-center text-muted-foreground">
                          Nenhum {dataSection === "insumos" ? "insumo" : "material"} encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredData.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="py-2 px-3" colSpan={dataSection === "insumos" ? 6 : 3}>TOTAL</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtNum(filteredData.reduce((s: number, i: any) => s + i.totalQty, 0))}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtBRL(filteredData.reduce((s: number, i: any) => s + i.totalValue, 0))}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtPct(filteredData.reduce((s: number, i: any) => s + (viewMode === "financeiro" ? i.percentValue : i.percentQty), 0))}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span><strong>Classe A</strong> — até 80% acumulado (itens de maior impacto)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span><strong>Classe B</strong> — 80% a 95% acumulado (impacto intermediário)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span><strong>Classe C</strong> — 95% a 100% acumulado (menor impacto individual)</span>
                </div>
              </div>
              {dataSection === "insumos" && (
                <p className="text-xs text-muted-foreground mt-3">
                  A classificação de insumos considera o <strong>valor em estoque</strong> (preço unitário × quantidade em estoque) para a visão financeira,
                  e a <strong>quantidade em estoque</strong> para a visão por estoque. A coluna "Usado em" indica em quantos produtos o insumo é utilizado na ficha técnica.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663173005738/hPrFgGbhTTKiLvuW.jpeg";

function exportCurvaAbcPDF(
  data: any[],
  summary: any,
  opts: {
    sectionLabel: string;
    itemLabel: string;
    qtyLabel: string;
    valueLabel: string;
    viewMode: string;
    periodLabel: string;
    dataSection: string;
  }
) {
  if (!data || data.length === 0 || !summary) return;

  const classColors: Record<string, string> = { A: "#059669", B: "#d97706", C: "#dc2626" };
  const classBg: Record<string, string> = { A: "#dcfce7", B: "#fef9c3", C: "#fee2e2" };

  const rows = data.map((item: any, idx: number) => {
    const cls = opts.viewMode === "financeiro" ? item.classValue : item.classQty;
    const pct = opts.viewMode === "financeiro" ? item.percentValue : item.percentQty;
    const acc = opts.viewMode === "financeiro" ? item.accumValue : item.accumQty;
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:10px;">${idx + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.productName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#6b7280;">${item.productReference || "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;">${fmtNum(item.totalQty)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;">${fmtBRL(item.totalValue)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;">${fmtPct(pct)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;">${fmtPct(acc)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:${classColors[cls] || '#333'};background:${classBg[cls] || '#f3f4f6'};">${cls}</span>
        </td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Curva ABC — ${opts.sectionLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #333; font-size: 12px; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
    .header img { height: 50px; width: 50px; border-radius: 8px; object-fit: cover; }
    .header-text h1 { color: #1e40af; margin: 0; font-size: 20px; }
    .header-text p { color: #666; margin: 3px 0 0; font-size: 12px; }
    .period { background: #f0f4ff; padding: 8px 14px; border-radius: 6px; margin-bottom: 16px; text-align: center; font-size: 12px; }
    .cards { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .card { flex: 1; min-width: 120px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .card .label { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .card .value { font-size: 20px; font-weight: bold; margin-top: 2px; }
    .card .sub { font-size: 9px; color: #64748b; margin-top: 2px; }
    .card-a { border-left: 4px solid #22c55e; }
    .card-b { border-left: 4px solid #eab308; }
    .card-c { border-left: 4px solid #ef4444; }
    .card-total { border-left: 4px solid #3b82f6; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1e40af; color: white; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    th.right { text-align: right; }
    th.center { text-align: center; }
    .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .legend { display: flex; gap: 20px; margin-top: 16px; font-size: 10px; align-items: center; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 3px; }
    @media print { body { margin: 15px; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${LOGO_URL}" alt="Lustra Mil" />
    <div class="header-text">
      <h1>Lustra Mil — Curva ABC ${opts.sectionLabel}</h1>
      <p>Classificação por participação acumulada — Visão ${opts.viewMode === "financeiro" ? "Financeira (R$)" : opts.dataSection === "insumos" ? "Estoque" : "Quantidade"}</p>
    </div>
  </div>

  <div class="period">
    <strong>${opts.dataSection === "insumos" ? "Estoque atual de insumos" : `Período: ${opts.periodLabel}`}</strong>
  </div>

  <div class="cards">
    <div class="card card-a">
      <div class="label">Classe A</div>
      <div class="value" style="color:#059669;">${summary.countA}</div>
      <div class="sub">${fmtPct((summary.countA / summary.total) * 100)} dos itens</div>
      <div class="sub" style="font-weight:600;color:#059669;">${fmtBRL(summary.valueA)}</div>
    </div>
    <div class="card card-b">
      <div class="label">Classe B</div>
      <div class="value" style="color:#d97706;">${summary.countB}</div>
      <div class="sub">${fmtPct((summary.countB / summary.total) * 100)} dos itens</div>
      <div class="sub" style="font-weight:600;color:#d97706;">${fmtBRL(summary.valueB)}</div>
    </div>
    <div class="card card-c">
      <div class="label">Classe C</div>
      <div class="value" style="color:#dc2626;">${summary.countC}</div>
      <div class="sub">${fmtPct((summary.countC / summary.total) * 100)} dos itens</div>
      <div class="sub" style="font-weight:600;color:#dc2626;">${fmtBRL(summary.valueC)}</div>
    </div>
    <div class="card card-total">
      <div class="label">Total Geral</div>
      <div class="value" style="color:#1e40af;">${summary.total}</div>
      <div class="sub">${opts.itemLabel}</div>
      <div class="sub" style="font-weight:600;color:#1e40af;">${fmtBRL(summary.totalValue)}</div>
    </div>
  </div>

  <h3 style="color:#1e40af;font-size:13px;margin-bottom:4px;">Detalhamento — ${data.length} ${opts.itemLabel}</h3>
  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th>${opts.dataSection === "insumos" ? "Insumo" : "Material"}</th>
        <th>${opts.dataSection === "insumos" ? "Categoria" : "Referência"}</th>
        <th class="right">${opts.qtyLabel}</th>
        <th class="right">${opts.valueLabel}</th>
        <th class="right">% Part.</th>
        <th class="right">% Acum.</th>
        <th class="center">Classe</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="font-weight:bold;background:#f0f4ff;">
        <td colspan="3" style="padding:8px;">TOTAL</td>
        <td style="padding:8px;text-align:right;">${fmtNum(data.reduce((s: number, i: any) => s + i.totalQty, 0))}</td>
        <td style="padding:8px;text-align:right;">${fmtBRL(data.reduce((s: number, i: any) => s + i.totalValue, 0))}</td>
        <td style="padding:8px;text-align:right;">${fmtPct(data.reduce((s: number, i: any) => s + (opts.viewMode === "financeiro" ? i.percentValue : i.percentQty), 0))}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#22c55e;"></div> <strong>A</strong> — até 80%</div>
    <div class="legend-item"><div class="legend-dot" style="background:#eab308;"></div> <strong>B</strong> — 80% a 95%</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444;"></div> <strong>C</strong> — 95% a 100%</div>
  </div>

  <div class="footer">
    Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} — Lustra Mil Produtos de Limpeza
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 600);
  }
}
