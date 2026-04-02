import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload, FileText, Package, BarChart3, Trash2, Search,
  TrendingUp, TrendingDown, ShoppingCart, AlertTriangle,
  Download, Filter, X, Settings, Percent, Building2
} from "lucide-react";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtQty(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateBR(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function fmtCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  if (c.length === 14) {
    return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
  }
  return cnpj;
}

export default function VendasAbc() {
  const [activeTab, setActiveTab] = useState("importar");

  // Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState("Cometa Supermercados");
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);

  // Filter state
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedCnpj, setSelectedCnpj] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Commission state
  const [commClientName, setCommClientName] = useState("Cometa Supermercados");
  const [commPercentage, setCommPercentage] = useState("35.00");
  const [commCnpjPattern, setCommCnpjPattern] = useState("");

  // Queries
  const batchesQuery = trpc.salesAbc.listBatches.useQuery();
  const cnpjsQuery = trpc.salesAbc.distinctCnpjs.useQuery({
    batchId: selectedBatch !== "all" ? parseInt(selectedBatch) : undefined,
  });

  const filters = useMemo(() => ({
    batchId: selectedBatch !== "all" ? parseInt(selectedBatch) : undefined,
    cnpj: selectedCnpj !== "all" ? selectedCnpj : undefined,
    startDate: startDate ? new Date(startDate + "T00:00:00Z").getTime() : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59Z").getTime() : undefined,
  }), [selectedBatch, selectedCnpj, startDate, endDate]);

  const summaryQuery = trpc.salesAbc.summary.useQuery(filters, { enabled: activeTab !== "importar" });
  const byProductQuery = trpc.salesAbc.byProduct.useQuery(filters, { enabled: activeTab === "produtos" });
  const cancellationsQuery = trpc.salesAbc.cancellations.useQuery(filters, { enabled: activeTab === "cancelamentos" });
  const byCnpjQuery = trpc.salesAbc.byCnpj.useQuery({
    batchId: filters.batchId,
    startDate: filters.startDate,
    endDate: filters.endDate,
  }, { enabled: activeTab === "cnpj" });
  const commissionsQuery = trpc.commission.list.useQuery(undefined, { enabled: activeTab === "recibo" });

  // Mutations
  const importMutation = trpc.salesAbc.importCsv.useMutation();
  const deleteBatchMutation = trpc.salesAbc.deleteBatch.useMutation();
  const upsertCommission = trpc.commission.upsert.useMutation();
  const deleteCommission = trpc.commission.delete.useMutation();
  const utils = trpc.useUtils();

  // Handle file selection and preview
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim()).slice(0, 11); // header + 10 rows
      setPreviewData(lines.map(l => l.split(";")));
    };
    reader.readAsText(file, "utf-8");
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!csvFile) return;
    setImporting(true);
    try {
      const text = await csvFile.text();
      const result = await importMutation.mutateAsync({
        csvContent: text,
        fileName: csvFile.name,
        clientName: clientName || undefined,
      });
      toast.success(`Importação concluída! ${result.totalRecords} registros importados. Total: ${fmtBRL(result.totalValue)}`);
      setCsvFile(null);
      setPreviewData([]);
      utils.salesAbc.listBatches.invalidate();
      utils.salesAbc.distinctCnpjs.invalidate();
      setActiveTab("recibo");
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }, [csvFile, clientName, importMutation, toast, utils]);

  // Handle batch delete
  const handleDeleteBatch = useCallback(async (id: number) => {
    try {
      await deleteBatchMutation.mutateAsync({ id });
      toast.success("Lote excluído");
      utils.salesAbc.listBatches.invalidate();
      utils.salesAbc.summary.invalidate();
      utils.salesAbc.byProduct.invalidate();
      utils.salesAbc.cancellations.invalidate();
      utils.salesAbc.byCnpj.invalidate();
      utils.salesAbc.distinctCnpjs.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [deleteBatchMutation, toast, utils]);

  // Handle commission save
  const handleSaveCommission = useCallback(async () => {
    try {
      await upsertCommission.mutateAsync({
        clientName: commClientName,
        percentage: commPercentage,
        cnpjPattern: commCnpjPattern || undefined,
      });
      toast.success("Comissão salva!");
      utils.commission.list.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [commClientName, commPercentage, commCnpjPattern, upsertCommission, toast, utils]);

  // Filtered products by search
  const filteredProducts = useMemo(() => {
    const data = byProductQuery.data || [];
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(p =>
      p.description.toLowerCase().includes(term) ||
      p.internalCode.toLowerCase().includes(term) ||
      p.productCode.toLowerCase().includes(term)
    );
  }, [byProductQuery.data, searchTerm]);

  // Commission calculation for recibo
  const reciboData = useMemo(() => {
    const summary = summaryQuery.data;
    if (!summary) return null;
    const totalValue = Number(summary.totalValue);
    const commission = commissionsQuery.data?.find(c => c.clientName === clientName) || commissionsQuery.data?.[0];
    const pct = commission ? Number(commission.percentage) : 35;
    const discountValue = totalValue * (pct / 100);
    const totalToPay = totalValue - discountValue;
    const cancellations = cancellationsQuery.data || [];
    const cancelTotal = cancellations.reduce((sum, c) => sum + Number(c.totalValue), 0);
    return {
      totalValue,
      percentage: pct,
      discountValue,
      totalToPay,
      cancelTotal,
      totalProducts: Number(summary.totalProducts),
      totalRecords: Number(summary.totalRecords),
    };
  }, [summaryQuery.data, commissionsQuery.data, cancellationsQuery.data, clientName]);

  // Clear filters
  const clearFilters = () => {
    setSelectedBatch("all");
    setSelectedCnpj("all");
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
  };

  const hasFilters = selectedBatch !== "all" || selectedCnpj !== "all" || startDate || endDate || searchTerm;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendas ABC</h1>
          <p className="text-muted-foreground">Importação CSV, relatórios de vendas e comissões</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="importar" className="flex items-center gap-1.5">
            <Upload className="h-4 w-4" /> Importar
          </TabsTrigger>
          <TabsTrigger value="recibo" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Recibo
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="cancelamentos" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Cancelamentos
          </TabsTrigger>
          <TabsTrigger value="cnpj" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Por CNPJ
          </TabsTrigger>
        </TabsList>

        {/* Filters Bar (shown on all tabs except import) */}
        {activeTab !== "importar" && (
          <Card className="mt-4">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">Lote</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os lotes</SelectItem>
                      {(batchesQuery.data || []).map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.clientName || b.fileName} ({b.totalRecords} reg.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <Select value={selectedCnpj} onValueChange={setSelectedCnpj}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os CNPJs</SelectItem>
                      {(cnpjsQuery.data || []).map(c => (
                        <SelectItem key={c} value={c}>{fmtCnpj(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data Início</Label>
                  <Input type="date" className="h-9 w-[150px]" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data Fim</Label>
                  <Input type="date" className="h-9 w-[150px]" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                {activeTab === "produtos" && (
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground">Buscar produto</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                      <Input className="h-9 pl-8" placeholder="Código, descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                )}
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                    <X className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB: Importar */}
        <TabsContent value="importar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Importar CSV de Vendas</CardTitle>
                <CardDescription>
                  Formato esperado: CNPJ;DATA VENDA;COD PROD;COD INTERNO;DESC PRODUTO;QTD VENDA;VENDA BRUTA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ex: Cometa Supermercados" />
                </div>
                <div>
                  <Label>Arquivo CSV</Label>
                  <Input type="file" accept=".csv,.txt" onChange={handleFileSelect} />
                </div>
                {previewData.length > 0 && (
                  <div className="border rounded-md overflow-x-auto max-h-[300px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {previewData[0]?.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(1).map((row, i) => (
                          <tr key={i} className="border-t">
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 py-1 whitespace-nowrap">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-muted-foreground p-2">Mostrando primeiras 10 linhas...</p>
                  </div>
                )}
                <Button onClick={handleImport} disabled={!csvFile || importing} className="w-full">
                  {importing ? "Importando..." : "Importar Dados"}
                </Button>
              </CardContent>
            </Card>

            {/* Batches List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Importações Realizadas</CardTitle>
              </CardHeader>
              <CardContent>
                {batchesQuery.isLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : (batchesQuery.data || []).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma importação realizada ainda</p>
                ) : (
                  <div className="space-y-3">
                    {(batchesQuery.data || []).map(batch => (
                      <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{batch.clientName || batch.fileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {batch.totalRecords} registros · {fmtBRL(Number(batch.totalValue || 0))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {batch.periodStart && batch.periodEnd ? (
                              `${fmtDateBR(batch.periodStart)} — ${fmtDateBR(batch.periodEnd)}`
                            ) : ""}
                            {" · "}Importado em {fmtDateBR(batch.createdAt)}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBatch(batch.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Commission Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Configuração de Comissão</CardTitle>
              <CardDescription>Defina o percentual de comissão/desconto por cliente para o Recibo ABC</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px]">
                  <Label>Cliente</Label>
                  <Input value={commClientName} onChange={e => setCommClientName(e.target.value)} />
                </div>
                <div className="w-[120px]">
                  <Label>Percentual (%)</Label>
                  <Input type="number" step="0.01" value={commPercentage} onChange={e => setCommPercentage(e.target.value)} />
                </div>
                <div className="min-w-[160px]">
                  <Label>Padrão CNPJ (opcional)</Label>
                  <Input value={commCnpjPattern} onChange={e => setCommCnpjPattern(e.target.value)} placeholder="6887668" />
                </div>
                <Button onClick={handleSaveCommission}>Salvar</Button>
              </div>
              {(commissionsQuery.data || []).length > 0 && (
                <div className="mt-4 space-y-2">
                  {(commissionsQuery.data || []).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 border rounded">
                      <span>{c.clientName} — <strong>{Number(c.percentage).toFixed(2)}%</strong> {c.cnpjPattern && `(CNPJ: ${c.cnpjPattern})`}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={async () => { await deleteCommission.mutateAsync({ id: c.id }); utils.commission.list.invalidate(); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Recibo ABC */}
        <TabsContent value="recibo" className="space-y-4">
          {summaryQuery.isLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : !reciboData || reciboData.totalValue === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado encontrado. Importe um CSV primeiro.</CardContent></Card>
          ) : (
            <>
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">RECIBO ABC DE VENDAS</CardTitle>
                  <CardDescription>
                    Nome: <strong>{clientName || "LUSTRAMIL"}</strong>
                    {startDate && endDate && (
                      <> · Período: <strong>{fmtDateBR(new Date(startDate + "T00:00:00Z"))} - {fmtDateBR(new Date(endDate + "T00:00:00Z"))}</strong></>
                    )}
                    {!startDate && !endDate && batchesQuery.data?.[0] && (
                      <> · Período: <strong>
                        {batchesQuery.data[0].periodStart ? fmtDateBR(batchesQuery.data[0].periodStart) : "?"} - {batchesQuery.data[0].periodEnd ? fmtDateBR(batchesQuery.data[0].periodEnd) : "?"}
                      </strong></>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-center mb-2">
                      <span className="text-sm text-muted-foreground">Venda Total</span>
                      <p className="text-2xl font-bold">{fmtBRL(reciboData.totalValue)}</p>
                    </div>
                    <div className="border rounded overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b">
                            <td className="px-4 py-2 font-medium">PERCENTUAL</td>
                            <td className="px-4 py-2 text-center">{reciboData.percentage.toFixed(2)} %</td>
                            <td className="px-4 py-2 text-right">{fmtBRL(reciboData.discountValue)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <span className="text-sm text-muted-foreground">Descontos</span>
                    <p className="text-lg font-semibold">Total: {fmtBRL(reciboData.discountValue)}</p>
                  </div>

                  {reciboData.cancelTotal !== 0 && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 text-center">
                      <span className="text-sm text-muted-foreground">Cancelamentos</span>
                      <p className="text-lg font-semibold text-red-600">{fmtBRL(reciboData.cancelTotal)}</p>
                    </div>
                  )}

                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center border-2 border-green-200 dark:border-green-900">
                    <span className="text-sm text-muted-foreground">Total a Pagar</span>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {fmtBRL(reciboData.totalToPay + reciboData.cancelTotal)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <ShoppingCart className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Registros</p>
                      <p className="text-lg font-bold">{reciboData.totalRecords.toLocaleString("pt-BR")}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Package className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Produtos Distintos</p>
                      <p className="text-lg font-bold">{reciboData.totalProducts}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Venda Bruta</p>
                      <p className="text-lg font-bold">{fmtBRL(reciboData.totalValue)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB: Venda por Produto */}
        <TabsContent value="produtos" className="space-y-4">
          {byProductQuery.isLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : filteredProducts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado encontrado.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Venda por Produto</CardTitle>
                    <CardDescription>
                      Fornecedor: LUSTRAMIL · Produtos: {filteredProducts.length} · Total: {fmtBRL(filteredProducts.reduce((s, p) => s + Number(p.totalValue), 0))}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Produto</th>
                        <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                        <th className="px-3 py-2 text-right font-semibold">Qtde</th>
                        <th className="px-3 py-2 text-right font-semibold">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, i) => (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="px-3 py-1.5 font-mono text-xs">{p.internalCode}</td>
                          <td className="px-3 py-1.5">{p.description}</td>
                          <td className="px-3 py-1.5 text-right">{fmtQty(Number(p.totalQuantity))}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{fmtBRL(Number(p.totalValue))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-semibold">
                      <tr>
                        <td className="px-3 py-2" colSpan={2}>Total ({filteredProducts.length} produtos)</td>
                        <td className="px-3 py-2 text-right">
                          {fmtQty(filteredProducts.reduce((s, p) => s + Number(p.totalQuantity), 0))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {fmtBRL(filteredProducts.reduce((s, p) => s + Number(p.totalValue), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Cancelamentos */}
        <TabsContent value="cancelamentos" className="space-y-4">
          {cancellationsQuery.isLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : (cancellationsQuery.data || []).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum cancelamento encontrado.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" /> Cancelamentos
                </CardTitle>
                <CardDescription>
                  Produtos: {(cancellationsQuery.data || []).length} · Total: {fmtBRL((cancellationsQuery.data || []).reduce((s, c) => s + Number(c.totalValue), 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Produto</th>
                        <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                        <th className="px-3 py-2 text-right font-semibold">Qtde</th>
                        <th className="px-3 py-2 text-right font-semibold">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cancellationsQuery.data || []).map((c, i) => (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="px-3 py-1.5 font-mono text-xs">{c.internalCode}</td>
                          <td className="px-3 py-1.5">{c.description}</td>
                          <td className="px-3 py-1.5 text-right text-red-600">{fmtQty(Number(c.totalQuantity))}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-red-600">{fmtBRL(Number(c.totalValue))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-semibold">
                      <tr>
                        <td className="px-3 py-2" colSpan={2}>Total</td>
                        <td className="px-3 py-2 text-right text-red-600">
                          {fmtQty((cancellationsQuery.data || []).reduce((s, c) => s + Number(c.totalQuantity), 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600">
                          {fmtBRL((cancellationsQuery.data || []).reduce((s, c) => s + Number(c.totalValue), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Por CNPJ */}
        <TabsContent value="cnpj" className="space-y-4">
          {byCnpjQuery.isLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : (byCnpjQuery.data || []).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado encontrado.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Vendas por CNPJ
                </CardTitle>
                <CardDescription>
                  {(byCnpjQuery.data || []).length} CNPJs · Total: {fmtBRL((byCnpjQuery.data || []).reduce((s, c) => s + Number(c.totalValue), 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">CNPJ</th>
                        <th className="px-3 py-2 text-right font-semibold">Registros</th>
                        <th className="px-3 py-2 text-right font-semibold">Qtde Total</th>
                        <th className="px-3 py-2 text-right font-semibold">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(byCnpjQuery.data || []).map((c, i) => (
                        <tr key={i} className="border-t hover:bg-muted/50 cursor-pointer"
                          onClick={() => { setSelectedCnpj(c.cnpj); setActiveTab("produtos"); }}>
                          <td className="px-3 py-1.5 font-mono">{fmtCnpj(c.cnpj)}</td>
                          <td className="px-3 py-1.5 text-right">{Number(c.totalRecords).toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-1.5 text-right">{fmtQty(Number(c.totalQuantity))}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{fmtBRL(Number(c.totalValue))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-semibold">
                      <tr>
                        <td className="px-3 py-2">Total ({(byCnpjQuery.data || []).length} CNPJs)</td>
                        <td className="px-3 py-2 text-right">
                          {(byCnpjQuery.data || []).reduce((s, c) => s + Number(c.totalRecords), 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {fmtQty((byCnpjQuery.data || []).reduce((s, c) => s + Number(c.totalQuantity), 0))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {fmtBRL((byCnpjQuery.data || []).reduce((s, c) => s + Number(c.totalValue), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
