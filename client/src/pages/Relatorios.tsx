import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBR, formatMonthName } from "../../../shared/dateUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  CalendarRange,
  Hash,
  Boxes,
  ShoppingCart,
  Truck,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Copy,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { TabsContent } from "@/components/ui/tabs";
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

export default function RelatoriosPage() {
  return (
    <DashboardLayout>
      <RelatoriosContent />
    </DashboardLayout>
  );
}

type PeriodType = "mes_atual" | "mes_anterior" | "ultimos_3_meses" | "ultimos_6_meses" | "ano_atual" | "custom";
type ViewMode = "financeiro" | "quantidade";

function getDateRange(period: PeriodType, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  if (period === "custom" && customStart && customEnd) {
    const s = new Date(customStart + "T00:00:00");
    const e = new Date(customEnd + "T23:59:59.999");
    return { start: s, end: e, label: `${formatDateBR(s)} a ${formatDateBR(e)}` };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "mes_atual": {
      const s = new Date(year, month, 1, 0, 0, 0, 0);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: formatMonthName(s) };
    }
    case "mes_anterior": {
      const s = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const e = new Date(year, month, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: formatMonthName(s) };
    }
    case "ultimos_3_meses": {
      const s = new Date(year, month - 2, 1, 0, 0, 0, 0);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: "Últimos 3 Meses" };
    }
    case "ultimos_6_meses": {
      const s = new Date(year, month - 5, 1, 0, 0, 0, 0);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: "Últimos 6 Meses" };
    }
    case "ano_atual": {
      const s = new Date(year, 0, 1, 0, 0, 0, 0);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: `Ano ${year}` };
    }
    default: {
      const s = new Date(year, month, 1, 0, 0, 0, 0);
      const e = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: "Mês Atual" };
    }
  }
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function RelatoriosContent() {
  const [period, setPeriod] = useState<PeriodType>("mes_atual");
  const [viewMode, setViewMode] = useState<ViewMode>("financeiro");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatDateInput(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatDateInput(new Date()));
  const [referenceFilter, setReferenceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { start, end, label: periodLabel } = useMemo(
    () => getDateRange(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  const { data: products } = trpc.products.list.useQuery();
  const { data: entities = [] } = trpc.entities.list.useQuery();
  const { data: movements, isLoading: movementsLoading } = trpc.reports.movements.useQuery({
    startDate: start,
    endDate: end,
    ...(selectedProductId !== "all" ? { productId: parseInt(selectedProductId) } : {}),
    ...(selectedEntityId !== "all" ? { entityId: parseInt(selectedEntityId) } : {}),
  });
  const { data: revenue, isLoading: revenueLoading } = trpc.reports.revenue.useQuery({
    startDate: start,
    endDate: end,
  });

  // Aggregate data for financial chart
  const financialChartData = useMemo(() => {
    if (!revenue) return [];
    const grouped: Record<string, { date: string; entradas: number; saidas: number }> = {};
    revenue.forEach((r) => {
      const dateStr = typeof r.date === "string" ? r.date : new Date(r.date).toISOString().split("T")[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = { date: dateStr, entradas: 0, saidas: 0 };
      }
      if (r.type === "entrada") {
        grouped[dateStr].entradas = Number(r.total);
      } else {
        grouped[dateStr].saidas = Number(r.total);
      }
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      ...d,
      dateLabel: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    }));
  }, [revenue]);

  // Aggregate data for quantity chart
  const quantityChartData = useMemo(() => {
    if (!movements) return [];
    const grouped: Record<string, { date: string; entradas: number; saidas: number }> = {};
    movements.forEach((m) => {
      const dt = new Date(m.movementDate || m.createdAt);
      const dateStr = dt.toISOString().split("T")[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = { date: dateStr, entradas: 0, saidas: 0 };
      }
      const qty = parseFloat(String(m.quantity));
      if (m.type === "entrada") {
        grouped[dateStr].entradas += qty;
      } else {
        grouped[dateStr].saidas += qty;
      }
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      ...d,
      dateLabel: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" }),
    }));
  }, [movements]);

  // Apply client-side filters (type and reference)
  const filteredMovements = useMemo(() => {
    if (!movements) return [];
    let result = [...movements];
    if (typeFilter !== "all") {
      result = result.filter((m) => m.type === typeFilter);
    }
    if (referenceFilter.trim()) {
      const q = referenceFilter.toLowerCase();
      result = result.filter((m) =>
        (m.productName && m.productName.toLowerCase().includes(q)) ||
        ((m as any).reference && String((m as any).reference).toLowerCase().includes(q))
      );
    }
    return result;
  }, [movements, typeFilter, referenceFilter]);

  // Summary stats
  const summary = useMemo(() => {
    if (!filteredMovements || filteredMovements.length === 0) return { totalEntradas: 0, totalSaidas: 0, totalValueIn: 0, totalValueOut: 0, productCount: 0 };
    const productSet = new Set<number>();
    let totalEntradas = 0, totalSaidas = 0, totalValueIn = 0, totalValueOut = 0;
    filteredMovements.forEach((m) => {
      if (m.productId) productSet.add(m.productId);
      const qty = parseFloat(String(m.quantity));
      const val = parseFloat(String(m.totalPrice || 0));
      if (m.type === "entrada") {
        totalEntradas += qty;
        totalValueIn += val;
      } else {
        totalSaidas += qty;
        totalValueOut += val;
      }
    });
    return { totalEntradas, totalSaidas, totalValueIn, totalValueOut, productCount: productSet.size };
  }, [filteredMovements]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Product distribution for pie chart (quantity)
  const productDistributionQty = useMemo(() => {
    if (!filteredMovements || filteredMovements.length === 0) return [];
    const map: Record<string, number> = {};
    filteredMovements.forEach((m) => {
      const name = m.productName || "Desconhecido";
      map[name] = (map[name] || 0) + parseFloat(String(m.quantity));
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredMovements]);

  // Product distribution for pie chart (financial)
  const productDistributionValue = useMemo(() => {
    if (!filteredMovements || filteredMovements.length === 0) return [];
    const map: Record<string, number> = {};
    filteredMovements.forEach((m) => {
      const name = m.productName || "Desconhecido";
      map[name] = (map[name] || 0) + parseFloat(String(m.totalPrice || 0));
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredMovements]);

  const productDistribution = viewMode === "financeiro" ? productDistributionValue : productDistributionQty;

  const COLORS = [
    "oklch(0.55 0.18 250)",
    "oklch(0.65 0.15 160)",
    "oklch(0.70 0.15 80)",
    "oklch(0.60 0.20 300)",
    "oklch(0.55 0.15 30)",
    "oklch(0.50 0.18 200)",
    "oklch(0.60 0.12 120)",
    "oklch(0.65 0.18 340)",
  ];

  // ─── Material Summary (consolidated by product) ───
  const materialSummary = useMemo(() => {
    if (!filteredMovements || filteredMovements.length === 0) return [];
    const map: Record<string, { name: string; reference: string; cfop: string; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number; totalMovements: number; entities: Set<string> }> = {};
    filteredMovements.forEach((m) => {
      const name = m.productName || "Desconhecido";
      if (!map[name]) {
        map[name] = { name, reference: "", cfop: "", qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0, totalMovements: 0, entities: new Set() };
      }
      // Guardar referência e CFOP (pegar do primeiro registro que tiver)
      if ((m as any).reference && !map[name].reference) map[name].reference = (m as any).reference;
      if ((m as any).cfop && !map[name].cfop) map[name].cfop = (m as any).cfop;
      if ((m as any).entityName) map[name].entities.add((m as any).entityName);
      const qty = parseFloat(String(m.quantity));
      const val = parseFloat(String(m.totalPrice || 0));
      map[name].totalMovements += 1;
      if (m.type === "entrada") {
        map[name].qtyIn += qty;
        map[name].valueIn += val;
      } else {
        map[name].qtyOut += qty;
        map[name].valueOut += val;
      }
    });
    return Object.values(map).sort((a, b) => {
      const aTotal = a.valueIn + a.valueOut;
      const bTotal = b.valueIn + b.valueOut;
      return bTotal - aTotal;
    });
  }, [filteredMovements]);

  const periodLabels: Record<PeriodType, string> = {
    mes_atual: "Mês Atual",
    mes_anterior: "Mês Anterior",
    ultimos_3_meses: "Últimos 3 Meses",
    ultimos_6_meses: "Últimos 6 Meses",
    ano_atual: "Ano Atual",
    custom: `${formatDateBR(new Date(customStartDate + "T12:00:00"))} — ${formatDateBR(new Date(customEndDate + "T12:00:00"))}`,
  };

  const chartData = viewMode === "financeiro" ? financialChartData : quantityChartData;

  // ─── Monthly Comparison ───────────────────
  const { data: comparison, isLoading: comparisonLoading } = trpc.reports.monthlyComparison.useQuery();

  const comparisonChartData = useMemo(() => {
    if (!comparison) return [];
    const maxDays = 31;
    const result: { day: string; mesAtual: number; mesAnterior: number }[] = [];
    const currentMap: Record<number, number> = {};
    const previousMap: Record<number, number> = {};
    comparison.dailyCurrent.forEach((d) => {
      currentMap[d.day] = d.valueOut + d.valueIn; // faturamento total
    });
    comparison.dailyPrevious.forEach((d) => {
      previousMap[d.day] = d.valueOut + d.valueIn;
    });
    for (let i = 1; i <= maxDays; i++) {
      if (currentMap[i] !== undefined || previousMap[i] !== undefined) {
        result.push({
          day: String(i).padStart(2, "0"),
          mesAtual: currentMap[i] || 0,
          mesAnterior: previousMap[i] || 0,
        });
      }
    }
    return result;
  }, [comparison]);

  const comparisonSalesChartData = useMemo(() => {
    if (!comparison) return [];
    const maxDays = 31;
    const result: { day: string; vendasAtual: number; vendasAnterior: number }[] = [];
    const currentMap: Record<number, number> = {};
    const previousMap: Record<number, number> = {};
    comparison.dailyCurrent.forEach((d) => {
      currentMap[d.day] = d.valueOut;
    });
    comparison.dailyPrevious.forEach((d) => {
      previousMap[d.day] = d.valueOut;
    });
    for (let i = 1; i <= maxDays; i++) {
      if (currentMap[i] !== undefined || previousMap[i] !== undefined) {
        result.push({
          day: String(i).padStart(2, "0"),
          vendasAtual: currentMap[i] || 0,
          vendasAnterior: previousMap[i] || 0,
        });
      }
    }
    return result;
  }, [comparison]);

  const comparisonVariation = useMemo(() => {
    if (!comparison) return { revenue: 0, sales: 0, purchases: 0 };
    const curTotal = comparison.currentMonth.valueIn + comparison.currentMonth.valueOut;
    const prevTotal = comparison.previousMonth.valueIn + comparison.previousMonth.valueOut;
    const revenue = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : curTotal > 0 ? 100 : 0;
    const sales = comparison.previousMonth.valueOut > 0
      ? ((comparison.currentMonth.valueOut - comparison.previousMonth.valueOut) / comparison.previousMonth.valueOut) * 100
      : comparison.currentMonth.valueOut > 0 ? 100 : 0;
    const purchases = comparison.previousMonth.valueIn > 0
      ? ((comparison.currentMonth.valueIn - comparison.previousMonth.valueIn) / comparison.previousMonth.valueIn) * 100
      : comparison.currentMonth.valueIn > 0 ? 100 : 0;
    return { revenue, sales, purchases };
  }, [comparison]);

  // ─── Export Mutations ──────────────────────
  const exportExcelMutation = trpc.reports.exportExcel.useMutation();
  const exportPDFMutation = trpc.reports.exportPDF.useMutation();
  const exportEntityGroupMutation = trpc.reports.exportEntityGroupExcel.useMutation();
  const exportMaterialGroupMutation = trpc.reports.exportMaterialGroupExcel.useMutation();

  const downloadBase64File = useCallback((base64: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      toast.info("Gerando Excel... Aguarde.");
      const result = await exportExcelMutation.mutateAsync({
        startDate: start,
        endDate: end,
        viewMode,
        ...(selectedProductId !== "all" ? { productId: parseInt(selectedProductId) } : {}),
        ...(selectedEntityId !== "all" ? { entityId: parseInt(selectedEntityId) } : {}),
      });
      downloadBase64File(result.base64, result.filename, result.mimeType);
      toast.success(`Excel exportado! Arquivo ${result.filename} baixado.`);
    } catch (error) {
      toast.error("N\u00e3o foi poss\u00edvel gerar o arquivo Excel.");
    }
  }, [start, end, viewMode, selectedProductId, selectedEntityId, exportExcelMutation, downloadBase64File]);

  const handleExportPDF = useCallback(async () => {
    try {
      toast.info("Gerando PDF... Aguarde.");
      const result = await exportPDFMutation.mutateAsync({
        startDate: start,
        endDate: end,
        viewMode,
        ...(selectedProductId !== "all" ? { productId: parseInt(selectedProductId) } : {}),
        ...(selectedEntityId !== "all" ? { entityId: parseInt(selectedEntityId) } : {}),
      });
      downloadBase64File(result.base64, result.filename, result.mimeType);
      toast.success(`PDF exportado! Arquivo ${result.filename} baixado.`);
    } catch (error) {
      toast.error("N\u00e3o foi poss\u00edvel gerar o arquivo PDF.");
    }
  }, [start, end, viewMode, selectedProductId, selectedEntityId, exportPDFMutation, downloadBase64File]);

  const isExporting = exportExcelMutation.isPending || exportPDFMutation.isPending || exportEntityGroupMutation.isPending || exportMaterialGroupMutation.isPending;

  const handleExportEntityGroup = useCallback(async () => {
    try {
      toast.info("Gerando Excel Por Fornecedor... Aguarde.");
      const result = await exportEntityGroupMutation.mutateAsync({
        startDate: start,
        endDate: end,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      downloadBase64File(result.data, result.filename, result.mimeType);
      toast.success("Excel Por Fornecedor exportado!");
    } catch (error) {
      toast.error("Não foi possível gerar o arquivo.");
    }
  }, [start, end, typeFilter, exportEntityGroupMutation, downloadBase64File]);

  const handleExportMaterialGroup = useCallback(async () => {
    try {
      toast.info("Gerando Excel Por Material... Aguarde.");
      const result = await exportMaterialGroupMutation.mutateAsync({
        startDate: start,
        endDate: end,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      downloadBase64File(result.data, result.filename, result.mimeType);
      toast.success("Excel Por Material exportado!");
    } catch (error) {
      toast.error("Não foi possível gerar o arquivo.");
    }
  }, [start, end, typeFilter, exportMaterialGroupMutation, downloadBase64File]);

  const handleCopyResumo = useCallback(async () => {
    const fmt = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    const entradas = summary.totalValueOut; // vendas = entradas de caixa
    const saidas = summary.totalValueIn;    // compras = saídas de caixa
    const resultado = entradas - saidas;
    const text =
      `Lustra Mil - Resumo ${periodLabel}\n` +
      `Entradas ${fmt(entradas)} | Saídas ${fmt(saidas)} | Resultado ${fmt(resultado)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumo copiado! Cole no WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, [summary.totalValueIn, summary.totalValueOut, periodLabel]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Análise detalhada das movimentações do estoque
            </p>
          </div>

          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="grid grid-cols-2 w-[280px]">
              <TabsTrigger value="financeiro" className="gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Financeiro (R$)
              </TabsTrigger>
              <TabsTrigger value="quantidade" className="gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                Quantidade
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters Bar */}
        <Card className="border-primary/10 bg-primary/[0.02]">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              {/* Period Selector */}
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <CalendarRange className="h-3 w-3 inline mr-1" />
                  Período
                </Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes_atual">Mês Atual</SelectItem>
                    <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                    <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                    <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
                    <SelectItem value="ano_atual">Ano Atual</SelectItem>
                    <SelectItem value="custom">Período Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {period === "custom" && (
                <>
                  <div className="min-w-[150px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Data Início</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="min-w-[150px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Data Fim</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </>
              )}

              {/* Product Filter */}
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <Package className="h-3 w-3 inline mr-1" />
                  Produto
                </Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fornecedor / Cliente Filter */}
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <ShoppingCart className="h-3 w-3 inline mr-1" />
                  Fornecedor / Cliente
                </Label>
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {entities.map((e: { id: number; name: string; type: string }) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name} ({e.type === "fornecedor" ? "forn." : "cliente"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second row of filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mt-3 pt-3 border-t border-border/50">
              {/* Type Filter */}
              <div className="min-w-[160px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <Filter className="h-3 w-3 inline mr-1" />
                  Tipo
                </Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos (Compras + Vendas)</SelectItem>
                    <SelectItem value="entrada">Compras (Entradas)</SelectItem>
                    <SelectItem value="saida">Vendas (Saídas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reference Search */}
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <Hash className="h-3 w-3 inline mr-1" />
                  Buscar por Referência / Material
                </Label>
                <Input
                  placeholder="Ex: REF001, nome do produto..."
                  value={referenceFilter}
                  onChange={(e) => setReferenceFilter(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Export Buttons + Active Filters Info */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Por data da nota: <span className="font-semibold text-foreground">{periodLabel}</span>
                {" "}({formatDateBR(start)} — {formatDateBR(end)})
                {selectedProductId !== "all" && (
                  <>
                    {" "}produto:{" "}
                    <span className="font-medium text-foreground">
                      {products?.find(p => String(p.id) === selectedProductId)?.name || "produto selecionado"}
                    </span>
                  </>
                )}
                {selectedEntityId !== "all" && (
                  <>
                    {" "}entidade:{" "}
                    <span className="font-medium text-foreground">
                      {entities.find((e: { id: number; name: string }) => String(e.id) === selectedEntityId)?.name || "selecionada"}
                    </span>
                  </>
                )}
                {typeFilter !== "all" && (
                  <>
                    {" "}tipo:{" "}
                    <span className="font-medium text-foreground">
                      {typeFilter === "entrada" ? "Compras" : "Vendas"}
                    </span>
                  </>
                )}
                {referenceFilter && (
                  <>
                    {" "}ref/material:{" "}
                    <span className="font-medium text-foreground">"{referenceFilter}"</span>
                  </>
                )}
                {" "}— Visão: <span className="font-medium text-foreground">{viewMode === "financeiro" ? "Financeira (R$)" : "Quantidade (un)"}</span>
              </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleCopyResumo}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar resumo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleExportExcel}
                  disabled={!movements || movements.length === 0 || isExporting}
                >
                  {exportExcelMutation.isPending ? (
                    <Download className="h-3.5 w-3.5 animate-bounce" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  {exportExcelMutation.isPending ? "Gerando..." : "Excel (.xlsx)"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleExportPDF}
                  disabled={!movements || movements.length === 0 || isExporting}
                >
                  {exportPDFMutation.isPending ? (
                    <Download className="h-3.5 w-3.5 animate-bounce" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {exportPDFMutation.isPending ? "Gerando..." : "PDF"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Compras */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="h-3 w-3" />
                  Compras (Entradas)
                </p>
                <div className="space-y-0.5">
                  <p className="text-2xl font-bold tracking-tight text-emerald-700">
                    {formatCurrency(summary.totalValueIn)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.totalEntradas.toFixed(0)} unidades compradas
                  </p>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-3 w-3" />
                  Vendas (Saídas)
                </p>
                <div className="space-y-0.5">
                  <p className="text-2xl font-bold tracking-tight text-orange-700">
                    {formatCurrency(summary.totalValueOut)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.totalSaidas.toFixed(0)} unidades vendidas
                  </p>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balanço */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-violet-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="h-3 w-3" />
                  Balanço do Período
                </p>
                <div className="space-y-0.5">
                  <p className={`text-2xl font-bold tracking-tight ${
                    (summary.totalValueOut - summary.totalValueIn) >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}>
                    {formatCurrency(summary.totalValueOut - summary.totalValueIn)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.productCount} produtos · {periodLabels[period]}
                  </p>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {viewMode === "financeiro" ? "Valores por Dia (R$)" : "Quantidades por Dia (un)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.005 260)" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      viewMode === "financeiro"
                        ? v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                        : `${v} un`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) =>
                      viewMode === "financeiro"
                        ? formatCurrency(value)
                        : `${value.toFixed(0)} unidades`
                    }
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar dataKey="entradas" name="Compras" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Vendas" fill="oklch(0.65 0.15 45)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sem dados para o período selecionado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {viewMode === "financeiro" ? "Valor por Produto" : "Quantidade por Produto"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={productDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {productDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      viewMode === "financeiro"
                        ? formatCurrency(value)
                        : `${value.toFixed(0)} un`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <div className="text-center">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sem dados</p>
                </div>
              </div>
            )}
            {productDistribution.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {productDistribution.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <span className="font-medium">
                      {viewMode === "financeiro" ? formatCurrency(item.value) : `${item.value.toFixed(0)} un`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Comparativo Mensal — Faturamento
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {comparison ? (
              <>
                <span className="capitalize">{comparison.currentMonthLabel}</span>
                {" vs "}
                <span className="capitalize">{comparison.previousMonthLabel}</span>
              </>
            ) : "Carregando..."}
          </p>
        </CardHeader>
        <CardContent>
          {comparisonLoading ? (
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
          ) : (
            <>
              {/* Variation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl border p-3 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Faturamento Total</span>
                    <Badge variant={comparisonVariation.revenue >= 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {comparisonVariation.revenue >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                      {comparisonVariation.revenue >= 0 ? "+" : ""}{comparisonVariation.revenue.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold">
                      {formatCurrency((comparison?.currentMonth.valueIn || 0) + (comparison?.currentMonth.valueOut || 0))}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency((comparison?.previousMonth.valueIn || 0) + (comparison?.previousMonth.valueOut || 0))}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border p-3 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Vendas (Saídas)</span>
                    <Badge variant={comparisonVariation.sales >= 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {comparisonVariation.sales >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                      {comparisonVariation.sales >= 0 ? "+" : ""}{comparisonVariation.sales.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold">
                      {formatCurrency(comparison?.currentMonth.valueOut || 0)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(comparison?.previousMonth.valueOut || 0)}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border p-3 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Compras (Entradas)</span>
                    <Badge variant={comparisonVariation.purchases >= 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {comparisonVariation.purchases >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                      {comparisonVariation.purchases >= 0 ? "+" : ""}{comparisonVariation.purchases.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold">
                      {formatCurrency(comparison?.currentMonth.valueIn || 0)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(comparison?.previousMonth.valueIn || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparison Line Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Faturamento Total por Dia</p>
                  {comparisonChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={comparisonChartData}>
                        <defs>
                          <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradPrevious" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.65 0.10 260)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="oklch(0.65 0.10 260)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.005 260)" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Dia ${label}`} />
                        <Legend />
                        <Area type="monotone" dataKey="mesAtual" name={comparison?.currentMonthLabel ? comparison.currentMonthLabel.charAt(0).toUpperCase() + comparison.currentMonthLabel.slice(1) : "Mês Atual"} stroke="oklch(0.55 0.18 250)" fill="url(#gradCurrent)" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Area type="monotone" dataKey="mesAnterior" name={comparison?.previousMonthLabel ? comparison.previousMonthLabel.charAt(0).toUpperCase() + comparison.previousMonthLabel.slice(1) : "Mês Anterior"} stroke="oklch(0.65 0.10 260)" fill="url(#gradPrevious)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Sem dados para comparação</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Vendas (Saídas) por Dia</p>
                  {comparisonSalesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={comparisonSalesChartData}>
                        <defs>
                          <linearGradient id="gradSalesCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.65 0.18 155)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="oklch(0.65 0.18 155)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradSalesPrevious" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.65 0.15 45)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="oklch(0.65 0.15 45)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.005 260)" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Dia ${label}`} />
                        <Legend />
                        <Area type="monotone" dataKey="vendasAtual" name={comparison?.currentMonthLabel ? comparison.currentMonthLabel.charAt(0).toUpperCase() + comparison.currentMonthLabel.slice(1) : "Mês Atual"} stroke="oklch(0.65 0.18 155)" fill="url(#gradSalesCurrent)" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Area type="monotone" dataKey="vendasAnterior" name={comparison?.previousMonthLabel ? comparison.previousMonthLabel.charAt(0).toUpperCase() + comparison.previousMonthLabel.slice(1) : "Mês Anterior"} stroke="oklch(0.65 0.15 45)" fill="url(#gradSalesPrevious)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Sem dados para comparação</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Consolidated by Material Table ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            {viewMode === "financeiro" ? "Somatório por Material (R$)" : "Somatório por Material (Quantidade)"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Consolidação de entradas, saídas e saldo agrupados por produto no período
          </p>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : materialSummary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground bg-muted/30">
                    <th className="text-left py-2.5 px-3 font-semibold">#</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Material / Produto</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Ref.</th>
                    <th className="text-left py-2.5 px-3 font-semibold">CFOP</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Fornecedores/Clientes</th>
                    {viewMode === "financeiro" ? (
                      <>
                        <th className="text-right py-2.5 px-3 font-semibold">Entradas (R$)</th>
                        <th className="text-right py-2.5 px-3 font-semibold">Saídas (R$)</th>
                        <th className="text-right py-2.5 px-3 font-semibold">Saldo (R$)</th>
                      </>
                    ) : (
                      <>
                        <th className="text-right py-2.5 px-3 font-semibold">Entradas (un)</th>
                        <th className="text-right py-2.5 px-3 font-semibold">Saídas (un)</th>
                        <th className="text-right py-2.5 px-3 font-semibold">Saldo (un)</th>
                      </>
                    )}
                    <th className="text-right py-2.5 px-3 font-semibold">Movim.</th>
                  </tr>
                </thead>
                <tbody>
                  {materialSummary.map((item, idx) => {
                    const saldoValue = viewMode === "financeiro"
                      ? item.valueIn - item.valueOut
                      : item.qtyIn - item.qtyOut;
                    return (
                      <tr key={item.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium">{item.name}</td>
                        <td className="py-2.5 px-3 text-xs text-blue-600">{item.reference || "—"}</td>
                        <td className="py-2.5 px-3 text-xs text-purple-600">{item.cfop || "—"}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[200px] truncate" title={Array.from(item.entities).join(', ')}>
                          {item.entities.size > 0 ? (
                            <span>{Array.from(item.entities).slice(0, 2).join(', ')}{item.entities.size > 2 ? ` +${item.entities.size - 2}` : ''}</span>
                          ) : '—'}
                        </td>
                        {viewMode === "financeiro" ? (
                          <>
                            <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">
                              {formatCurrency(item.valueIn)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-orange-700 font-mono">
                              {formatCurrency(item.valueOut)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold font-mono ${
                              saldoValue >= 0 ? "text-emerald-700" : "text-red-600"
                            }`}>
                              {formatCurrency(saldoValue)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">
                              {item.qtyIn.toFixed(2)} un
                            </td>
                            <td className="py-2.5 px-3 text-right text-orange-700 font-mono">
                              {item.qtyOut.toFixed(2)} un
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold font-mono ${
                              saldoValue >= 0 ? "text-emerald-700" : "text-red-600"
                            }`}>
                              {saldoValue.toFixed(2)} un
                            </td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {item.totalMovements}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="py-3 px-3" colSpan={5}>TOTAL ({materialSummary.length} materiais)</td>
                    {viewMode === "financeiro" ? (
                      <>
                        <td className="py-3 px-3 text-right text-emerald-700 font-mono">
                          {formatCurrency(materialSummary.reduce((s, i) => s + i.valueIn, 0))}
                        </td>
                        <td className="py-3 px-3 text-right text-orange-700 font-mono">
                          {formatCurrency(materialSummary.reduce((s, i) => s + i.valueOut, 0))}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${
                          (materialSummary.reduce((s, i) => s + i.valueIn, 0) - materialSummary.reduce((s, i) => s + i.valueOut, 0)) >= 0
                            ? "text-emerald-700" : "text-red-600"
                        }`}>
                          {formatCurrency(materialSummary.reduce((s, i) => s + i.valueIn, 0) - materialSummary.reduce((s, i) => s + i.valueOut, 0))}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-right text-emerald-700 font-mono">
                          {materialSummary.reduce((s, i) => s + i.qtyIn, 0).toFixed(2)} un
                        </td>
                        <td className="py-3 px-3 text-right text-orange-700 font-mono">
                          {materialSummary.reduce((s, i) => s + i.qtyOut, 0).toFixed(2)} un
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${
                          (materialSummary.reduce((s, i) => s + i.qtyIn, 0) - materialSummary.reduce((s, i) => s + i.qtyOut, 0)) >= 0
                            ? "text-emerald-700" : "text-red-600"
                        }`}>
                          {(materialSummary.reduce((s, i) => s + i.qtyIn, 0) - materialSummary.reduce((s, i) => s + i.qtyOut, 0)).toFixed(2)} un
                        </td>
                      </>
                    )}
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {materialSummary.reduce((s, i) => s + i.totalMovements, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Boxes className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma movimentação no período</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movements Detail Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Detalhamento de Movimentações
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Todas as movimentações individuais no período
          </p>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredMovements && filteredMovements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Produto</th>
                    <th className="text-left py-2 px-3 font-medium">Ref.</th>
                    <th className="text-left py-2 px-3 font-medium">Fornecedor/Cliente</th>
                    <th className="text-left py-2 px-3 font-medium">CNPJ</th>
                    <th className="text-left py-2 px-3 font-medium">CFOP</th>
                    <th className="text-left py-2 px-3 font-medium">Tipo</th>
                    <th className="text-right py-2 px-3 font-medium">Qtd</th>
                    <th className="text-right py-2 px-3 font-medium">Valor Unit.</th>
                    <th className="text-right py-2 px-3 font-medium">Total (R$)</th>
                    <th className="text-right py-2 px-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium">{m.productName || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-blue-600">{(m as any).reference || "—"}</td>
                      <td className="py-2.5 px-3 text-xs">{(m as any).entityName || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">{(m as any).entityDocument || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-purple-600">{(m as any).cfop || "—"}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={m.type === "entrada" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {m.type === "entrada" ? "Compra" : "Venda"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {parseFloat(String(m.quantity)).toFixed(2)} un
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {m.unitPrice ? formatCurrency(parseFloat(String(m.unitPrice))) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        {m.totalPrice ? formatCurrency(parseFloat(String(m.totalPrice))) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatDateBR(m.movementDate || m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Row */}
              <div className="mt-4 pt-3 border-t-2 border-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-xs text-emerald-600 font-medium">Total Comprado</p>
                    <p className="font-bold text-emerald-700">{formatCurrency(summary.totalValueIn)}</p>
                    <p className="text-xs text-emerald-600">{summary.totalEntradas.toFixed(0)} unidades</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-orange-600 font-medium">Total Vendido</p>
                    <p className="font-bold text-orange-700">{formatCurrency(summary.totalValueOut)}</p>
                    <p className="text-xs text-orange-600">{summary.totalSaidas.toFixed(0)} unidades</p>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-3">
                    <p className="text-xs text-violet-600 font-medium">Balanço Financeiro</p>
                    <p className={`font-bold ${(summary.totalValueOut - summary.totalValueIn) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {formatCurrency(summary.totalValueOut - summary.totalValueIn)}
                    </p>
                    <p className="text-xs text-violet-600">{(summary.totalValueOut - summary.totalValueIn) >= 0 ? "Lucro" : "Prejuízo"}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium">Saldo Quantidade</p>
                    <p className="font-bold text-blue-700">
                      {(summary.totalEntradas - summary.totalSaidas).toFixed(0)} un
                    </p>
                    <p className="text-xs text-blue-600">{summary.productCount} produtos</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma movimentação no período</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ POR FORNECEDOR / CLIENTE ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Por Fornecedor / Cliente
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Movimentações agrupadas por entidade — clique para ver os materiais de cada um
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportEntityGroup}
              disabled={isExporting}
              className="gap-1.5 text-xs"
            >
              {exportEntityGroupMutation.isPending ? (
                <Download className="h-3.5 w-3.5 animate-bounce" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exportEntityGroupMutation.isPending ? "Gerando..." : "Excel"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <EntityGroupTable movements={filteredMovements} viewMode={viewMode} formatCurrency={formatCurrency} entities={entities} onEntityFilter={(entityId) => { setSelectedEntityId(String(entityId)); window.scrollTo({ top: 0, behavior: 'smooth' }); toast.info('Filtro aplicado! Todos os dados agora mostram apenas esta entidade.'); }} />
        </CardContent>
      </Card>

      {/* ═══ POR MATERIAL (DRILL-DOWN) ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Por Material (com Fornecedores)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Cada material com seus fornecedores/clientes — clique para expandir
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMaterialGroup}
              disabled={isExporting}
              className="gap-1.5 text-xs"
            >
              {exportMaterialGroupMutation.isPending ? (
                <Download className="h-3.5 w-3.5 animate-bounce" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exportMaterialGroupMutation.isPending ? "Gerando..." : "Excel"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MaterialDrilldownTable movements={filteredMovements} viewMode={viewMode} formatCurrency={formatCurrency} products={products} onProductFilter={(productId) => { setSelectedProductId(String(productId)); window.scrollTo({ top: 0, behavior: 'smooth' }); toast.info('Filtro aplicado! Todos os dados agora mostram apenas este produto.'); }} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENTITY GROUP TABLE — agrupado por fornecedor/cliente com drill-down
   ═══════════════════════════════════════════════════════════════ */
function EntityGroupTable({ movements, viewMode, formatCurrency, entities, onEntityFilter }: { movements: any[]; viewMode: ViewMode; formatCurrency: (v: number) => string; entities?: any[]; onEntityFilter?: (entityId: number) => void }) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState("");

  const entityData = useMemo(() => {
    if (!movements || movements.length === 0) return [];
    const map: Record<string, { name: string; document: string; type: string; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number; count: number; products: Record<string, { name: string; reference: string; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number }> }> = {};
    movements.forEach((m: any) => {
      const entityKey = m.entityName || "Sem entidade";
      if (!map[entityKey]) {
        map[entityKey] = { name: m.entityName || "Sem entidade", document: m.entityDocument || "", type: m.type === "entrada" ? "fornecedor" : "cliente", qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0, count: 0, products: {} };
      }
      const e = map[entityKey];
      const qty = parseFloat(String(m.quantity));
      const val = parseFloat(String(m.totalPrice || 0));
      e.count++;
      if (m.type === "entrada") { e.qtyIn += qty; e.valueIn += val; } else { e.qtyOut += qty; e.valueOut += val; }
      // Products drill-down
      const pName = m.productName || "Desconhecido";
      if (!e.products[pName]) e.products[pName] = { name: pName, reference: m.reference || "", qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0 };
      if (m.type === "entrada") { e.products[pName].qtyIn += qty; e.products[pName].valueIn += val; } else { e.products[pName].qtyOut += qty; e.products[pName].valueOut += val; }
    });
    return Object.values(map).sort((a, b) => (b.valueIn + b.valueOut) - (a.valueIn + a.valueOut));
  }, [movements]);

  const filtered = useMemo(() => {
    if (!entitySearch.trim()) return entityData;
    const q = entitySearch.toLowerCase();
    return entityData.filter(e => e.name.toLowerCase().includes(q) || e.document.includes(q));
  }, [entityData, entitySearch]);

  if (!movements || movements.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação no período</p>;

  return (
    <div className="space-y-3">
      <Input placeholder="Buscar fornecedor/cliente ou CNPJ..." value={entitySearch} onChange={e => setEntitySearch(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground bg-muted/30">
              <th className="text-left py-2.5 px-3 font-semibold w-8"></th>
              <th className="text-left py-2.5 px-3 font-semibold">Fornecedor / Cliente</th>
              <th className="text-left py-2.5 px-3 font-semibold">CNPJ</th>
              <th className="text-right py-2.5 px-3 font-semibold">{viewMode === "financeiro" ? "Compras (R$)" : "Entradas (un)"}</th>
              <th className="text-right py-2.5 px-3 font-semibold">{viewMode === "financeiro" ? "Vendas (R$)" : "Saídas (un)"}</th>
              <th className="text-right py-2.5 px-3 font-semibold">{viewMode === "financeiro" ? "Total (R$)" : "Total (un)"}</th>
              <th className="text-right py-2.5 px-3 font-semibold">Movim.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entity) => {
              const isExpanded = expandedEntity === entity.name;
              const totalValue = entity.valueIn + entity.valueOut;
              const totalQty = entity.qtyIn + entity.qtyOut;
              const productList = Object.values(entity.products).sort((a, b) => (b.valueIn + b.valueOut) - (a.valueIn + a.valueOut));
              return (
                <>
                  <tr key={entity.name} className={`border-b hover:bg-muted/30 cursor-pointer ${isExpanded ? 'bg-primary/5' : ''}`} onClick={() => setExpandedEntity(isExpanded ? null : entity.name)}>
                    <td className="py-2.5 px-3">{isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                      {entity.name}
                      {onEntityFilter && entities && (() => {
                        const found = entities.find((e: any) => e.name === entity.name || e.document === entity.document);
                        return found ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEntityFilter(found.id); }}
                            className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors whitespace-nowrap"
                            title="Filtrar toda a página por esta entidade"
                          >
                            Filtrar
                          </button>
                        ) : null;
                      })()}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">{entity.document || "—"}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">{viewMode === "financeiro" ? formatCurrency(entity.valueIn) : `${entity.qtyIn.toFixed(2)} un`}</td>
                    <td className="py-2.5 px-3 text-right text-orange-700 font-mono">{viewMode === "financeiro" ? formatCurrency(entity.valueOut) : `${entity.qtyOut.toFixed(2)} un`}</td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono">{viewMode === "financeiro" ? formatCurrency(totalValue) : `${totalQty.toFixed(2)} un`}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{entity.count}</td>
                  </tr>
                  {isExpanded && productList.map((p) => (
                    <tr key={`${entity.name}-${p.name}`} className="bg-muted/10 border-b">
                      <td className="py-1.5 px-3"></td>
                      <td className="py-1.5 px-3 text-xs pl-8">↳ {p.name}</td>
                      <td className="py-1.5 px-3 text-xs text-blue-600">{p.reference || "—"}</td>
                      <td className="py-1.5 px-3 text-right text-xs text-emerald-600 font-mono">{viewMode === "financeiro" ? formatCurrency(p.valueIn) : `${p.qtyIn.toFixed(2)}`}</td>
                      <td className="py-1.5 px-3 text-right text-xs text-orange-600 font-mono">{viewMode === "financeiro" ? formatCurrency(p.valueOut) : `${p.qtyOut.toFixed(2)}`}</td>
                      <td className="py-1.5 px-3 text-right text-xs font-mono">{viewMode === "financeiro" ? formatCurrency(p.valueIn + p.valueOut) : `${(p.qtyIn + p.qtyOut).toFixed(2)}`}</td>
                      <td className="py-1.5 px-3"></td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-bold">
              <td className="py-3 px-3" colSpan={3}>TOTAL ({filtered.length} entidades)</td>
              <td className="py-3 px-3 text-right text-emerald-700 font-mono">{viewMode === "financeiro" ? formatCurrency(filtered.reduce((s, e) => s + e.valueIn, 0)) : `${filtered.reduce((s, e) => s + e.qtyIn, 0).toFixed(2)} un`}</td>
              <td className="py-3 px-3 text-right text-orange-700 font-mono">{viewMode === "financeiro" ? formatCurrency(filtered.reduce((s, e) => s + e.valueOut, 0)) : `${filtered.reduce((s, e) => s + e.qtyOut, 0).toFixed(2)} un`}</td>
              <td className="py-3 px-3 text-right font-mono">{viewMode === "financeiro" ? formatCurrency(filtered.reduce((s, e) => s + e.valueIn + e.valueOut, 0)) : `${filtered.reduce((s, e) => s + e.qtyIn + e.qtyOut, 0).toFixed(2)} un`}</td>
              <td className="py-3 px-3 text-right text-muted-foreground">{filtered.reduce((s, e) => s + e.count, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MATERIAL DRILLDOWN TABLE — agrupado por material com fornecedores
   ═══════════════════════════════════════════════════════════════ */
function MaterialDrilldownTable({ movements, viewMode, formatCurrency, products, onProductFilter }: { movements: any[]; viewMode: ViewMode; formatCurrency: (v: number) => string; products?: any[]; onProductFilter?: (productId: number) => void }) {
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");

  const materialData = useMemo(() => {
    if (!movements || movements.length === 0) return [];
    const map: Record<string, { name: string; reference: string; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number; count: number; entities: Record<string, { name: string; document: string; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number }> }> = {};
    movements.forEach((m: any) => {
      const pName = m.productName || "Desconhecido";
      if (!map[pName]) {
        map[pName] = { name: pName, reference: m.reference || "", qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0, count: 0, entities: {} };
      }
      const p = map[pName];
      const qty = parseFloat(String(m.quantity));
      const val = parseFloat(String(m.totalPrice || 0));
      p.count++;
      if (!p.reference && m.reference) p.reference = m.reference;
      if (m.type === "entrada") { p.qtyIn += qty; p.valueIn += val; } else { p.qtyOut += qty; p.valueOut += val; }
      // Entity drill-down
      const eName = m.entityName || "Sem entidade";
      if (!p.entities[eName]) p.entities[eName] = { name: eName, document: m.entityDocument || "", qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0 };
      if (m.type === "entrada") { p.entities[eName].qtyIn += qty; p.entities[eName].valueIn += val; } else { p.entities[eName].qtyOut += qty; p.entities[eName].valueOut += val; }
    });
    return Object.values(map).sort((a, b) => (b.valueIn + b.valueOut) - (a.valueIn + a.valueOut));
  }, [movements]);

  const filtered = useMemo(() => {
    if (!materialSearch.trim()) return materialData;
    const q = materialSearch.toLowerCase();
    return materialData.filter(m => m.name.toLowerCase().includes(q) || m.reference.toLowerCase().includes(q));
  }, [materialData, materialSearch]);

  if (!movements || movements.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação no período</p>;

  return (
    <div className="space-y-3">
      <Input placeholder="Buscar material ou referência..." value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground bg-muted/30">
              <th className="text-left py-2.5 px-3 font-semibold w-8"></th>
              <th className="text-left py-2.5 px-3 font-semibold">Material / Produto</th>
              <th className="text-left py-2.5 px-3 font-semibold">Ref.</th>
              <th className="text-right py-2.5 px-3 font-semibold">{viewMode === "financeiro" ? "Compras (R$)" : "Entradas (un)"}</th>
              <th className="text-right py-2.5 px-3 font-semibold">{viewMode === "financeiro" ? "Vendas (R$)" : "Saídas (un)"}</th>
              <th className="text-right py-2.5 px-3 font-semibold">{viewMode === "financeiro" ? "Total (R$)" : "Total (un)"}</th>
              <th className="text-right py-2.5 px-3 font-semibold">Fornec.</th>
              <th className="text-right py-2.5 px-3 font-semibold">Movim.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((mat) => {
              const isExpanded = expandedMaterial === mat.name;
              const totalValue = mat.valueIn + mat.valueOut;
              const totalQty = mat.qtyIn + mat.qtyOut;
              const entityList = Object.values(mat.entities).sort((a, b) => (b.valueIn + b.valueOut) - (a.valueIn + a.valueOut));
              return (
                <>
                  <tr key={mat.name} className={`border-b hover:bg-muted/30 cursor-pointer ${isExpanded ? 'bg-primary/5' : ''}`} onClick={() => setExpandedMaterial(isExpanded ? null : mat.name)}>
                    <td className="py-2.5 px-3">{isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                      {mat.name}
                      {onProductFilter && products && (() => {
                        const found = products.find((p: any) => p.name === mat.name);
                        return found ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onProductFilter(found.id); }}
                            className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors whitespace-nowrap"
                            title="Filtrar toda a página por este produto"
                          >
                            Filtrar
                          </button>
                        ) : null;
                      })()}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-blue-600">{mat.reference || "—"}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">{viewMode === "financeiro" ? formatCurrency(mat.valueIn) : `${mat.qtyIn.toFixed(2)} un`}</td>
                    <td className="py-2.5 px-3 text-right text-orange-700 font-mono">{viewMode === "financeiro" ? formatCurrency(mat.valueOut) : `${mat.qtyOut.toFixed(2)} un`}</td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono">{viewMode === "financeiro" ? formatCurrency(totalValue) : `${totalQty.toFixed(2)} un`}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{entityList.length}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{mat.count}</td>
                  </tr>
                  {isExpanded && entityList.map((ent) => (
                    <tr key={`${mat.name}-${ent.name}`} className="bg-muted/10 border-b">
                      <td className="py-1.5 px-3"></td>
                      <td className="py-1.5 px-3 text-xs pl-8">↳ {ent.name}</td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground font-mono">{ent.document || "—"}</td>
                      <td className="py-1.5 px-3 text-right text-xs text-emerald-600 font-mono">{viewMode === "financeiro" ? formatCurrency(ent.valueIn) : `${ent.qtyIn.toFixed(2)}`}</td>
                      <td className="py-1.5 px-3 text-right text-xs text-orange-600 font-mono">{viewMode === "financeiro" ? formatCurrency(ent.valueOut) : `${ent.qtyOut.toFixed(2)}`}</td>
                      <td className="py-1.5 px-3 text-right text-xs font-mono">{viewMode === "financeiro" ? formatCurrency(ent.valueIn + ent.valueOut) : `${(ent.qtyIn + ent.qtyOut).toFixed(2)}`}</td>
                      <td className="py-1.5 px-3" colSpan={2}></td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-bold">
              <td className="py-3 px-3" colSpan={3}>TOTAL ({filtered.length} materiais)</td>
              <td className="py-3 px-3 text-right text-emerald-700 font-mono">{viewMode === "financeiro" ? formatCurrency(filtered.reduce((s, m) => s + m.valueIn, 0)) : `${filtered.reduce((s, m) => s + m.qtyIn, 0).toFixed(2)} un`}</td>
              <td className="py-3 px-3 text-right text-orange-700 font-mono">{viewMode === "financeiro" ? formatCurrency(filtered.reduce((s, m) => s + m.valueOut, 0)) : `${filtered.reduce((s, m) => s + m.qtyOut, 0).toFixed(2)} un`}</td>
              <td className="py-3 px-3 text-right font-mono">{viewMode === "financeiro" ? formatCurrency(filtered.reduce((s, m) => s + m.valueIn + m.valueOut, 0)) : `${filtered.reduce((s, m) => s + m.qtyIn + m.qtyOut, 0).toFixed(2)} un`}</td>
              <td className="py-3 px-3" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


// --- Export Functions ---

function exportToExcel(
  movements: any[],
  summary: { totalEntradas: number; totalSaidas: number; totalValueIn: number; totalValueOut: number; productCount: number },
  viewMode: ViewMode,
  periodLabel: string,
  start: Date,
  end: Date
) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Build CSV content (Excel-compatible)
  const BOM = "\uFEFF";
  const sep = ";";
  let csv = BOM;

  // Header
  csv += `Relat\u00f3rio de Estoque - Lustra Mil Produtos de Limpeza\n`;
  csv += `Período${sep}${formatDateBR(start)} a ${formatDateBR(end)}\n`;
  csv += `Vis\u00e3o${sep}${viewMode === "financeiro" ? "Financeira (R$)" : "Quantidade (un)"}\n`;
  csv += `\n`;

  // Summary
  csv += `RESUMO\n`;
  csv += `Total Compras (R$)${sep}${formatCurrency(summary.totalValueIn)}\n`;
  csv += `Total Vendas (R$)${sep}${formatCurrency(summary.totalValueOut)}\n`;
  csv += `Total Entradas (un)${sep}${summary.totalEntradas.toFixed(2)}\n`;
  csv += `Total Sa\u00eddas (un)${sep}${summary.totalSaidas.toFixed(2)}\n`;
  csv += `Balan\u00e7o (R$)${sep}${formatCurrency(summary.totalValueOut - summary.totalValueIn)}\n`;
  csv += `Produtos Movimentados${sep}${summary.productCount}\n`;
  csv += `\n`;

  // Detail table
  csv += `MOVIMENTA\u00c7\u00d5ES DETALHADAS\n`;
  csv += `Data${sep}Tipo${sep}Produto${sep}Quantidade${sep}Pre\u00e7o Unit.${sep}Valor Total\n`;

  movements.forEach((m) => {
    const date = formatDateBR(m.movementDate || m.createdAt);
    const type = m.type === "entrada" ? "Entrada" : "Saída";
    const product = m.productName || "N/A";
    const qty = parseFloat(String(m.quantity)).toFixed(2);
    const unitPrice = m.unitPrice ? parseFloat(String(m.unitPrice)).toFixed(2).replace(".", ",") : "0,00";
    const total = m.totalPrice ? parseFloat(String(m.totalPrice)).toFixed(2).replace(".", ",") : "0,00";
    csv += `${date}${sep}${type}${sep}${product}${sep}${qty}${sep}R$ ${unitPrice}${sep}R$ ${total}\n`;
  });

  // Download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-estoque-${start.toISOString().split("T")[0]}-a-${end.toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportToPDF(
  movements: any[],
  summary: { totalEntradas: number; totalSaidas: number; totalValueIn: number; totalValueOut: number; productCount: number },
  viewMode: ViewMode,
  periodLabel: string,
  start: Date,
  end: Date
) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Build HTML for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Relat\u00f3rio de Estoque</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 15px; }
        .header h1 { color: #1e40af; margin: 0; font-size: 22px; }
        .header p { color: #666; margin: 5px 0 0; font-size: 13px; }
        .period { background: #f0f4ff; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-size: 13px; }
        .summary { display: flex; gap: 15px; margin-bottom: 25px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-card .label { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        .summary-card .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
        .green { color: #059669; }
        .orange { color: #d97706; }
        .blue { color: #1e40af; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) { background: #f8fafc; }
        .entrada { color: #059669; font-weight: 600; }
        .saida { color: #d97706; font-weight: 600; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .totals { font-weight: bold; background: #f0f4ff !important; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Lustra Mil - Produtos de Limpeza</h1>
        <p>Relat\u00f3rio de Estoque — ${viewMode === "financeiro" ? "Vis\u00e3o Financeira" : "Vis\u00e3o por Quantidade"}</p>
      </div>

      <div class="period">
            <strong>Período:</strong> ${formatDateBR(start)} a ${formatDateBR(end)}}
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="label">Compras (Entradas)</div>
          <div class="value green">${formatCurrency(summary.totalValueIn)}</div>
          <div style="font-size:10px;color:#666">${summary.totalEntradas.toFixed(0)} unidades</div>
        </div>
        <div class="summary-card">
          <div class="label">Vendas (Sa\u00eddas)</div>
          <div class="value orange">${formatCurrency(summary.totalValueOut)}</div>
          <div style="font-size:10px;color:#666">${summary.totalSaidas.toFixed(0)} unidades</div>
        </div>
        <div class="summary-card">
          <div class="label">Balan\u00e7o do Per\u00edodo</div>
          <div class="value blue">${formatCurrency(summary.totalValueOut - summary.totalValueIn)}</div>
          <div style="font-size:10px;color:#666">${summary.productCount} produtos</div>
        </div>
      </div>

      <h3 style="color:#1e40af;font-size:14px;">Movimenta\u00e7\u00f5es Detalhadas (${movements.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Pre\u00e7o Unit.</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map((m) => {
            const date = formatDateBR(m.movementDate || m.createdAt);
            const type = m.type === "entrada" ? "Entrada" : "Sa\u00edda";
            const typeClass = m.type === "entrada" ? "entrada" : "saida";
            const product = m.productName || "N/A";
            const qty = parseFloat(String(m.quantity)).toFixed(2);
            const unitPrice = m.unitPrice ? formatCurrency(parseFloat(String(m.unitPrice))) : "R$ 0,00";
            const total = m.totalPrice ? formatCurrency(parseFloat(String(m.totalPrice))) : "R$ 0,00";
            return `<tr><td>${date}</td><td class="${typeClass}">${type}</td><td>${product}</td><td>${qty}</td><td>${unitPrice}</td><td>${total}</td></tr>`;
          }).join("")}
          <tr class="totals">
            <td colspan="5">TOTAIS</td>
            <td>${(summary.totalEntradas + summary.totalSaidas).toFixed(2)}</td>
            <td></td>
            <td>${formatCurrency(summary.totalValueIn + summary.totalValueOut)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Gerado em ${new Date().toLocaleDateString("pt-BR")} \u00e0s ${new Date().toLocaleTimeString("pt-BR")} — Lustra Mil Produtos de Limpeza
      </div>
    </body>
    </html>
  `;

  // Open in new window for printing as PDF
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
