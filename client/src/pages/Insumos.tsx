import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Plus, Search, ArrowUpDown, Package, AlertTriangle, Edit, Trash2,
  PackagePlus, PackageMinus, Filter, Boxes
} from "lucide-react";

type SortField = "name" | "category" | "currentStock" | "unitPrice";
type SortDir = "asc" | "desc";

export default function InsumosPage() {
  return (
    <DashboardLayout>
      <InsumosContent />
    </DashboardLayout>
  );
}

function InsumosContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [stockFilter, setStockFilter] = useState("todos");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("un");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editUnit, setEditUnit] = useState("un");
  const [editCurrentStock, setEditCurrentStock] = useState("0");
  const [editMinStock, setEditMinStock] = useState("0");
  const [editUnitPrice, setEditUnitPrice] = useState("0");
  const [editNotes, setEditNotes] = useState("");

  // Adjust stock dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustName, setAdjustName] = useState("");

  const utils = trpc.useUtils();
  const { data: insumos = [], isLoading } = trpc.insumos.list.useQuery();
  const { data: categoriesList = [] } = trpc.insumos.categories.useQuery();

  const createMut = trpc.insumos.create.useMutation({
    onSuccess: () => { utils.insumos.invalidate(); toast.success("Insumo criado!"); setCreateOpen(false); resetCreateForm(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = trpc.insumos.update.useMutation({
    onSuccess: () => { utils.insumos.invalidate(); toast.success("Insumo atualizado!"); setEditOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.insumos.delete.useMutation({
    onSuccess: () => { utils.insumos.invalidate(); toast.success("Insumo excluído!"); },
    onError: (e: any) => toast.error(e.message),
  });
  const adjustMut = trpc.insumos.adjustStock.useMutation({
    onSuccess: () => { utils.insumos.invalidate(); toast.success("Estoque ajustado!"); setAdjustOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  function resetCreateForm() {
    setName(""); setCategory(""); setUnit("un"); setCurrentStock("0"); setMinStock("0"); setUnitPrice("0"); setNotes("");
  }

  function handleCreate() {
    if (!name) { toast.error("Informe o nome do insumo"); return; }
    createMut.mutate({ name, category: category || undefined, unit, currentStock, minStock, unitPrice, notes: notes || undefined });
  }

  function openEdit(item: any) {
    setEditId(item.id);
    setEditName(item.name);
    setEditCategory(item.category || "");
    setEditUnit(item.unit || "un");
    setEditCurrentStock(String(item.currentStock));
    setEditMinStock(String(item.minStock));
    setEditUnitPrice(String(item.unitPrice));
    setEditNotes(item.notes || "");
    setEditOpen(true);
  }

  function handleUpdate() {
    if (!editId || !editName) return;
    updateMut.mutate({
      id: editId, name: editName, category: editCategory || null,
      unit: editUnit, currentStock: editCurrentStock, minStock: editMinStock,
      unitPrice: editUnitPrice, notes: editNotes || null,
    });
  }

  function openAdjust(item: any) {
    setAdjustId(item.id); setAdjustName(item.name); setAdjustQty(""); setAdjustReason(""); setAdjustOpen(true);
  }

  function handleAdjust() {
    if (!adjustId || !adjustQty) { toast.error("Informe a quantidade"); return; }
    adjustMut.mutate({ id: adjustId, quantity: Number(adjustQty), reason: adjustReason || undefined });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const fmt = (v: number | string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Filtered and sorted
  const filtered = useMemo(() => {
    let result = [...insumos];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((i: any) =>
        i.name?.toLowerCase().includes(term) ||
        i.category?.toLowerCase().includes(term) ||
        i.notes?.toLowerCase().includes(term)
      );
    }
    if (categoryFilter !== "todos") {
      result = result.filter((i: any) => (i.category || "Sem Categoria") === categoryFilter);
    }
    if (stockFilter === "baixo") {
      result = result.filter((i: any) => Number(i.currentStock) > 0 && Number(i.currentStock) <= Number(i.minStock));
    } else if (stockFilter === "zerado") {
      result = result.filter((i: any) => Number(i.currentStock) <= 0);
    } else if (stockFilter === "normal") {
      result = result.filter((i: any) => Number(i.currentStock) > Number(i.minStock));
    }
    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "category": cmp = (a.category || "").localeCompare(b.category || ""); break;
        case "currentStock": cmp = Number(a.currentStock) - Number(b.currentStock); break;
        case "unitPrice": cmp = Number(a.unitPrice) - Number(b.unitPrice); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [insumos, searchTerm, categoryFilter, stockFilter, sortField, sortDir]);

  // Summary
  const summary = useMemo(() => {
    const total = insumos.length;
    const baixo = insumos.filter((i: any) => Number(i.currentStock) > 0 && Number(i.currentStock) <= Number(i.minStock)).length;
    const zerado = insumos.filter((i: any) => Number(i.currentStock) <= 0).length;
    const valorTotal = insumos.reduce((s: number, i: any) => s + Number(i.currentStock) * Number(i.unitPrice), 0);
    return { total, baixo, zerado, valorTotal };
  }, [insumos]);

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 inline cursor-pointer ${sortField === field ? "text-primary" : "text-muted-foreground"}`} onClick={() => toggleSort(field)} />
  );

  const getStockBadge = (item: any) => {
    const stock = Number(item.currentStock);
    const min = Number(item.minStock);
    if (stock <= 0) return <Badge variant="destructive" className="text-xs">Zerado</Badge>;
    if (stock <= min) return <Badge className="bg-amber-100 text-amber-800 text-xs">Baixo</Badge>;
    return <Badge className="bg-green-100 text-green-800 text-xs">Normal</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Insumos</h1>
          <p className="text-muted-foreground">Gerencie matérias-primas, embalagens, etiquetas e outros insumos</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Insumo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Insumo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Embalagem plástica 1L" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Embalagem" list="cat-list" />
                  <datalist id="cat-list">{categoriesList.map((c: any) => <option key={c} value={c} />)}</datalist>
                </div>
                <div><Label>Unidade</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Unidade (un)</SelectItem>
                      <SelectItem value="kg">Quilograma (kg)</SelectItem>
                      <SelectItem value="g">Grama (g)</SelectItem>
                      <SelectItem value="l">Litro (L)</SelectItem>
                      <SelectItem value="ml">Mililitro (mL)</SelectItem>
                      <SelectItem value="m">Metro (m)</SelectItem>
                      <SelectItem value="cm">Centímetro (cm)</SelectItem>
                      <SelectItem value="rolo">Rolo</SelectItem>
                      <SelectItem value="pct">Pacote</SelectItem>
                      <SelectItem value="cx">Caixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Estoque Atual</Label><Input type="number" step="0.01" value={currentStock} onChange={e => setCurrentStock(e.target.value)} /></div>
                <div><Label>Estoque Mínimo</Label><Input type="number" step="0.01" value={minStock} onChange={e => setMinStock(e.target.value)} /></div>
                <div><Label>Preço Unit. (R$)</Label><Input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleCreate} disabled={createMut.isPending}>{createMut.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nome, categoria..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-[220px]" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {categoriesList.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status Estoque</Label>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="zerado">Zerado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setCategoryFilter("todos"); setStockFilter("todos"); }}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100"><Boxes className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Insumos</p>
                <p className="text-xl font-bold">{summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-xl font-bold text-amber-600">{summary.baixo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100"><Package className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Zerado</p>
                <p className="text-xl font-bold text-red-600">{summary.zerado}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100"><Package className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Valor em Estoque</p>
                <p className="text-xl font-bold text-green-600">{fmt(summary.valorTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando insumos...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Boxes className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-semibold text-lg">Nenhum insumo encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">Cadastre insumos para controlar matérias-primas e custos de produção</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" onClick={() => toggleSort("name")}>
                      Nome <SortIcon field="name" />
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer" onClick={() => toggleSort("category")}>
                      Categoria <SortIcon field="category" />
                    </th>
                    <th className="text-center py-3 px-4 font-medium">Unidade</th>
                    <th className="text-right py-3 px-4 font-medium cursor-pointer" onClick={() => toggleSort("currentStock")}>
                      Estoque <SortIcon field="currentStock" />
                    </th>
                    <th className="text-right py-3 px-4 font-medium">Mínimo</th>
                    <th className="text-right py-3 px-4 font-medium cursor-pointer" onClick={() => toggleSort("unitPrice")}>
                      Preço Unit. <SortIcon field="unitPrice" />
                    </th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.category || "—"}</td>
                      <td className="py-3 px-4 text-center">{item.unit}</td>
                      <td className="py-3 px-4 text-right font-mono">{Number(item.currentStock).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{Number(item.minStock).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">{fmt(item.unitPrice)}</td>
                      <td className="py-3 px-4 text-center">{getStockBadge(item)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAdjust(item)} title="Ajustar estoque">
                            <PackagePlus className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)} title="Editar">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Excluir este insumo?")) deleteMut.mutate({ id: item.id }); }} title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Insumo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label><Input value={editCategory} onChange={e => setEditCategory(e.target.value)} list="cat-list-edit" />
                <datalist id="cat-list-edit">{categoriesList.map((c: any) => <option key={c} value={c} />)}</datalist>
              </div>
              <div><Label>Unidade</Label>
                <Select value={editUnit} onValueChange={setEditUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">Unidade (un)</SelectItem>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="g">Grama (g)</SelectItem>
                    <SelectItem value="l">Litro (L)</SelectItem>
                    <SelectItem value="ml">Mililitro (mL)</SelectItem>
                    <SelectItem value="m">Metro (m)</SelectItem>
                    <SelectItem value="cm">Centímetro (cm)</SelectItem>
                    <SelectItem value="rolo">Rolo</SelectItem>
                    <SelectItem value="pct">Pacote</SelectItem>
                    <SelectItem value="cx">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Estoque Atual</Label><Input type="number" step="0.01" value={editCurrentStock} onChange={e => setEditCurrentStock(e.target.value)} /></div>
              <div><Label>Estoque Mínimo</Label><Input type="number" step="0.01" value={editMinStock} onChange={e => setEditMinStock(e.target.value)} /></div>
              <div><Label>Preço Unit. (R$)</Label><Input type="number" step="0.01" value={editUnitPrice} onChange={e => setEditUnitPrice(e.target.value)} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleUpdate} disabled={updateMut.isPending}>{updateMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajustar Estoque</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Insumo: <strong>{adjustName}</strong></p>
          <div className="space-y-4">
            <div>
              <Label>Quantidade (positivo = entrada, negativo = saída)</Label>
              <Input type="number" step="0.01" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="Ex: 10 ou -5" />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Ex: Compra, Perda, Ajuste inventário" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAdjust} disabled={adjustMut.isPending}>{adjustMut.isPending ? "Ajustando..." : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
