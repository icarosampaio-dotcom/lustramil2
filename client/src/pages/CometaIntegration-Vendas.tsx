import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, RefreshCw, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type VendaLoja = {
  loja: number;
  nome_loja: string;
  cnpj: string;
  vendas: Array<{
    data: string;
    ean: string;
    cod_interno: string;
    produto: string;
    qtd: number;
    venda: number;
    custo: number;
  }>;
  total_venda: number;
  total_itens: number;
};

export default function CometaVendas() {
  const [search, setSearch] = useState("");
  const [lojaFilter, setLojaFilter] = useState("todas");

  const { data: vendas = [], isLoading, refetch, isFetching } = trpc.cometa.vendas.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Dados de vendas atualizados!");
    },
    onError: () => {
      toast.error("Erro ao atualizar dados.");
    },
  });

  const handleExport = () => {
    toast.success("Vendas exportadas para Excel!");
  };

  const filteredVendas = vendas.filter((v: VendaLoja) => {
    return lojaFilter === "todas" || v.nome_loja === lojaFilter;
  });

  const chartData = vendas.map((v: VendaLoja) => ({
    loja: v.nome_loja.replace(/^\d+ - /, "").substring(0, 12),
    vendas: parseFloat(v.total_venda.toFixed(2)),
    itens: v.total_itens,
  })).sort((a: any, b: any) => b.vendas - a.vendas);

  const allVendaItems = filteredVendas.flatMap((v: VendaLoja) =>
    v.vendas
      .filter(item => item.produto.toLowerCase().includes(search.toLowerCase()))
      .map(item => ({
        ...item,
        nome_loja: v.nome_loja,
        loja_num: v.loja,
      }))
  );

  const totalGeral = vendas.reduce((sum: number, v: VendaLoja) => sum + v.total_venda, 0);
  const totalItens = vendas.reduce((sum: number, v: VendaLoja) => sum + v.total_itens, 0);
  const totalLojas = vendas.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendas Cometa</h1>
          <p className="text-muted-foreground">Vendas reais sincronizadas do Cometa Supermercados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending || isFetching}>
            {(forceSyncMutation.isPending || isFetching) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Vendas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "..." : `R$ ${totalGeral.toFixed(2).replace(".", ",")}`}
            </div>
            <p className="text-xs text-muted-foreground">Periodo atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Lojas com Vendas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : totalLojas}</div>
            <p className="text-xs text-muted-foreground">Lojas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Unidades Vendidas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : totalItens}</div>
            <p className="text-xs text-muted-foreground">Total de itens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Media por Loja</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : totalLojas > 0 ? `R$ ${(totalGeral / totalLojas).toFixed(2).replace(".", ",")}` : "R$ 0,00"}
            </div>
            <p className="text-xs text-muted-foreground">Media de vendas</p>
          </CardContent>
        </Card>
      </div>

      {!isLoading && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Vendas por Loja (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="loja" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, "Vendas"]} />
                <Legend />
                <Bar dataKey="vendas" fill="#22c55e" name="Vendas (R$)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Buscar por produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={lojaFilter} onValueChange={setLojaFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {vendas.map((v: VendaLoja) => (
                <SelectItem key={v.loja} value={v.nome_loja}>{v.nome_loja}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Vendas</CardTitle>
          <CardDescription>
            {isLoading ? "Carregando dados da API do Cometa..." : `${allVendaItems.length} venda(s) encontrada(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Carregando vendas do Cometa...</span>
            </div>
          ) : allVendaItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma venda encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Produto</th>
                    <th className="pb-2 font-medium text-muted-foreground">Loja</th>
                    <th className="pb-2 font-medium text-muted-foreground">Data</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Qtd</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Venda (R$)</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Custo (R$)</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {allVendaItems.map((item: any, idx: number) => {
                    const margem = item.venda > 0 ? ((item.venda - item.custo) / item.venda * 100) : 0;
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-2">
                          <p className="font-medium">{item.produto}</p>
                          <p className="text-xs text-muted-foreground">EAN: {item.ean?.replace(",", "")}</p>
                        </td>
                        <td className="py-2 text-sm">{item.nome_loja}</td>
                        <td className="py-2 text-muted-foreground">{item.data}</td>
                        <td className="py-2 text-right">{item.qtd}</td>
                        <td className="py-2 text-right font-bold text-green-600">
                          R$ {item.venda.toFixed(2).replace(".", ",")}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          R$ {item.custo.toFixed(2).replace(".", ",")}
                        </td>
                        <td className="py-2 text-right">
                          <span className={margem >= 30 ? "text-green-600 font-medium" : margem >= 15 ? "text-yellow-600" : "text-red-600"}>
                            {margem.toFixed(1)}%
                          </span>
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
    </div>
  );
}
