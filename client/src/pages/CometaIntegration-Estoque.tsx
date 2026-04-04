import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle, CheckCircle, RefreshCw, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type EstoqueItem = {
  id: string;
  codigo_produto: string;
  nome: string;
  ean: string;
  loja: string;
  loja_numero: number;
  quantidade: number;
  quantidade_avaria: number;
  status: string;
};

export default function CometaEstoque() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [lojaFilter, setLojaFilter] = useState("todas");

  const { data: estoque = [], isLoading, refetch, isFetching } = trpc.cometa.estoque.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Dados de estoque atualizados!");
    },
    onError: () => {
      toast.error("Erro ao atualizar dados.");
    },
  });

  const lojas = Array.from(new Set(estoque.map((item: EstoqueItem) => item.loja))).sort() as string[];

  const filteredStock = estoque.filter((item: EstoqueItem) => {
    const matchFilter = filter === "todos" || item.status === filter;
    const matchLoja = lojaFilter === "todas" || item.loja === lojaFilter;
    const matchSearch = item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.codigo_produto.toLowerCase().includes(search.toLowerCase()) ||
      item.ean.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchLoja && matchSearch;
  });

  const handleExport = () => {
    toast.success("Estoque exportado para Excel!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "bg-green-100 text-green-800";
      case "baixo": return "bg-yellow-100 text-yellow-800";
      case "zerado": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ok": return "OK";
      case "baixo": return "Baixo";
      case "zerado": return "Zerado";
      default: return status;
    }
  };

  const totalOk = estoque.filter((i: EstoqueItem) => i.status === "ok").length;
  const totalBaixo = estoque.filter((i: EstoqueItem) => i.status === "baixo").length;
  const totalZerado = estoque.filter((i: EstoqueItem) => i.status === "zerado").length;
  const totalAvaria = estoque.reduce((sum: number, i: EstoqueItem) => sum + i.quantidade_avaria, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Estoque Cometa</h1>
          <p className="text-muted-foreground text-sm">Estoque real dos produtos nas lojas do Cometa</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending || isFetching}>
            {(forceSyncMutation.isPending || isFetching) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Itens</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : estoque.length}</div>
            <p className="text-xs text-muted-foreground">Produtos x Lojas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" /> OK
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{isLoading ? "..." : totalOk}</div>
            <p className="text-xs text-muted-foreground">Estoque normal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-600" /> Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{isLoading ? "..." : totalBaixo}</div>
            <p className="text-xs text-muted-foreground">Menos de 10 unidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Zerado / Avaria</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{isLoading ? "..." : totalZerado}</div>
            <p className="text-xs text-muted-foreground">{totalAvaria} un em avaria</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar por produto, codigo ou EAN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="zerado">Zerado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lojaFilter} onValueChange={setLojaFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {lojas.map((loja: string) => (
                  <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posicao de Estoque</CardTitle>
          <CardDescription>
            {isLoading ? "Carregando dados da API do Cometa..." : `${filteredStock.length} item(ns) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Carregando estoque do Cometa...</span>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum item encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Produto</th>
                    <th className="pb-2 font-medium text-muted-foreground hidden sm:table-cell">Codigo</th>
                    <th className="pb-2 font-medium text-muted-foreground hidden sm:table-cell">Loja</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Qtd.</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right hidden md:table-cell">Avaria</th>
                    <th className="pb-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((item: EstoqueItem) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="py-2">
                        <div>
                          <p className="font-medium">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">EAN: {item.ean}</p>
                        </div>
                      </td>
                      <td className="py-2 text-muted-foreground hidden sm:table-cell">{item.codigo_produto}</td>
                      <td className="py-2 hidden sm:table-cell">{item.loja}</td>
                      <td className="py-2 text-right font-bold">{item.quantidade}</td>
                      <td className="py-2 text-right text-orange-600 hidden md:table-cell">{item.quantidade_avaria > 0 ? item.quantidade_avaria : "-"}</td>
                      <td className="py-2">
                        <Badge className={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
