import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Trophy, Medal, Crown, TrendingUp, Building2, Users, Download,
  Search, ArrowUpDown, ChevronDown, ChevronUp, Package, FileSpreadsheet, FileText
} from "lucide-react";
import { formatDateBR } from "../../../shared/dateUtils";

type PeriodType = "mes_atual" | "mes_anterior" | "trimestre" | "semestre" | "ano" | "custom";

function getDateRange(period: PeriodType, customStart: string, customEnd: string) {
  const now = new Date();
  let start: Date, end: Date, label: string;
  switch (period) {
    case "mes_atual":
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
      label = `${now.toLocaleString("pt-BR", { month: "long", timeZone: "UTC" })} ${now.getFullYear()}`;
      break;
    case "mes_anterior":
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));
      label = `${start.toLocaleString("pt-BR", { month: "long", timeZone: "UTC" })} ${start.getFullYear()}`;
      break;
    case "trimestre":
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 2, 1));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
      label = "Último Trimestre";
      break;
    case "semestre":
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
      label = "Último Semestre";
      break;
    case "ano":
      start = new Date(Date.UTC(now.getFullYear(), 0, 1));
      end = new Date(Date.UTC(now.getFullYear(), 11, 31));
      label = `Ano ${now.getFullYear()}`;
      break;
    case "custom":
      start = new Date(customStart + "T00:00:00Z");
      end = new Date(customEnd + "T23:59:59Z");
      label = "Período Personalizado";
      break;
    default:
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
      label = "Mês Atual";
  }
  return { start, end, label };
}

function formatDateInput(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function Ranking() {
  return (
    <DashboardLayout>
      <RankingContent />
    </DashboardLayout>
  );
}

function RankingContent() {
  const [period, setPeriod] = useState<PeriodType>("ano");
  const [entityType, setEntityType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("totalValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 12);
    return formatDateInput(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatDateInput(new Date()));

  const { start, end, label: periodLabel } = useMemo(
    () => getDateRange(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  const { data: ranking = [], isLoading } = trpc.reports.entityRanking.useQuery({
    startDate: start,
    endDate: end,
    entityType: entityType !== "all" ? entityType : undefined,
  });

  const exportRankingMutation = trpc.reports.exportRankingExcel.useMutation();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const filteredRanking = useMemo(() => {
    let result = [...ranking];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) => r.entityName.toLowerCase().includes(s) || r.entityDocument.includes(s)
      );
    }
    result.sort((a: any, b: any) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return result.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [ranking, search, sortField, sortDir]);

  const top10 = filteredRanking.slice(0, 10);
  const totalGeral = ranking.reduce((s, r) => s + r.totalValue, 0);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

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
      toast.info("Gerando Excel do Ranking... Aguarde.");
      const result = await exportRankingMutation.mutateAsync({
        startDate: start,
        endDate: end,
        entityType: entityType !== "all" ? entityType : undefined,
      });
      downloadBase64File(result.data, result.filename, result.mimeType);
      toast.success("Excel do Ranking exportado!");
    } catch {
      toast.error("Não foi possível gerar o arquivo.");
    }
  }, [start, end, entityType, exportRankingMutation, downloadBase64File]);

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown className={`h-3 w-3 inline ml-1 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
  );

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-xs text-muted-foreground font-mono">{rank}º</span>;
  };

  const getBarWidth = (value: number) => {
    const max = top10[0]?.totalValue || 1;
    return Math.max((value / max) * 100, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Ranking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top clientes e fornecedores por faturamento, frequência e ticket médio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportRankingPDF(filteredRanking, totalGeral, { periodLabel, entityType });
              toast.success("PDF do Ranking gerado! Use Ctrl+P para salvar.");
            }}
            disabled={filteredRanking.length === 0}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportRankingMutation.isPending}
            className="gap-1.5"
          >
            {exportRankingMutation.isPending ? (
              <Download className="h-4 w-4 animate-bounce" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {exportRankingMutation.isPending ? "Gerando..." : "Excel"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="semestre">Semestre</SelectItem>
                  <SelectItem value="ano">Ano Inteiro</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === "custom" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">De</label>
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-[140px] h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Até</label>
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-[140px] h-9 text-xs" />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="fornecedor">Fornecedores</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Busca</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nome ou CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[200px] h-9 text-xs"
                />
              </div>
            </div>

            <Badge variant="outline" className="h-9 px-3 text-xs">
              {periodLabel} — {filteredRanking.length} entidades
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Entidades</p>
                <p className="text-xl font-bold">{filteredRanking.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faturamento Total</p>
                <p className="text-xl font-bold">{formatCurrency(totalGeral)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Building2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio Geral</p>
                <p className="text-xl font-bold">
                  {formatCurrency(
                    totalGeral / Math.max(ranking.reduce((s, r) => s + r.totalInvoices, 0), 1)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Package className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top 1 Concentra</p>
                <p className="text-xl font-bold">
                  {top10[0] ? `${((top10[0].totalValue / totalGeral) * 100).toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Visual Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            Top 10 — Gráfico de Barras
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : top10.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado para o período.</p>
          ) : (
            <div className="space-y-2">
              {top10.map((r) => (
                <div key={r.entityDocument || r.entityName} className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">{getMedalIcon(r.rank)}</div>
                  <div className="w-48 truncate text-sm font-medium" title={r.entityName}>{r.entityName}</div>
                  <div className="flex-1 relative">
                    <div
                      className={`h-7 rounded-md transition-all ${
                        r.rank === 1 ? "bg-yellow-500/80" :
                        r.rank === 2 ? "bg-gray-400/60" :
                        r.rank === 3 ? "bg-amber-700/50" :
                        "bg-primary/30"
                      }`}
                      style={{ width: `${getBarWidth(r.totalValue)}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold">
                      {formatCurrency(r.totalValue)}
                    </span>
                  </div>
                  <div className="w-16 text-right text-xs text-muted-foreground">
                    {((r.totalValue / totalGeral) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Ranking Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Ranking Completo — {filteredRanking.length} entidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredRanking.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-semibold">#</th>
                    <th className="text-left p-2 font-semibold">Nome</th>
                    <th className="text-left p-2 font-semibold">CNPJ/CPF</th>
                    <th className="text-right p-2 font-semibold cursor-pointer select-none" onClick={() => handleSort("totalValue")}>
                      Faturamento <SortIcon field="totalValue" />
                    </th>
                    <th className="text-right p-2 font-semibold">% Total</th>
                    <th className="text-right p-2 font-semibold cursor-pointer select-none" onClick={() => handleSort("totalQtd")}>
                      Quantidade <SortIcon field="totalQtd" />
                    </th>
                    <th className="text-right p-2 font-semibold cursor-pointer select-none" onClick={() => handleSort("totalInvoices")}>
                      Notas <SortIcon field="totalInvoices" />
                    </th>
                    <th className="text-right p-2 font-semibold cursor-pointer select-none" onClick={() => handleSort("totalProducts")}>
                      Produtos <SortIcon field="totalProducts" />
                    </th>
                    <th className="text-right p-2 font-semibold cursor-pointer select-none" onClick={() => handleSort("ticketMedio")}>
                      Ticket Médio <SortIcon field="ticketMedio" />
                    </th>
                    <th className="text-center p-2 font-semibold">Período</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRanking.map((r) => {
                    const isExpanded = expandedEntity === (r.entityDocument || r.entityName);
                    return (
                      <RankingRow
                        key={r.entityDocument || r.entityName}
                        r={r}
                        totalGeral={totalGeral}
                        formatCurrency={formatCurrency}
                        getMedalIcon={getMedalIcon}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedEntity(isExpanded ? null : (r.entityDocument || r.entityName))}
                        start={start}
                        end={end}
                      />
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-bold">
                    <td colSpan={3} className="p-2">TOTAL</td>
                    <td className="text-right p-2">{formatCurrency(totalGeral)}</td>
                    <td className="text-right p-2">100%</td>
                    <td className="text-right p-2">{ranking.reduce((s, r) => s + r.totalQtd, 0).toFixed(2)}</td>
                    <td className="text-right p-2">{ranking.reduce((s, r) => s + r.totalInvoices, 0)}</td>
                    <td className="text-right p-2">{ranking.reduce((s, r) => s + r.totalProducts, 0)}</td>
                    <td className="text-right p-2">
                      {formatCurrency(totalGeral / Math.max(ranking.reduce((s, r) => s + r.totalInvoices, 0), 1))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankingRow({
  r, totalGeral, formatCurrency, getMedalIcon, isExpanded, onToggle, start, end
}: {
  r: any;
  totalGeral: number;
  formatCurrency: (v: number) => string;
  getMedalIcon: (rank: number) => React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  start: Date;
  end: Date;
}) {
  const { data: drillDown } = trpc.reports.entityDrillDown.useQuery(
    { startDate: start, endDate: end, entityDocument: r.entityDocument || undefined },
    { enabled: isExpanded && !!r.entityDocument }
  );

  return (
    <>
      <tr className={`border-b hover:bg-muted/30 transition-colors ${r.rank <= 3 ? "bg-yellow-500/5" : ""}`}>
        <td className="p-2">{getMedalIcon(r.rank)}</td>
        <td className="p-2 font-medium max-w-[200px] truncate" title={r.entityName}>{r.entityName}</td>
        <td className="p-2 font-mono text-muted-foreground">{r.entityDocument}</td>
        <td className="text-right p-2 font-semibold">{formatCurrency(r.totalValue)}</td>
        <td className="text-right p-2">
          <Badge variant={r.rank <= 3 ? "default" : "outline"} className="text-[10px]">
            {((r.totalValue / totalGeral) * 100).toFixed(1)}%
          </Badge>
        </td>
        <td className="text-right p-2">{r.totalQtd.toFixed(2)}</td>
        <td className="text-right p-2">{r.totalInvoices}</td>
        <td className="text-right p-2">{r.totalProducts}</td>
        <td className="text-right p-2">{formatCurrency(r.ticketMedio)}</td>
        <td className="text-center p-2 text-muted-foreground">
          {r.firstDate ? formatDateBR(new Date(r.firstDate)) : "—"} — {r.lastDate ? formatDateBR(new Date(r.lastDate)) : "—"}
        </td>
        <td className="p-2">
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={11} className="p-0">
            <div className="bg-muted/20 border-l-4 border-primary/30 p-3 mx-2 my-1 rounded">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">
                Materiais movimentados por {r.entityName}:
              </p>
              {!drillDown ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-primary" />
                  Carregando...
                </div>
              ) : drillDown.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum material encontrado.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1 font-medium">Material</th>
                      <th className="text-left p-1 font-medium">Referência</th>
                      <th className="text-center p-1 font-medium">Tipo</th>
                      <th className="text-right p-1 font-medium">Qtd</th>
                      <th className="text-right p-1 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillDown.map((d: any, i: number) => (
                      <tr key={i} className="border-b border-dashed">
                        <td className="p-1">{d.productName}</td>
                        <td className="p-1 text-muted-foreground">{d.reference}</td>
                        <td className="text-center p-1">
                          <Badge variant={d.type === "entrada" ? "default" : "secondary"} className="text-[10px]">
                            {d.type === "entrada" ? "Compra" : "Venda"}
                          </Badge>
                        </td>
                        <td className="text-right p-1">{d.totalQtd.toFixed(2)}</td>
                        <td className="text-right p-1 font-medium">{formatCurrency(d.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663173005738/hPrFgGbhTTKiLvuW.jpeg";

function exportRankingPDF(
  ranking: any[],
  totalGeral: number,
  opts: { periodLabel: string; entityType: string }
) {
  if (!ranking || ranking.length === 0) return;

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalInvoices = ranking.reduce((s, r) => s + r.totalInvoices, 0);
  const ticketMedioGeral = totalGeral / Math.max(totalInvoices, 1);
  const tipoLabel = opts.entityType === "fornecedor" ? "Fornecedores" : opts.entityType === "cliente" ? "Clientes" : "Clientes e Fornecedores";

  const getMedalHTML = (rank: number) => {
    if (rank === 1) return '<span style="font-size:16px;">🥇</span>';
    if (rank === 2) return '<span style="font-size:16px;">🥈</span>';
    if (rank === 3) return '<span style="font-size:16px;">🥉</span>';
    return `<span style="font-size:11px;color:#6b7280;">${rank}º</span>`;
  };

  const top10 = ranking.slice(0, 10);
  const maxValue = top10[0]?.totalValue || 1;

  const barChartHTML = top10.map((r) => {
    const pct = Math.max((r.totalValue / maxValue) * 100, 3);
    const color = r.rank === 1 ? "#eab308" : r.rank === 2 ? "#9ca3af" : r.rank === 3 ? "#b45309" : "#3b82f6";
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <div style="width:28px;text-align:center;">${getMedalHTML(r.rank)}</div>
        <div style="width:160px;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.entityName}">${r.entityName}</div>
        <div style="flex:1;position:relative;height:22px;">
          <div style="height:100%;border-radius:4px;background:${color}40;width:${pct}%;"></div>
          <span style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;">${fmtBRL(r.totalValue)}</span>
        </div>
        <div style="width:48px;text-align:right;font-size:9px;color:#6b7280;">${((r.totalValue / totalGeral) * 100).toFixed(1)}%</div>
      </div>`;
  }).join("");

  const rows = ranking.map((r) => `
    <tr${r.rank <= 3 ? ' style="background:#fefce8;"' : ''}>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:10px;">${getMedalHTML(r.rank)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;font-size:10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${r.entityName}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;font-size:9px;color:#6b7280;font-family:monospace;">${r.entityDocument || "—"}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;font-weight:600;">${fmtBRL(r.totalValue)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;">${((r.totalValue / totalGeral) * 100).toFixed(1)}%</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;">${r.totalQtd.toFixed(2)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;">${r.totalInvoices}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;">${r.totalProducts}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:10px;">${fmtBRL(r.ticketMedio)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ranking — ${tipoLabel}</title>
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
    .card .value { font-size: 18px; font-weight: bold; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1e40af; color: white; padding: 6px 6px; text-align: left; font-size: 9px; text-transform: uppercase; }
    th.right { text-align: right; }
    th.center { text-align: center; }
    .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    @media print { body { margin: 15px; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${LOGO_URL}" alt="Lustra Mil" />
    <div class="header-text">
      <h1>Lustra Mil — Ranking de ${tipoLabel}</h1>
      <p>Top por faturamento, frequência e ticket médio</p>
    </div>
  </div>

  <div class="period">
    <strong>Período:</strong> ${opts.periodLabel} — ${ranking.length} entidades
  </div>

  <div class="cards">
    <div class="card" style="border-left:4px solid #eab308;">
      <div class="label">Total Entidades</div>
      <div class="value" style="color:#854d0e;">${ranking.length}</div>
    </div>
    <div class="card" style="border-left:4px solid #3b82f6;">
      <div class="label">Faturamento Total</div>
      <div class="value" style="color:#1e40af;font-size:16px;">${fmtBRL(totalGeral)}</div>
    </div>
    <div class="card" style="border-left:4px solid #22c55e;">
      <div class="label">Ticket Médio Geral</div>
      <div class="value" style="color:#059669;font-size:16px;">${fmtBRL(ticketMedioGeral)}</div>
    </div>
    <div class="card" style="border-left:4px solid #8b5cf6;">
      <div class="label">Top 1 Concentra</div>
      <div class="value" style="color:#6d28d9;">${top10[0] ? `${((top10[0].totalValue / totalGeral) * 100).toFixed(1)}%` : "—"}</div>
    </div>
  </div>

  <h3 style="color:#1e40af;font-size:13px;margin-bottom:8px;">Top 10 — Gráfico Visual</h3>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:20px;">
    ${barChartHTML}
  </div>

  <h3 style="color:#1e40af;font-size:13px;margin-bottom:4px;">Ranking Completo — ${ranking.length} entidades</h3>
  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th>Nome</th>
        <th>CNPJ/CPF</th>
        <th class="right">Faturamento</th>
        <th class="right">% Total</th>
        <th class="right">Quantidade</th>
        <th class="right">Notas</th>
        <th class="right">Produtos</th>
        <th class="right">Ticket Médio</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="font-weight:bold;background:#f0f4ff;border-top:2px solid #1e40af;">
        <td colspan="3" style="padding:7px 6px;">TOTAL</td>
        <td style="padding:7px 6px;text-align:right;">${fmtBRL(totalGeral)}</td>
        <td style="padding:7px 6px;text-align:right;">100%</td>
        <td style="padding:7px 6px;text-align:right;">${ranking.reduce((s, r) => s + r.totalQtd, 0).toFixed(2)}</td>
        <td style="padding:7px 6px;text-align:right;">${totalInvoices}</td>
        <td style="padding:7px 6px;text-align:right;">${ranking.reduce((s, r) => s + r.totalProducts, 0)}</td>
        <td style="padding:7px 6px;text-align:right;">${fmtBRL(ticketMedioGeral)}</td>
      </tr>
    </tbody>
  </table>

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
