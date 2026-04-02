import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Users, Search, Building2, User, ChevronDown, ChevronRight,
  DollarSign, Package, ArrowUpRight, ArrowDownRight, TrendingUp
} from "lucide-react";
import { useState, useMemo } from "react";

export default function EntidadesPage() {
  return (
    <DashboardLayout>
      <EntidadesContent />
    </DashboardLayout>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EntidadesContent() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "totalValue" | "totalMovements">("totalValue");
  const [expandedEntity, setExpandedEntity] = useState<number | null>(null);

  const { data: entities, isLoading } = trpc.entities.list.useQuery(
    typeFilter !== "all" ? { type: typeFilter as "fornecedor" | "cliente" } : {}
  );

  // Get all movements for summary calculations
  const { data: allMovements } = trpc.reports.movements.useQuery({
    startDate: new Date("2020-01-01"),
    endDate: new Date("2030-12-31"),
  });

  // Calculate totals per entity
  const entitiesWithTotals = useMemo(() => {
    if (!entities) return [];
    const movMap: Record<string, { qtyIn: number; qtyOut: number; valueIn: number; valueOut: number; count: number; products: Record<string, { name: string; reference: string; qty: number; value: number; type: string; lastDate: string }> }> = {};

    if (allMovements) {
      allMovements.forEach((m: any) => {
        const eName = m.entityName;
        if (!eName) return;
        if (!movMap[eName]) movMap[eName] = { qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0, count: 0, products: {} };
        const e = movMap[eName];
        const qty = parseFloat(String(m.quantity));
        const val = parseFloat(String(m.totalPrice || 0));
        e.count++;
        if (m.type === "entrada") { e.qtyIn += qty; e.valueIn += val; }
        else { e.qtyOut += qty; e.valueOut += val; }
        // Products
        const pName = m.productName || "Desconhecido";
        const pKey = `${pName}-${m.type}`;
        if (!e.products[pKey]) {
          e.products[pKey] = { name: pName, reference: (m as any).reference || "", qty: 0, value: 0, type: m.type, lastDate: "" };
        }
        e.products[pKey].qty += qty;
        e.products[pKey].value += val;
        const mDate = m.movementDate ? new Date(m.movementDate).toISOString() : "";
        if (mDate > e.products[pKey].lastDate) e.products[pKey].lastDate = mDate;
      });
    }

    return entities.map((entity) => {
      const mov = movMap[entity.name] || { qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0, count: 0, products: {} };
      const totalValue = mov.valueIn + mov.valueOut;
      const productList = Object.values(mov.products).sort((a, b) => b.value - a.value);
      return { ...entity, ...mov, totalValue, productList };
    });
  }, [entities, allMovements]);

  const filtered = useMemo(() => {
    let result = entitiesWithTotals;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(lower) ||
          (e.document && e.document.toLowerCase().includes(lower))
      );
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "totalValue") return b.totalValue - a.totalValue;
      return b.count - a.count;
    });
    return result;
  }, [entitiesWithTotals, search, sortBy]);

  // Summary cards
  const totalFornecedores = entitiesWithTotals.filter(e => e.type === "fornecedor").length;
  const totalClientes = entitiesWithTotals.filter(e => e.type === "cliente").length;
  const totalCompras = entitiesWithTotals.reduce((s, e) => s + e.valueIn, 0);
  const totalVendas = entitiesWithTotals.reduce((s, e) => s + e.valueOut, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores e Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastrados automaticamente a partir das notas fiscais — com totais de compras e vendas
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Building2 className="h-3.5 w-3.5" /> Fornecedores
            </div>
            <p className="text-2xl font-bold">{totalFornecedores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <User className="h-3.5 w-3.5" /> Clientes
            </div>
            <p className="text-2xl font-bold">{totalClientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" /> Total Compras
            </div>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalCompras)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-orange-600" /> Total Vendas
            </div>
            <p className="text-xl font-bold text-orange-700">{formatCurrency(totalVendas)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="fornecedor">Fornecedores</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalValue">Maior valor total</SelectItem>
            <SelectItem value="totalMovements">Mais movimentações</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entity List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((entity) => {
            const isExpanded = expandedEntity === entity.id;
            return (
              <Card key={entity.id} className={`transition-shadow ${isExpanded ? 'ring-1 ring-primary/30 shadow-md' : 'hover:shadow-md'}`}>
                <CardContent className="p-0">
                  {/* Main row - clickable */}
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedEntity(isExpanded ? null : entity.id)}
                  >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      entity.type === "fornecedor" ? "bg-primary/10" : "bg-violet-50"
                    }`}>
                      {entity.type === "fornecedor" ? (
                        <Building2 className="h-5 w-5 text-primary" />
                      ) : (
                        <User className="h-5 w-5 text-violet-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{entity.name}</p>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {entity.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entity.document || "Documento não informado"} • {entity.count} movimentações
                      </p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      {entity.valueIn > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Compras</p>
                          <p className="text-sm font-semibold text-emerald-700">{formatCurrency(entity.valueIn)}</p>
                        </div>
                      )}
                      {entity.valueOut > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Vendas</p>
                          <p className="text-sm font-semibold text-orange-700">{formatCurrency(entity.valueOut)}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-sm font-bold">{formatCurrency(entity.totalValue)}</p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-primary" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded: product breakdown */}
                  {isExpanded && entity.productList.length > 0 && (
                    <div className="border-t bg-muted/20 px-4 pb-4">
                      <p className="text-xs font-semibold text-muted-foreground py-3 uppercase tracking-wider">
                        Materiais movimentados ({entity.productList.length})
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground text-xs">
                              <th className="text-left py-2 px-2 font-semibold">Material</th>
                              <th className="text-left py-2 px-2 font-semibold">Ref.</th>
                              <th className="text-center py-2 px-2 font-semibold">Tipo</th>
                              <th className="text-right py-2 px-2 font-semibold">Qtd</th>
                              <th className="text-right py-2 px-2 font-semibold">Valor (R$)</th>
                              <th className="text-right py-2 px-2 font-semibold">Última Mov.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entity.productList.map((p, idx) => (
                              <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-2 px-2 font-medium text-xs">{p.name}</td>
                                <td className="py-2 px-2 text-xs text-blue-600">{p.reference || "—"}</td>
                                <td className="py-2 px-2 text-center">
                                  <Badge variant="outline" className={`text-xs ${p.type === "entrada" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-orange-700 border-orange-200 bg-orange-50"}`}>
                                    {p.type === "entrada" ? "Compra" : "Venda"}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-xs">{p.qty.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-mono text-xs font-semibold">{formatCurrency(p.value)}</td>
                                <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                                  {p.lastDate ? new Date(p.lastDate).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-bold text-xs">
                              <td className="py-2 px-2" colSpan={3}>TOTAL</td>
                              <td className="py-2 px-2 text-right font-mono">
                                {entity.productList.reduce((s, p) => s + p.qty, 0).toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {formatCurrency(entity.productList.reduce((s, p) => s + p.value, 0))}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {isExpanded && entity.productList.length === 0 && (
                    <div className="border-t bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação registrada para esta entidade
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg">Nenhum registro encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Tente buscar com outros termos"
                : "Fornecedores e clientes serão cadastrados automaticamente ao processar notas fiscais"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
