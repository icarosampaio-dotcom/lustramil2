import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ShoppingCart, Package, TrendingUp, Store } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function CometaDashboard() {
  const { data: pedidos = [], isLoading: loadingPedidos } = trpc.cometa.pedidos.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: estoque = [], isLoading: loadingEstoque } = trpc.cometa.estoque.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: vendas = [], isLoading: loadingVendas } = trpc.cometa.vendas.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso!");
    },
  });

  const isLoading = loadingPedidos || loadingEstoque || loadingVendas;

  const totalPedidos = pedidos.length;
  const pedidosPendentes = pedidos.filter((p: any) => p.status === "pendente").length;
  const valorTotalPedidos = pedidos.reduce((sum: number, p: any) => sum + p.valor_total, 0);

  const totalVendas = vendas.reduce((sum: number, v: any) => sum + v.total_venda, 0);
  const totalLojas = vendas.length;

  const estoqueZerado = estoque.filter((e: any) => e.status === "zerado").length;
  const estoqueBaixo = estoque.filter((e: any) => e.status === "baixo").length;

  const topVendasLojas = vendas
    .map((v: any) => ({
      loja: v.nome_loja.replace(/^\d+ - /, "").substring(0, 15),
      vendas: parseFloat(v.total_venda.toFixed(2)),
    }))
    .sort((a: any, b: any) => b.vendas - a.vendas)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard Cometa</h1>
          <p className="text-muted-foreground text-sm">Visao geral da integracao com o Cometa Supermercados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending}>
          {forceSyncMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar Dados
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <span className="ml-4 text-lg text-muted-foreground">Carregando dados do Cometa...</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600" /> Pedidos Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold">{totalPedidos}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pedidosPendentes} pendentes - R$ {valorTotalPedidos.toFixed(2).replace(".", ",")} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" /> Total de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-green-600">
                  R$ {totalVendas.toFixed(2).replace(".", ",")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{totalLojas} lojas com vendas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-600" /> Alertas de Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-orange-600">{estoqueZerado + estoqueBaixo}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {estoqueZerado} zerados - {estoqueBaixo} baixos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Store className="h-4 w-4 text-purple-600" /> Itens em Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold">{estoque.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Produtos x Lojas monitorados</p>
              </CardContent>
            </Card>
          </div>

          {topVendasLojas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Lojas por Vendas (R$)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topVendasLojas} margin={{ top: 5, right: 15, left: 10, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="loja" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, "Vendas"]} />
                    <Bar dataKey="vendas" fill="#22c55e" name="Vendas (R$)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pedidos.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">Pedido #{p.id}</p>
                        <p className="text-xs text-muted-foreground">{p.loja} - {p.data}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{p.total}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "pendente" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                          {p.status === "pendente" ? "Pendente" : "Entregue"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas de Estoque</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {estoque
                    .filter((e: any) => e.status !== "ok")
                    .slice(0, 5)
                    .map((e: any) => (
                      <div key={e.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{e.nome}</p>
                          <p className="text-xs text-muted-foreground">{e.loja}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{e.quantidade} un</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === "zerado" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                            {e.status === "zerado" ? "Zerado" : "Baixo"}
                          </span>
                        </div>
                      </div>
                    ))}
                  {estoque.filter((e: any) => e.status !== "ok").length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Nenhum alerta de estoque</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
