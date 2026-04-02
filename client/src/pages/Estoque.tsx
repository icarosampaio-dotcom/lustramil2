import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Search,
  AlertTriangle,
  Pencil,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Barcode,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  X,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  PackageX,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 24;

type SortField = "name" | "stock" | "price" | "category";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "low" | "normal" | "zero";
type ViewMode = "grid" | "table";

export default function EstoquePage() {
  return (
    <DashboardLayout>
      <EstoqueContent />
    </DashboardLayout>
  );
}

function EstoqueContent() {
  const { data: products, isLoading } = trpc.products.list.useQuery();
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!products) return { total: 0, lowStock: 0, zeroStock: 0, totalValue: 0 };
    let lowStock = 0;
    let zeroStock = 0;
    let totalValue = 0;

    products.forEach((p) => {
      const stock = parseFloat(String(p.currentStock));
      const min = parseFloat(String(p.minStock));
      const price = parseFloat(String(p.lastPrice || 0));
      totalValue += stock * price;
      if (stock <= 0) zeroStock++;
      else if (min > 0 && stock <= min) lowStock++;
    });

    return { total: products.length, lowStock, zeroStock, totalValue };
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = [...products];

    // Text search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.category && p.category.toLowerCase().includes(lower)) ||
          (p.reference && p.reference.toLowerCase().includes(lower)) ||
          (p.barcode && p.barcode.toLowerCase().includes(lower))
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => {
        const stock = parseFloat(String(p.currentStock));
        const min = parseFloat(String(p.minStock));
        if (statusFilter === "zero") return stock <= 0;
        if (statusFilter === "low") return min > 0 && stock > 0 && stock <= min;
        if (statusFilter === "normal") return stock > 0 && (min <= 0 || stock > min);
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name, "pt-BR");
          break;
        case "stock":
          cmp = parseFloat(String(a.currentStock)) - parseFloat(String(b.currentStock));
          break;
        case "price":
          cmp = parseFloat(String(a.lastPrice || 0)) - parseFloat(String(b.lastPrice || 0));
          break;
        case "category":
          cmp = (a.category || "").localeCompare(b.category || "", "pt-BR");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [products, search, categoryFilter, statusFilter, sortField, sortDir]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const hasActiveFilters = categoryFilter !== "all" || statusFilter !== "all" || search !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Controle de estoque em tempo real dos seus produtos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setStatusFilter("all"); setCategoryFilter("all"); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{summaryStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setStatusFilter("low")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                <p className="text-lg font-bold text-orange-600">{summaryStats.lowStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setStatusFilter("zero")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center">
                <PackageX className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Zerado</p>
                <p className="text-lg font-bold text-red-600">{summaryStats.zeroStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-sm font-bold text-violet-600">{formatCurrency(summaryStats.totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, referência, código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            className="gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {(categoryFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="min-w-[180px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Categorias</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="normal">Estoque Normal</SelectItem>
                      <SelectItem value="low">Estoque Baixo</SelectItem>
                      <SelectItem value="zero">Estoque Zerado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Ordenar por</Label>
                  <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => {
                    const [field, dir] = v.split("-") as [SortField, SortDir];
                    setSortField(field);
                    setSortDir(dir);
                  }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                      <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                      <SelectItem value="stock-asc">Menor Estoque</SelectItem>
                      <SelectItem value="stock-desc">Maior Estoque</SelectItem>
                      <SelectItem value="price-asc">Menor Preço</SelectItem>
                      <SelectItem value="price-desc">Maior Preço</SelectItem>
                      <SelectItem value="category-asc">Categoria (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        setCategoryFilter("all");
                        setStatusFilter("all");
                        setSearch("");
                        setSortField("name");
                        setSortDir("asc");
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredProducts.length} produto(s) encontrado(s)
          {hasActiveFilters && " (filtrado)"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : paginatedProducts.length > 0 ? (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={() => setEditingProduct(product)}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-left p-3 font-medium">Categoria</th>
                      <th className="text-left p-3 font-medium">Referência</th>
                      <th className="text-left p-3 font-medium">Cód. Barras</th>
                      <th className="text-right p-3 font-medium">Estoque</th>
                      <th className="text-right p-3 font-medium">Mínimo</th>
                      <th className="text-right p-3 font-medium">Últ. Preço</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-center p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => {
                      const stock = parseFloat(String(product.currentStock));
                      const min = parseFloat(String(product.minStock));
                      const isLow = min > 0 && stock > 0 && stock <= min;
                      const isZero = stock <= 0;
                      const pct = min > 0 ? Math.min(100, (stock / min) * 100) : (stock > 0 ? 100 : 0);

                      return (
                        <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{product.name}</td>
                          <td className="p-3 text-muted-foreground">{product.category || "—"}</td>
                          <td className="p-3 text-blue-600 text-xs">{product.reference || "—"}</td>
                          <td className="p-3 text-emerald-600 text-xs font-mono">{product.barcode || "—"}</td>
                          <td className="p-3 text-right font-semibold">
                            {stock.toFixed(stock % 1 === 0 ? 0 : 2)} {product.unit}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {min > 0 ? `${min.toFixed(0)} ${product.unit}` : "—"}
                          </td>
                          <td className="p-3 text-right">{formatCurrency(product.lastPrice)}</td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge
                                variant={isZero ? "destructive" : isLow ? "default" : "secondary"}
                                className={`text-xs ${!isZero && !isLow ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}
                              >
                                {isZero ? "Zerado" : isLow ? "Baixo" : "Normal"}
                              </Badge>
                              {min > 0 && (
                                <div className="w-16 bg-muted rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      isZero ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingProduct(product)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredProducts.length} produtos)
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
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters
                ? "Tente ajustar os filtros ou buscar com outros termos"
                : "Os produtos serão cadastrados automaticamente ao processar notas fiscais"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setCategoryFilter("all");
                  setStatusFilter("all");
                  setSearch("");
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Product Dialog */}
      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  formatCurrency,
}: {
  product: any;
  onEdit: () => void;
  formatCurrency: (v: any) => string;
}) {
  const stock = parseFloat(String(product.currentStock));
  const minStock = parseFloat(String(product.minStock));
  const isLow = minStock > 0 && stock > 0 && stock <= minStock;
  const isZero = stock <= 0;
  const pct = minStock > 0 ? Math.min(100, (stock / minStock) * 100) : (stock > 0 ? 100 : 0);

  return (
    <Card className={`hover:shadow-md transition-all ${isZero ? "border-red-200" : isLow ? "border-orange-200" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{product.name}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {product.category && (
                <Badge variant="outline" className="text-xs font-normal">{product.category}</Badge>
              )}
              {product.reference && (
                <span className="text-xs text-blue-600">Ref: {product.reference}</span>
              )}
            </div>
            {product.barcode && (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                <Barcode className="h-3 w-3" />
                {product.barcode}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {isZero && <PackageX className="h-4 w-4 text-red-500" />}
            {isLow && !isZero && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className={`text-2xl font-bold ${isZero ? "text-red-600" : isLow ? "text-orange-600" : ""}`}>
              {stock.toFixed(stock % 1 === 0 ? 0 : 2)}
            </p>
            <p className="text-xs text-muted-foreground">{product.unit}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Último preço</p>
            <p className="text-sm font-medium">{formatCurrency(product.lastPrice)}</p>
          </div>
        </div>

        {/* Progress bar */}
        {minStock > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                Estoque mín: {minStock.toFixed(0)} {product.unit}
              </span>
              <Badge
                variant={isZero ? "destructive" : isLow ? "default" : "secondary"}
                className={`text-xs ${!isZero && !isLow ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}
              >
                {isZero ? "Zerado" : isLow ? "Baixo" : "Normal"}
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isZero ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditProductDialog({
  product,
  onClose,
}: {
  product: any;
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name || "");
  const [category, setCategory] = useState(product.category || "");
  const [unit, setUnit] = useState(product.unit || "un");
  const [reference, setReference] = useState(product.reference || "");
  const [barcode, setBarcode] = useState(product.barcode || "");
  const [minStock, setMinStock] = useState(
    product.minStock ? String(parseFloat(String(product.minStock))) : "0"
  );

  const utils = trpc.useUtils();
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!");
      utils.products.list.invalidate();
      utils.dashboard.lowStock.invalidate();
      utils.dashboard.stats.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao atualizar produto");
    },
  });

  const handleSave = () => {
    const minStockNum = parseFloat(minStock);
    if (isNaN(minStockNum) || minStockNum < 0) {
      toast.error("O estoque mínimo deve ser um número maior ou igual a zero.");
      return;
    }
    if (!name.trim()) {
      toast.error("O nome do produto é obrigatório.");
      return;
    }

    updateMutation.mutate({
      id: product.id,
      name: name.trim(),
      category: category.trim() || undefined,
      unit: unit.trim() || undefined,
      minStock: minStockNum,
      reference: reference.trim() || null,
      barcode: barcode.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome do Produto</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Detergente Líquido 500ml"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Categoria</Label>
              <Input
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Detergentes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unidade</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ex: un, kg, lt"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reference">Referência (cProd da NF)</Label>
            <Input
              id="edit-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: 001234"
            />
            <p className="text-xs text-muted-foreground">
              Código do produto na nota fiscal. Preenchido automaticamente ao processar NF.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-barcode">Código de Barras</Label>
            <Input
              id="edit-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Ex: 7891234567890"
            />
            <p className="text-xs text-muted-foreground">
              Cadastre manualmente o código de barras do produto (EAN/GTIN).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-minstock">Estoque Mínimo</Label>
            <Input
              id="edit-minstock"
              type="number"
              min="0"
              step="1"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Um alerta será exibido no dashboard quando o estoque atingir este valor.
              Defina como 0 para desativar o alerta.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estoque atual</span>
              <span className="font-semibold">
                {parseFloat(String(product.currentStock)).toFixed(
                  parseFloat(String(product.currentStock)) % 1 === 0 ? 0 : 2
                )}{" "}
                {product.unit}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
