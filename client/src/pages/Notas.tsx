import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBR, formatMonthName } from "../../../shared/dateUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

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
    case "todas": {
      const start = new Date(2020, 0, 1);
      const end = new Date(2030, 11, 31, 23, 59, 59, 999);
      return { start, end, label: "Todas as Notas" };
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

const ITEMS_PER_PAGE = 20;

export default function NotasPage() {
  return (
    <DashboardLayout>
      <NotasContent />
    </DashboardLayout>
  );
}

function NotasContent() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cnpjFilter, setCnpjFilter] = useState<string>("all");
  const [period, setPeriod] = useState("mes-atual");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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

  // Passa startDate e endDate para o backend filtrar por issueDate
  // Buscar CNPJs disponíveis para o filtro
  const { data: cnpjList } = trpc.invoices.cnpjs.useQuery();

  const queryInput = useMemo(() => {
    const input: Record<string, any> = {};
    if (typeFilter !== "all") input.type = typeFilter as "entrada" | "saida";
    if (cnpjFilter !== "all") input.entityDocument = cnpjFilter;
    if (period !== "todas") {
      input.startDate = startDate;
      input.endDate = endDate;
    }
    // Aumentar limite para cobrir todas as notas do período
    input.limit = 100;
    return input;
  }, [typeFilter, cnpjFilter, period, startDate, endDate]);

  const { data: invoices, isLoading } = trpc.invoices.list.useQuery(queryInput);

  // Filtrar notas pela busca (período já filtrado no backend)
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    let result = invoices;

    // Filtrar por busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((inv) =>
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
        (inv.entityName && inv.entityName.toLowerCase().includes(q)) ||
        (inv.totalValue && inv.totalValue.includes(q)) ||
        String(inv.id).includes(q)
      );
    }

    return result;
  }, [invoices, searchQuery]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // Reset page quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, cnpjFilter, period, searchQuery, customStartDate, customEndDate]);

  const { data: invoiceDetail } = trpc.invoices.get.useQuery(
    { id: selectedInvoiceId! },
    { enabled: !!selectedInvoiceId }
  );

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "—";
    const num = parseFloat(value);
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!filteredInvoices) return { entradas: 0, saidas: 0, totalEntradas: 0, totalSaidas: 0 };
    let entradas = 0, saidas = 0, totalEntradas = 0, totalSaidas = 0;
    filteredInvoices.forEach((inv) => {
      const val = parseFloat(inv.totalValue || "0");
      if (inv.type === "entrada") { entradas++; totalEntradas += val; }
      else { saidas++; totalSaidas += val; }
    });
    return { entradas, saidas, totalEntradas, totalSaidas };
  }, [filteredInvoices]);

  const statusConfig = {
    processando: { icon: Clock, label: "Processando", color: "bg-blue-100 text-blue-700" },
    concluido: { icon: CheckCircle2, label: "Concluído", color: "bg-emerald-100 text-emerald-700" },
    erro: { icon: XCircle, label: "Erro", color: "bg-red-100 text-red-700" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de notas fiscais processadas
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Seletor de Período */}
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
                  <SelectItem value="todas">Todas as Notas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Tipo */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por CNPJ */}
            <Select value={cnpjFilter} onValueChange={setCnpjFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por CNPJ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os CNPJs</SelectItem>
                {cnpjList?.map((c) => (
                  <SelectItem key={c.entityDocument!} value={c.entityDocument!}>
                    {c.entityName || c.entityDocument}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, fornecedor, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Campos de data personalizada */}
          {period === "personalizado" && (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mt-3 pt-3 border-t border-border/50">
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
          )}

          {/* Info do período */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t">
            <Calendar className="h-3 w-3" />
            <span>
              Por data da nota: <strong className="text-foreground">{periodLabel}</strong>
              {period !== "todas" && period !== "personalizado" && (
                <span> ({formatDateBR(startDate)} — {formatDateBR(endDate)})</span>
              )}
              {" • "}
              <strong className="text-foreground">{filteredInvoices.length}</strong> nota(s) encontrada(s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de Notas</p>
            <p className="text-xl font-bold mt-1">{filteredInvoices.length}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-xs text-muted-foreground">Entradas</p>
            </div>
            <p className="text-xl font-bold mt-1 text-emerald-700">{summaryStats.entradas}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(String(summaryStats.totalEntradas))}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <ArrowUpFromLine className="h-3.5 w-3.5 text-orange-600" />
              <p className="text-xs text-muted-foreground">Saídas</p>
            </div>
            <p className="text-xl font-bold mt-1 text-orange-700">{summaryStats.saidas}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(String(summaryStats.totalSaidas))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Balanço</p>
            <p className={`text-xl font-bold mt-1 ${summaryStats.totalEntradas - summaryStats.totalSaidas >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatCurrency(String(summaryStats.totalEntradas - summaryStats.totalSaidas))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Notas */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : paginatedInvoices.length > 0 ? (
        <>
          <div className="space-y-3">
            {paginatedInvoices.map((invoice) => {
              const status = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.processando;
              const StatusIcon = status.icon;

              return (
                <Card
                  key={invoice.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        invoice.type === "entrada" ? "bg-emerald-50" : "bg-orange-50"
                      }`}>
                        {invoice.type === "entrada" ? (
                          <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <ArrowUpFromLine className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {invoice.invoiceNumber ? `NF ${invoice.invoiceNumber}` : `Nota #${invoice.id}`}
                          </p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {invoice.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {invoice.entityName || "Sem identificação"}
                          {invoice.entityDocument && <span className="ml-1 text-blue-600">({invoice.entityDocument})</span>}
                          {" "}•{" "}
                          {formatDateBR(invoice.issueDate || invoice.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(invoice.totalValue)}</p>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredInvoices.length} notas)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg">Nenhuma nota fiscal no período</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? "Nenhuma nota encontrada para esta busca"
                : "Selecione outro período ou faça upload de uma nota fiscal"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoiceId} onOpenChange={() => setSelectedInvoiceId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {invoiceDetail
                ? `NF ${invoiceDetail.invoiceNumber || invoiceDetail.id}`
                : "Carregando..."}
            </DialogTitle>
          </DialogHeader>

          {invoiceDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="Tipo" value={invoiceDetail.type === "entrada" ? "Entrada" : "Saída"} />
                <InfoItem
                  label={invoiceDetail.type === "entrada" ? "Fornecedor" : "Cliente"}
                  value={invoiceDetail.entityName || "N/A"}
                />
                <InfoItem label="CNPJ/CPF" value={invoiceDetail.entityDocument || "N/A"} />
                <InfoItem
                  label="Data de Emissão"
                  value={invoiceDetail.issueDate
                    ? formatDateBR(invoiceDetail.issueDate)
                    : "N/A"
                  }
                />
                <InfoItem label="Valor Total" value={formatCurrency(invoiceDetail.totalValue)} />
              </div>

              {invoiceDetail.items && invoiceDetail.items.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Itens ({invoiceDetail.items.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {invoiceDetail.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm"
                      >
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span>{parseFloat(item.quantity).toFixed(2)} {item.unit || "un"}</span>
                            {item.reference && <span className="text-blue-600">Ref: {item.reference}</span>}
                            {item.cfop && <span className="text-purple-600">CFOP: {item.cfop}</span>}
                          </div>
                        </div>
                        <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-medium text-sm mt-0.5">{value}</p>
    </div>
  );
}
