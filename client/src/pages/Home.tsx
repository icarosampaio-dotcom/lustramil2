import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateBR, formatMonthName } from "../../../shared/dateUtils";
import { trpc } from "@/lib/trpc";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  AlertTriangle,
  Upload,
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarRange,
  Clock,
  CreditCard,
  Wallet,
  ChevronRight,
  BarChart3,
  Scale,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getPeriodRange(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  const now = new Date();

  if (period === "personalizado" && customStart && customEnd) {
    const s = new Date(customStart + "T00:00:00");
    const e = new Date(customEnd + "T23:59:59.999");
    return {
      start: s,
      end: e,
      label: `${formatDateBR(s)} — ${formatDateBR(e)}`,
    };
  }

  switch (period) {
    case "mes-atual": {
      const r = getMonthRange(0);
      return { ...r, label: formatMonthLabel(r.start) };
    }
    case "mes-anterior": {
      const r = getMonthRange(-1);
      return { ...r, label: formatMonthLabel(r.start) };
    }
    case "ultimos-3-meses": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: "Últimos 3 Meses" };
    }
    case "ultimos-6-meses": {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: "Últimos 6 Meses" };
    }
    case "ano-atual": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end, label: `Ano ${now.getFullYear()}` };
    }
    default: {
      const r = getMonthRange(0);
      return { ...r, label: formatMonthLabel(r.start) };
    }
  }
}

function formatMonthLabel(date: Date) {
  return formatMonthName(date);
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState("mes-atual");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatDateInput(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatDateInput(new Date()));

  const { start: startDate, end: endDate, label: periodLabel } = useMemo(
    () => getPeriodRange(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery({ startDate, endDate });
  const { data: recentMovements, isLoading: movementsLoading } = trpc.dashboard.recentMovements.useQuery({ startDate, endDate, limit: 15 });
  const { data: lowStock } = trpc.dashboard.lowStock.useQuery();
  const { data: upcomingPayables } = trpc.accountsPayable.upcoming.useQuery({ days: 7 });
  const { data: payableSummary } = trpc.accountsPayable.summary.useQuery({
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
  });
  const { data: receivableSummary } = trpc.accountsReceivable.summary.useQuery({
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
  });
  const { data: resultadoPeriodo } = trpc.dashboard.resultadoPeriodo.useQuery({ startDate, endDate });

  const formatCurrency = (value: number | string | undefined) => {
    const num = typeof value === "string" ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  // Dados para gráfico de barras entradas vs saídas
  const movementChartData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: "Entradas",
        quantidade: stats.totalEntradas || 0,
        valor: parseFloat(String(stats.valorEntradas || 0)),
      },
      {
        name: "Saídas",
        quantidade: stats.totalSaidas || 0,
        valor: parseFloat(String(stats.valorSaidas || 0)),
      },
    ];
  }, [stats]);

  // Dados para gráfico de pizza - contas a pagar por status
  const payablePieData = useMemo(() => {
    if (!payableSummary) return [];
    const data = [];
    const pending = parseFloat(String(payableSummary.totalPendente || 0));
    const paid = parseFloat(String(payableSummary.totalPago || 0));
    const overdue = parseFloat(String((payableSummary as any).totalVencido || 0));
    if (pending > 0) data.push({ name: "Pendente", value: pending });
    if (paid > 0) data.push({ name: "Pago", value: paid });
    if (overdue > 0) data.push({ name: "Vencido", value: overdue });
    return data;
  }, [payableSummary]);

  return (
    <div className="space-y-6">
      {/* Header com Seletor de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {user?.name?.split(" ")[0] || user?.username || "Usuário"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Painel de controle do seu estoque de produtos de limpeza
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="border-0 bg-transparent shadow-none h-8 w-[200px] focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes-atual">Mês Atual</SelectItem>
              <SelectItem value="mes-anterior">Mês Anterior</SelectItem>
              <SelectItem value="ultimos-3-meses">Últimos 3 Meses</SelectItem>
              <SelectItem value="ultimos-6-meses">Últimos 6 Meses</SelectItem>
              <SelectItem value="ano-atual">Ano Atual</SelectItem>
              <SelectItem value="personalizado">Período Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campos de data personalizada */}
      {period === "personalizado" && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="min-w-[160px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <CalendarRange className="h-3 w-3 inline mr-1" />
                  Data Início
                </Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="min-w-[160px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <CalendarRange className="h-3 w-3 inline mr-1" />
                  Data Fim
                </Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Período Selecionado — sempre por data da nota */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span>Exibindo por <strong className="text-foreground">data da nota</strong>: {periodLabel}</span>
        {period !== "personalizado" && (
          <span className="text-xs">({formatDateBR(startDate)} — {formatDateBR(endDate)})</span>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-3">
        <Button
          onClick={() => setLocation("/upload?type=entrada")}
          className="gap-2 shadow-md hover:shadow-lg transition-all"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Entrada
        </Button>
        <Button
          onClick={() => setLocation("/upload?type=saida")}
          variant="outline"
          className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Saída
        </Button>
      </div>

      {/* Stats Cards - 6 cards clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setLocation("/estoque")}>
          <StatsCard
            title="Total de Produtos"
            value={statsLoading ? "..." : String(stats?.totalProducts || 0)}
            icon={Package}
            description="Cadastrados no sistema"
            color="text-primary"
            bgColor="bg-primary/10"
            clickable
          />
        </div>
        <div className="cursor-pointer" onClick={() => setLocation("/notas")}>
          <StatsCard
            title="Entradas no Período"
            value={statsLoading ? "..." : String(stats?.totalEntradas || 0)}
            icon={ArrowDownToLine}
            description={statsLoading ? "..." : `Valor: ${formatCurrency(stats?.valorEntradas)}`}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
            clickable
          />
        </div>
        <div className="cursor-pointer" onClick={() => setLocation("/notas")}>
          <StatsCard
            title="Saídas no Período"
            value={statsLoading ? "..." : String(stats?.totalSaidas || 0)}
            icon={ArrowUpFromLine}
            description={statsLoading ? "..." : `Valor: ${formatCurrency(stats?.valorSaidas)}`}
            color="text-orange-600"
            bgColor="bg-orange-50"
            clickable
          />
        </div>
        <div className="cursor-pointer" onClick={() => setLocation("/contas-pagar")}>
          <StatsCard
            title="Contas a Pagar"
            value={statsLoading ? "..." : formatCurrency(payableSummary?.totalPendente)}
            icon={CreditCard}
            description={`${payableSummary?.pendente || 0} pendente(s) no período`}
            color="text-red-600"
            bgColor="bg-red-50"
            isSmallText
            clickable
          />
        </div>
        <div className="cursor-pointer" onClick={() => setLocation("/contas-receber")}>
          <StatsCard
            title="Contas a Receber"
            value={statsLoading ? "..." : formatCurrency(receivableSummary?.totalPendente)}
            icon={Wallet}
            description={`${receivableSummary?.pendente || 0} pendente(s) no período`}
            color="text-blue-600"
            bgColor="bg-blue-50"
            isSmallText
            clickable
          />
        </div>
        <div className="cursor-pointer" onClick={() => setLocation("/estoque")}>
          <StatsCard
            title="Valor em Estoque"
            value={statsLoading ? "..." : formatCurrency(stats?.totalStockValue)}
            icon={DollarSign}
            description={statsLoading ? "..." : `${stats?.lowStockCount || 0} produto(s) com estoque baixo`}
            color="text-violet-600"
            bgColor="bg-violet-50"
            isSmallText
            clickable
          />
        </div>
        <div className="cursor-pointer" onClick={() => setLocation("/relatorios")}>
          <StatsCard
            title="Resultado do Período"
            value={resultadoPeriodo != null ? formatCurrency(resultadoPeriodo.resultado) : "..."}
            icon={Scale}
            description={resultadoPeriodo != null ? `Receitas ${formatCurrency(resultadoPeriodo.receitas)} − Despesas ${formatCurrency(resultadoPeriodo.despesas)}` : "Superávit ou déficit"}
            color={resultadoPeriodo && resultadoPeriodo.resultado >= 0 ? "text-emerald-600" : "text-red-600"}
            bgColor={resultadoPeriodo && resultadoPeriodo.resultado >= 0 ? "bg-emerald-50" : "bg-red-50"}
            isSmallText
            clickable
          />
        </div>
      </div>

      {/* Alerta de Vencimentos Próximos */}
      {upcomingPayables && upcomingPayables.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800">
              <Clock className="h-4 w-4" />
              Vencimentos Próximos (7 dias)
              <Badge variant="outline" className="ml-auto border-amber-300 text-amber-700">
                {upcomingPayables.length} conta(s)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingPayables.slice(0, 5).map((item: any) => {
                const dueDate = new Date(item.dueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue = dueDate < today;
                const isToday = dueDate.toDateString() === today.toDateString();

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${
                      isOverdue ? "bg-red-50 border-red-200" : isToday ? "bg-amber-50 border-amber-200" : "bg-white border-amber-100"
                    }`}
                    onClick={() => setLocation("/contas-pagar")}
                  >
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.entityName || "Sem fornecedor"} • Vence: {formatDateBR(dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isOverdue ? "destructive" : isToday ? "default" : "secondary"} className="text-xs">
                        {isOverdue ? "Vencida" : isToday ? "Hoje" : `${Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)} dias`}
                      </Badge>
                      <span className="font-semibold text-sm">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                );
              })}
              {upcomingPayables.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full text-amber-700" onClick={() => setLocation("/contas-pagar")}>
                  Ver todas ({upcomingPayables.length}) <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Entradas vs Saídas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Entradas vs Saídas (Valor)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movementChartData.length > 0 && (movementChartData[0].valor > 0 || movementChartData[1].valor > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={movementChartData} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#f97316" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sem movimentações no período</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Contas a Pagar por Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-red-500" />
              Contas a Pagar (Status)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payablePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={payablePieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    fontSize={11}
                  >
                    {payablePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sem contas a pagar no período</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-primary/20"
          onClick={() => setLocation("/upload?type=entrada")}
        >
          <CardContent className="p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowDownToLine className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Registrar Entrada</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Faça upload da nota fiscal de compra para registro automático
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-destructive/20"
          onClick={() => setLocation("/upload?type=saida")}
        >
          <CardContent className="p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpFromLine className="h-7 w-7 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Registrar Saída</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Faça upload da nota fiscal de venda para baixa automática
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Movements */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Movimentações do Período
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLocation("/relatorios")}>
                Ver tudo <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {movementsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : recentMovements && recentMovements.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentMovements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {mov.type === "entrada" ? (
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <TrendingDown className="h-4 w-4 text-orange-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{mov.productName || "Produto"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateBR(mov.movementDate || mov.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={mov.type === "entrada" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {mov.type === "entrada" ? "+" : "-"}{parseFloat(String(mov.quantity)).toFixed(0)} un
                      </Badge>
                      {mov.totalPrice && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(mov.totalPrice)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma movimentação no período</p>
                <p className="text-xs mt-1">Selecione outro período ou faça upload de uma nota fiscal</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Alertas de Estoque Baixo
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLocation("/estoque")}>
                Ver estoque <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lowStock && lowStock.length > 0 ? (
              <div className="space-y-2">
                {lowStock.map((product) => {
                  const stock = parseFloat(String(product.currentStock));
                  const min = parseFloat(String(product.minStock));
                  const pct = min > 0 ? Math.min(100, (stock / min) * 100) : 0;

                  return (
                    <div
                      key={product.id}
                      className="p-3 rounded-lg bg-orange-50/50 border border-orange-100 cursor-pointer hover:shadow-sm transition-all"
                      onClick={() => setLocation("/estoque")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{product.name}</p>
                        <Badge variant="destructive" className="text-xs">
                          {stock.toFixed(0)} / {min.toFixed(0)} {product.unit}
                        </Badge>
                      </div>
                      <div className="w-full bg-orange-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            pct < 25 ? "bg-red-500" : pct < 50 ? "bg-orange-500" : "bg-yellow-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum alerta de estoque</p>
                <p className="text-xs mt-1">Todos os produtos estão com estoque adequado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  color,
  bgColor,
  isSmallText,
  clickable,
}: {
  title: string;
  value: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
  isSmallText?: boolean;
  clickable?: boolean;
}) {
  return (
    <Card className={`hover:shadow-md transition-all ${clickable ? "hover:border-primary/30 hover:scale-[1.01]" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className={`font-bold ${isSmallText ? "text-lg" : "text-2xl"} tracking-tight`}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl ${bgColor} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {clickable && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <span>Clique para detalhes</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
