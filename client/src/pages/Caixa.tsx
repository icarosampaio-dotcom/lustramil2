import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown, Search, ArrowUpDown, Filter, BarChart3, Download } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend } from "recharts";

type PeriodType = "mes_atual" | "mes_anterior" | "ultimos_3" | "ultimos_6" | "ano_atual" | "custom";
type SortField = "date" | "description" | "value" | "type";
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

const COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

export default function Caixa() {
  const [period, setPeriod] = useState<PeriodType>("mes_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movType, setMovType] = useState<"entrada" | "saida">("saida");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { start, end } = useMemo(() => getPeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);

  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.cash.list.useQuery({ startDate: start.getTime(), endDate: end.getTime() });
  const { data: summary } = trpc.cash.summary.useQuery({ startDate: start.getTime(), endDate: end.getTime() });
  const { data: byCategory = [] } = trpc.cash.byCategory.useQuery({ startDate: start.getTime(), endDate: end.getTime() });
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: accounts = [] } = trpc.financialAccounts.list.useQuery();
  const [exportRequest, setExportRequest] = useState(false);
  const { data: exportBase64 } = trpc.cash.exportExcel.useQuery(
    { startDate: start.getTime(), endDate: end.getTime() },
    { enabled: exportRequest }
  );

  const createMut = trpc.cash.create.useMutation({
    onSuccess: () => { utils.cash.invalidate(); utils.financialAccounts.invalidate(); toast.success("Movimentação registrada!"); setDialogOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.cash.delete.useMutation({
    onSuccess: () => { utils.cash.invalidate(); utils.financialAccounts.invalidate(); toast.success("Movimentação excluída!"); },
    onError: (e: any) => toast.error(e.message),
  });

  function resetForm() { setDate(new Date().toISOString().slice(0, 10)); setDescription(""); setValue(""); setCategoryId(""); setAccountId(""); setNotes(""); }

  useEffect(() => {
    if (!exportRequest || !exportBase64) return;
    const bin = atob(exportBase64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caixa-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExportRequest(false);
    toast.success("Planilha exportada!");
  }, [exportBase64, exportRequest, start, end]);

  function handleCreate() {
    if (!description || !value || !date) { toast.error("Preencha data, descrição e valor"); return; }
    createMut.mutate({
      date: new Date(date + "T12:00:00").getTime(), type: movType, description, value,
      categoryId: categoryId ? Number(categoryId) : undefined,
      accountId: accountId ? Number(accountId) : undefined,
      notes: notes || undefined,
    });
  }

  function openDialog(type: "entrada" | "saida") { setMovType(type); setDialogOpen(true); }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((i: any) =>
        i.description?.toLowerCase().includes(term) ||
        i.notes?.toLowerCase().includes(term)
      );
    }
    if (typeFilter !== "todos") {
      result = result.filter((i: any) => i.type === typeFilter);
    }
    if (categoryFilter !== "todos") {
      result = result.filter((i: any) => String(i.categoryId) === categoryFilter);
    }
    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case "description": cmp = (a.description || "").localeCompare(b.description || ""); break;
        case "value": cmp = Number(a.value) - Number(b.value); break;
        case "type": cmp = (a.type || "").localeCompare(b.type || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [items, searchTerm, typeFilter, categoryFilter, sortField, sortDir]);

  // Expense pie chart
  const expensesByCategory = useMemo(() => {
    return byCategory.filter((c: any) => c.type === "saida").map((c: any) => ({
      name: c.categoryName, value: c.total,
    }));
  }, [byCategory]);

  // Income pie chart
  const incomeByCategory = useMemo(() => {
    return byCategory.filter((c: any) => c.type === "entrada").map((c: any) => ({
      name: c.categoryName, value: c.total,
    }));
  }, [byCategory]);

  // Daily flow chart
  const dailyFlow = useMemo(() => {
    const map = new Map<string, { date: string; entradas: number; saidas: number }>();
    items.forEach((i: any) => {
      const d = new Date(i.date).toISOString().slice(0, 10);
      if (!map.has(d)) map.set(d, { date: d, entradas: 0, saidas: 0 });
      const entry = map.get(d)!;
      if (i.type === "entrada") entry.entradas += Number(i.value);
      else entry.saidas += Number(i.value);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      dateLabel: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }),
    }));
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
          <h1 className="text-2xl font-bold">Caixa</h1>
          <p className="text-muted-foreground">Movimentação diária de entradas e saídas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportRequest(true)} className="gap-2">
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => openDialog("entrada")}>
            <ArrowDownCircle className="w-4 h-4 mr-2" /> Entrada
          </Button>
          <Button variant="destructive" onClick={() => openDialog("saida")}>
            <ArrowUpCircle className="w-4 h-4 mr-2" /> Saída
          </Button>
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
                <SelectContent>{Object.entries(periodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div><Label className="text-xs text-muted-foreground">Data Início</Label><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[160px]" /></div>
                <div><Label className="text-xs text-muted-foreground">Data Fim</Label><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[160px]" /></div>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-[220px]" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9">
              <Filter className="w-4 h-4 mr-1" /> Mais Filtros
            </Button>
          </div>
          {showFilters && (
            <div className="flex flex-wrap gap-4 items-end mt-4 pt-4 border-t">
              <div>
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setTypeFilter("todos"); setCategoryFilter("todos"); }}>
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100"><TrendingUp className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Entradas</p>
                <p className="text-xl font-bold text-green-600">{fmt(summary?.entradas || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Saídas</p>
                <p className="text-xl font-bold text-red-600">{fmt(summary?.saidas || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100"><Wallet className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo do Período</p>
                <p className={`text-xl font-bold ${(summary?.saldo || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(summary?.saldo || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saldo das contas */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {accounts.map((acc: any) => (
            <Card key={acc.id}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{acc.type === "caixa" ? "💵" : acc.type === "conta_corrente" ? "🏦" : acc.type === "cartao" ? "💳" : "🏧"} {acc.name}</p>
                <p className={`text-lg font-bold ${Number(acc.currentBalance) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(Number(acc.currentBalance))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Gráfico de fluxo diário */}
      {dailyFlow.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Fluxo Diário</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyFlow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <ReTooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela de movimentações */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Movimentações ({filteredItems.length} de {items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("date")}>Data <SortIcon field="date" /></th>
                      <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("description")}>Descrição <SortIcon field="description" /></th>
                      <th className="pb-2 font-medium">Categoria</th>
                      <th className="pb-2 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("type")}>Tipo <SortIcon field="type" /></th>
                      <th className="pb-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("value")}>Valor <SortIcon field="value" /></th>
                      <th className="pb-2 font-medium text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item: any) => {
                      const catName = categories.find((c: any) => c.id === item.categoryId)?.name;
                      return (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="py-2">{fmtDate(item.date)}</td>
                          <td className="py-2">
                            <div>{item.description}</div>
                            {item.notes && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</div>}
                          </td>
                          <td className="py-2">
                            {catName ? <span className="px-2 py-0.5 rounded bg-muted text-xs">{catName}</span> : <span className="text-muted-foreground text-xs">-</span>}
                          </td>
                          <td className="py-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.type === "entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                              {item.type === "entrada" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className={`py-2 text-right font-medium ${item.type === "entrada" ? "text-green-600" : "text-red-600"}`}>
                            {item.type === "entrada" ? "+" : "-"}{fmt(Number(item.value))}
                          </td>
                          <td className="py-2 text-center">
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("Excluir?")) deleteMut.mutate({ id: item.id }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
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

        {/* Gráficos por categoria */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Saídas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {expensesByCategory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {expensesByCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <ReTooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Entradas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {incomeByCategory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={incomeByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {incomeByCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <ReTooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog nova movimentação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{movType === "entrada" ? "Nova Entrada" : "Nova Saída"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Data *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Descrição *</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Pagamento fornecedor" /></div>
            <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleCreate} disabled={createMut.isPending} className={movType === "entrada" ? "bg-green-600 hover:bg-green-700" : ""}>
              {createMut.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
