import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, CheckCircle, Trash2, AlertTriangle, Clock, DollarSign, Search, ArrowUpDown, Filter, BarChart3, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell } from "recharts";

type PeriodType = "mes_atual" | "mes_anterior" | "ultimos_3" | "ultimos_6" | "ano_atual" | "custom";
type SortField = "description" | "value" | "expectedDate" | "status" | "entityName";
type SortDir = "asc" | "desc";

function getPeriodRange(period: PeriodType, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (period) {
    case "mes_atual": return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    case "mes_anterior": return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
    case "ultimos_3": return { start: new Date(y, m - 2, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    case "ultimos_6": return { start: new Date(y, m - 5, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    case "ano_atual": return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
    case "custom": {
      const s = customStart ? new Date(customStart + "T00:00:00") : new Date(y, m, 1);
      const e = customEnd ? new Date(customEnd + "T23:59:59") : new Date(y, m + 1, 0, 23, 59, 59);
      return { start: s, end: e };
    }
    default: return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
  }
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

export default function ContasReceber() {
  const [period, setPeriod] = useState<PeriodType>("mes_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("expectedDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [entityName, setEntityName] = useState("");
  const [notes, setNotes] = useState("");

  // Receive form
  const [receivedValue, setReceivedValue] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiveAccountId, setReceiveAccountId] = useState<string>("");

  const { start, end } = useMemo(() => getPeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);

  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.accountsReceivable.list.useQuery({
    startDate: start.getTime(), endDate: end.getTime(), status: statusFilter,
  });
  const { data: summary } = trpc.accountsReceivable.summary.useQuery({
    startDate: start.getTime(), endDate: end.getTime(),
  });
  const { data: accounts = [] } = trpc.financialAccounts.list.useQuery();
  const [exportRequest, setExportRequest] = useState(false);
  const { data: exportBase64 } = trpc.accountsReceivable.exportExcel.useQuery(
    { startDate: start.getTime(), endDate: end.getTime(), status: statusFilter === "todos" ? undefined : statusFilter },
    { enabled: exportRequest }
  );

  const createMut = trpc.accountsReceivable.create.useMutation({
    onSuccess: () => { utils.accountsReceivable.invalidate(); toast.success("Conta criada!"); setDialogOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });
  const markReceivedMut = trpc.accountsReceivable.markReceived.useMutation({
    onSuccess: () => { utils.accountsReceivable.invalidate(); utils.financialAccounts.invalidate(); toast.success("Recebimento confirmado!"); setReceiveDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.accountsReceivable.delete.useMutation({
    onSuccess: () => { utils.accountsReceivable.invalidate(); toast.success("Conta excluída!"); },
    onError: (e: any) => toast.error(e.message),
  });

  function resetForm() {
    setDescription(""); setValue(""); setExpectedDate(""); setEntityName(""); setNotes("");
  }

  function handleCreate() {
    if (!description || !value || !expectedDate) { toast.error("Preencha descrição, valor e data prevista"); return; }
    createMut.mutate({
      description, value, expectedDate: new Date(expectedDate + "T12:00:00").getTime(),
      entityName: entityName || undefined, notes: notes || undefined,
    });
  }

  function handleReceive() {
    if (!selectedId || !receivedValue) { toast.error("Preencha o valor recebido"); return; }
    markReceivedMut.mutate({
      id: selectedId, receivedDate: new Date(receivedDate + "T12:00:00").getTime(),
      receivedValue: Number(receivedValue), accountId: receiveAccountId ? Number(receiveAccountId) : undefined,
    });
  }

  function openReceiveDialog(id: number, val: string) {
    setSelectedId(id); setReceivedValue(val); setReceivedDate(new Date().toISOString().slice(0, 10));
    setReceiveAccountId(""); setReceiveDialogOpen(true);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";

  useEffect(() => {
    if (!exportRequest || !exportBase64) return;
    const bin = atob(exportBase64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-a-receber-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExportRequest(false);
    toast.success("Planilha exportada!");
  }, [exportBase64, exportRequest, start, end]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((i: any) =>
        i.description?.toLowerCase().includes(term) ||
        i.entityName?.toLowerCase().includes(term) ||
        i.notes?.toLowerCase().includes(term)
      );
    }
    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "description": cmp = (a.description || "").localeCompare(b.description || ""); break;
        case "entityName": cmp = (a.entityName || "").localeCompare(b.entityName || ""); break;
        case "value": cmp = Number(a.value) - Number(b.value); break;
        case "expectedDate": cmp = new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime(); break;
        case "status": {
          const sa = a.status === "pendente" && new Date(a.expectedDate) < new Date() ? "vencido" : a.status;
          const sb = b.status === "pendente" && new Date(b.expectedDate) < new Date() ? "vencido" : b.status;
          cmp = sa.localeCompare(sb); break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [items, searchTerm, sortField, sortDir]);

  // Chart data: by client
  const chartByClient = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i: any) => {
      const name = i.entityName || "Sem Cliente";
      map.set(name, (map.get(name) || 0) + Number(i.value));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [items]);

  // Chart data: by status
  const chartByStatus = useMemo(() => {
    const pendente = items.filter((i: any) => i.status === "pendente" && new Date(i.expectedDate) >= new Date()).reduce((s: number, i: any) => s + Number(i.value), 0);
    const vencido = items.filter((i: any) => i.status === "pendente" && new Date(i.expectedDate) < new Date()).reduce((s: number, i: any) => s + Number(i.value), 0);
    const recebido = items.filter((i: any) => i.status === "recebido").reduce((s: number, i: any) => s + Number(i.value), 0);
    return [
      { name: "Recebido", value: recebido, color: "#22c55e" },
      { name: "Pendente", value: pendente, color: "#f59e0b" },
      { name: "Vencido", value: vencido, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [items]);

  const periodLabels: Record<PeriodType, string> = {
    mes_atual: "Mês Atual", mes_anterior: "Mês Anterior", ultimos_3: "Últimos 3 Meses",
    ultimos_6: "Últimos 6 Meses", ano_atual: "Ano Atual", custom: "Período Personalizado",
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 inline cursor-pointer ${sortField === field ? "text-primary" : "text-muted-foreground"}`} onClick={() => toggleSort(field)} />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas a Receber</h1>
          <p className="text-muted-foreground">Gerencie seus recebíveis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportRequest(true)} className="gap-2">
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-2" /> Nova Conta</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Conta a Receber</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição *</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Venda produto X" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" /></div>
                <div><Label>Data Prevista *</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
              </div>
              <div><Label>Cliente</Label><Input value={entityName} onChange={e => setEntityName(e.target.value)} placeholder="Nome do cliente" /></div>
              <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-green-600 hover:bg-green-700">{createMut.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(periodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div><Label className="text-xs text-muted-foreground">Data Início</Label><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[160px]" /></div>
                <div><Label className="text-xs text-muted-foreground">Data Fim</Label><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[160px]" /></div>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Descrição, cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-[220px]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100"><Clock className="w-5 h-5 text-yellow-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold text-yellow-600">{fmt(summary?.totalPendente || 0)}</p>
                <p className="text-xs text-muted-foreground">{summary?.pendente || 0} conta(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Recebido</p>
                <p className="text-xl font-bold text-green-600">{fmt(summary?.totalRecebido || 0)}</p>
                <p className="text-xs text-muted-foreground">{summary?.recebido || 0} conta(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Vencido</p>
                <p className="text-xl font-bold text-red-600">{fmt(items.filter((i: any) => i.status === "pendente" && new Date(i.expectedDate) < new Date()).reduce((s: number, i: any) => s + Number(i.value), 0))}</p>
                <p className="text-xs text-muted-foreground">{summary?.vencido || 0} conta(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100"><DollarSign className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{fmt((summary?.totalPendente || 0) + (summary?.totalRecebido || 0))}</p>
                <p className="text-xs text-muted-foreground">{summary?.total || 0} conta(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Por Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <ReTooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartByStatus.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Top 10 Clientes</CardTitle></CardHeader>
            <CardContent>
              {chartByClient.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartByClient} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <ReTooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Listagem ({filteredItems.length} de {items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("description")}>Descrição <SortIcon field="description" /></th>
                    <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("entityName")}>Cliente <SortIcon field="entityName" /></th>
                    <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("value")}>Valor <SortIcon field="value" /></th>
                    <th className="pb-2 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("expectedDate")}>Data Prevista <SortIcon field="expectedDate" /></th>
                    <th className="pb-2 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("status")}>Status <SortIcon field="status" /></th>
                    <th className="pb-2 font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item: any) => {
                    const isOverdue = item.status === "pendente" && new Date(item.expectedDate) < new Date();
                    return (
                      <tr key={item.id} className={`border-b hover:bg-muted/50 ${isOverdue ? "bg-red-50/50" : ""}`}>
                        <td className="py-3">
                          <div>{item.description}</div>
                          {item.notes && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</div>}
                        </td>
                        <td className="py-3">{item.entityName || "-"}</td>
                        <td className="py-3 text-right font-medium">{fmt(Number(item.value))}</td>
                        <td className={`py-3 text-center ${isOverdue ? "text-red-600 font-medium" : ""}`}>{fmtDate(item.expectedDate)}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === "recebido" ? "bg-green-100 text-green-700" :
                            isOverdue ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {isOverdue ? "Vencido" : item.status === "recebido" ? "Recebido" : "Pendente"}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex justify-center gap-1">
                            {item.status !== "recebido" && (
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => openReceiveDialog(item.id, item.value)}>
                                <CheckCircle className="w-3 h-3 mr-1" /> Receber
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("Excluir esta conta?")) deleteMut.mutate({ id: item.id }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog receber */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Valor Recebido (R$)</Label><Input type="number" step="0.01" value={receivedValue} onChange={e => setReceivedValue(e.target.value)} /></div>
            <div><Label>Data do Recebimento</Label><Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} /></div>
            <div><Label>Conta de Entrada</Label>
              <Select value={receiveAccountId} onValueChange={setReceiveAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleReceive} disabled={markReceivedMut.isPending} className="bg-green-600 hover:bg-green-700">{markReceivedMut.isPending ? "Processando..." : "Confirmar Recebimento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
