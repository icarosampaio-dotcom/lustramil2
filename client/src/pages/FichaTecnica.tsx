import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Search, ArrowUpDown, Plus, Trash2, ClipboardList, DollarSign,
  TrendingUp, Package, Percent, Calculator
} from "lucide-react";

type SortField = "name" | "reference" | "cost" | "price" | "margin";
type SortDir = "asc" | "desc";

export default function FichaTecnicaPage() {
  return (
    <DashboardLayout>
      <FichaTecnicaContent />
    </DashboardLayout>
  );
}

function FichaTecnicaContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addInsumoId, setAddInsumoId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addNotes, setAddNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: insumos = [] } = trpc.insumos.list.useQuery();
  const { data: allCosts = [] } = trpc.fichaTecnica.allCosts.useQuery();

  const { data: fichaItems = [] } = trpc.fichaTecnica.list.useQuery(
    { productId: selectedProductId! },
    { enabled: !!selectedProductId }
  );
  const { data: productCost } = trpc.fichaTecnica.productCost.useQuery(
    { productId: selectedProductId! },
    { enabled: !!selectedProductId }
  );

  const addMut = trpc.fichaTecnica.add.useMutation({
    onSuccess: () => {
      utils.fichaTecnica.invalidate();
      toast.success("Insumo adicionado à ficha técnica!");
      setAddItemOpen(false);
      setAddInsumoId(""); setAddQty(""); setAddNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.fichaTecnica.delete.useMutation({
    onSuccess: () => { utils.fichaTecnica.invalidate(); toast.success("Item removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  function handleAddItem() {
    if (!selectedProductId || !addInsumoId || !addQty) {
      toast.error("Selecione o insumo e informe a quantidade");
      return;
    }
    addMut.mutate({
      productId: selectedProductId,
      insumoId: Number(addInsumoId),
      quantityPerUnit: addQty,
      notes: addNotes || undefined,
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const fmt = (v: number | string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Merge products with costs
  const productsWithCosts = useMemo(() => {
    const costMap = new Map<number, number>();
    allCosts.forEach((c: any) => costMap.set(c.productId, c.totalCost));

    return products.map((p: any) => ({
      ...p,
      productionCost: costMap.get(p.id) || 0,
      salePrice: Number(p.lastPrice) || 0,
      margin: (() => {
        const cost = costMap.get(p.id) || 0;
        const price = Number(p.lastPrice) || 0;
        if (price === 0) return 0;
        return ((price - cost) / price) * 100;
      })(),
    }));
  }, [products, allCosts]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...productsWithCosts];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((p: any) =>
        p.name?.toLowerCase().includes(term) ||
        p.reference?.toLowerCase().includes(term)
      );
    }
    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "reference": cmp = (a.reference || "").localeCompare(b.reference || ""); break;
        case "cost": cmp = a.productionCost - b.productionCost; break;
        case "price": cmp = a.salePrice - b.salePrice; break;
        case "margin": cmp = a.margin - b.margin; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [productsWithCosts, searchTerm, sortField, sortDir]);

  // Summary
  const summary = useMemo(() => {
    const withCost = productsWithCosts.filter(p => p.productionCost > 0);
    const avgMargin = withCost.length > 0 ? withCost.reduce((s, p) => s + p.margin, 0) / withCost.length : 0;
    return {
      totalProducts: products.length,
      withFicha: withCost.length,
      avgMargin,
    };
  }, [productsWithCosts, products]);

  const selectedProduct = products.find((p: any) => p.id === selectedProductId);

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 inline cursor-pointer ${sortField === field ? "text-primary" : "text-muted-foreground"}`} onClick={() => toggleSort(field)} />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ficha Técnica / Custo de Produção</h1>
        <p className="text-muted-foreground">Vincule insumos a cada produto e calcule o custo de produção</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100"><Package className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Produtos</p>
                <p className="text-xl font-bold">{summary.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100"><ClipboardList className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Com Ficha Técnica</p>
                <p className="text-xl font-bold text-green-600">{summary.withFicha}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-violet-100"><Percent className="w-5 h-5 text-violet-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Margem Média</p>
                <p className="text-xl font-bold text-violet-600">{summary.avgMargin.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Buscar Produto</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nome ou referência..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-[280px]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products list with costs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Produtos — Custo vs Preço de Venda</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b sticky top-0">
                  <tr>
                    <th className="text-left py-2.5 px-3 font-medium cursor-pointer" onClick={() => toggleSort("name")}>
                      Produto <SortIcon field="name" />
                    </th>
                    <th className="text-right py-2.5 px-3 font-medium cursor-pointer" onClick={() => toggleSort("cost")}>
                      Custo <SortIcon field="cost" />
                    </th>
                    <th className="text-right py-2.5 px-3 font-medium cursor-pointer" onClick={() => toggleSort("price")}>
                      Venda <SortIcon field="price" />
                    </th>
                    <th className="text-right py-2.5 px-3 font-medium cursor-pointer" onClick={() => toggleSort("margin")}>
                      Margem <SortIcon field="margin" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: any) => (
                    <tr
                      key={p.id}
                      className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${selectedProductId === p.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      onClick={() => setSelectedProductId(p.id)}
                    >
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.reference && <p className="text-xs text-muted-foreground">Ref: {p.reference}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {p.productionCost > 0 ? (
                          <span className="font-mono text-sm">{fmt(p.productionCost)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem ficha</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm">{fmt(p.salePrice)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {p.productionCost > 0 ? (
                          <Badge className={`text-xs ${p.margin >= 30 ? "bg-green-100 text-green-800" : p.margin >= 15 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                            {p.margin.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Ficha técnica detail */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {selectedProduct ? (
                  <>Ficha Técnica: <span className="text-primary">{selectedProduct.name}</span></>
                ) : (
                  "Selecione um produto"
                )}
              </CardTitle>
              {selectedProductId && (
                <Button size="sm" onClick={() => setAddItemOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Insumo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedProductId ? (
              <div className="p-8 text-center">
                <Calculator className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">Clique em um produto à esquerda para ver e editar sua ficha técnica</p>
              </div>
            ) : fichaItems.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="font-semibold">Nenhum insumo vinculado</h3>
                <p className="text-sm text-muted-foreground mt-1">Adicione insumos para calcular o custo de produção</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Insumo</th>
                        <th className="text-right py-2 px-3 font-medium">Qtd/Unid.</th>
                        <th className="text-right py-2 px-3 font-medium">Preço Unit.</th>
                        <th className="text-right py-2 px-3 font-medium">Subtotal</th>
                        <th className="text-right py-2 px-3 font-medium w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fichaItems.map((item: any) => {
                        const subtotal = Number(item.quantityPerUnit) * Number(item.insumoPrice || 0);
                        return (
                          <tr key={item.id} className="border-b">
                            <td className="py-2 px-3">
                              <p className="font-medium">{item.insumoName}</p>
                              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{Number(item.quantityPerUnit).toFixed(4)} {item.insumoUnit || ""}</td>
                            <td className="py-2 px-3 text-right">{fmt(item.insumoPrice || 0)}</td>
                            <td className="py-2 px-3 text-right font-medium">{fmt(subtotal)}</td>
                            <td className="py-2 px-3 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover este insumo da ficha?")) deleteMut.mutate({ id: item.id }); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cost summary */}
                {productCost && (
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custo de Produção (insumos):</span>
                      <span className="font-bold">{fmt(productCost.totalCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Preço de Venda:</span>
                      <span className="font-bold">{fmt(selectedProduct?.lastPrice || 0)}</span>
                    </div>
                    <hr className="border-border" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lucro Bruto por Unidade:</span>
                      <span className={`font-bold ${Number(selectedProduct?.lastPrice || 0) - productCost.totalCost >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(Number(selectedProduct?.lastPrice || 0) - productCost.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margem:</span>
                      {(() => {
                        const price = Number(selectedProduct?.lastPrice || 0);
                        const margin = price > 0 ? ((price - productCost.totalCost) / price) * 100 : 0;
                        return (
                          <Badge className={`${margin >= 30 ? "bg-green-100 text-green-800" : margin >= 15 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                            {margin.toFixed(1)}%
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Insumo Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Insumo à Ficha Técnica</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Insumo *</Label>
              <Select value={addInsumoId} onValueChange={setAddInsumoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                <SelectContent>
                  {insumos.map((i: any) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name} ({i.unit}) — {Number(i.unitPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade por unidade produzida *</Label>
              <Input type="number" step="0.0001" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Ex: 0.5" />
              <p className="text-xs text-muted-foreground mt-1">Quanto desse insumo é usado para produzir 1 unidade do produto</p>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Ex: Embalagem principal" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAddItem} disabled={addMut.isPending}>{addMut.isPending ? "Adicionando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
