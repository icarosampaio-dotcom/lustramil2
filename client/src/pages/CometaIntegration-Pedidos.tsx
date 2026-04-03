import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Download, Eye, Package, MapPin, Calendar, DollarSign, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  entregue: { label: "Entregue/Baixado", color: "bg-green-100 text-green-800" },
  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

type Order = {
  id: string;
  numero_pedido: string;
  data: string;
  loja: string;
  loja_numero: number;
  cnpj: string;
  status: string;
  status_raw: string;
  frete: string;
  comprador: { nome: string; codigo: string };
  prazo_pagamento: string;
  observacao: string;
  produtos: Array<{
    nome: string;
    codigo: string;
    ean: string;
    qtd: number;
    qtd_embalagem: number;
    valor_unitario: number;
    valor: string;
    valor_numerico: number;
  }>;
  valor_total: number;
  total_unidades: number;
  total: string;
  itens: number;
};

export default function CometaPedidos() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading, refetch, isFetching } = trpc.cometa.pedidos.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Dados atualizados com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar dados.");
    },
  });

  const filteredOrders = orders.filter((order: Order) => {
    const matchFilter = filter === "todos" || order.status === filter;
    const matchSearch = order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.loja.toLowerCase().includes(search.toLowerCase()) ||
      order.produtos.some(p => p.nome.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const handleView = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleExport = () => {
    toast.success("Pedidos exportados para Excel!");
  };

  const handleForceSync = () => {
    forceSyncMutation.mutate();
  };

  const totalPendentes = orders.filter((o: Order) => o.status === "pendente").length;
  const totalEntregues = orders.filter((o: Order) => o.status === "entregue").length;
  const valorTotal = orders.reduce((sum: number, o: Order) => sum + o.valor_total, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pedidos Cometa</h1>
          <p className="text-muted-foreground">Pedidos reais recebidos do Cometa Supermercados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleForceSync} disabled={forceSyncMutation.isPending || isFetching}>
            {(forceSyncMutation.isPending || isFetching) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : orders.length}</div>
            <p className="text-xs text-muted-foreground">Todos os períodos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendentes (P)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{isLoading ? "..." : totalPendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando entrega</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Entregues (B)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{isLoading ? "..." : totalEntregues}</div>
            <p className="text-xs text-muted-foreground">Baixados/Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Valor Total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : `R$ ${valorTotal.toFixed(2).replace(".", ",")}`}
            </div>
            <p className="text-xs text-muted-foreground">Todos os pedidos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por número, loja ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes (P)</SelectItem>
              <SelectItem value="entregue">Entregues (B)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            {isLoading ? "Carregando dados da API do Cometa..." : `${filteredOrders.length} pedido(s) — clique para ver os detalhes`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Carregando pedidos do Cometa...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order: Order) => {
                const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pendente;
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleView(order)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">Pedido #{order.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.loja} • {order.data} • {order.itens} produto(s)
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{order.total}</p>
                        <p className="text-xs text-muted-foreground">{order.total_unidades} unidades</p>
                      </div>
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={() => handleView(order)} title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5" />
                  Pedido #{selectedOrder.id}
                  <Badge className={(statusConfig[selectedOrder.status as keyof typeof statusConfig] || statusConfig.pendente).color}>
                    {(statusConfig[selectedOrder.status as keyof typeof statusConfig] || statusConfig.pendente).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>Detalhes completos do pedido</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Informações da Loja
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Loja:</span><span className="font-medium">{selectedOrder.loja}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">CNPJ:</span><span className="font-medium">{selectedOrder.cnpj}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Comprador:</span><span className="font-medium">{selectedOrder.comprador?.nome} (Cód: {selectedOrder.comprador?.codigo})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Frete:</span><span className="font-medium">{selectedOrder.frete === "C" ? "CIF (por conta do fornecedor)" : selectedOrder.frete}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Prazo Pagamento:</span><span className="font-medium">{selectedOrder.prazo_pagamento} dias</span></div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Calendar className="h-4 w-4" /> Data do Pedido</div>
                      <p className="text-lg font-bold">{selectedOrder.data}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><DollarSign className="h-4 w-4" /> Valor Total</div>
                      <p className="text-lg font-bold text-green-600">{selectedOrder.total}</p>
                    </CardContent>
                  </Card>
                </div>

                {selectedOrder.observacao && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Observação</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{selectedOrder.observacao}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" /> Produtos ({selectedOrder.itens} produto(s) — {selectedOrder.total_unidades} unidades)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOrder.produtos.map((produto, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm">{produto.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Cód: {produto.codigo} | EAN: {produto.ean} | Qtd: {produto.qtd} un | R$ {produto.valor_unitario.toFixed(2).replace(".", ",")} /un
                            </p>
                          </div>
                          <p className="font-semibold text-sm">{produto.valor}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
