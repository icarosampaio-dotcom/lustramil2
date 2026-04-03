import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Download, Eye, CheckCircle, Clock, XCircle, Package, MapPin, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";

const mockOrdersData = [
  { id: "COM-001", data: "2026-04-02", loja: "Loja Centro", total: "R$ 1.250,00", status: "pendente", itens: 5, endereco: "Rua das Flores, 123 - Centro", telefone: "(11) 3456-7890", responsavel: "João Silva", produtos: [{ nome: "Sabonete Líquido 5L", qtd: 10, valor: "R$ 250,00" }, { nome: "Desinfetante 2L", qtd: 20, valor: "R$ 400,00" }, { nome: "Detergente 500ml", qtd: 30, valor: "R$ 300,00" }, { nome: "Álcool Gel 1L", qtd: 15, valor: "R$ 225,00" }, { nome: "Água Sanitária 1L", qtd: 25, valor: "R$ 75,00" }] },
  { id: "COM-002", data: "2026-04-02", loja: "Loja Norte", total: "R$ 890,50", status: "confirmado", itens: 3, endereco: "Av. Norte, 456 - Bairro Norte", telefone: "(11) 3456-7891", responsavel: "Maria Santos", produtos: [{ nome: "Sabonete Líquido 5L", qtd: 8, valor: "R$ 200,00" }, { nome: "Desinfetante 2L", qtd: 15, valor: "R$ 300,00" }, { nome: "Detergente 500ml", qtd: 26, valor: "R$ 390,50" }] },
  { id: "COM-003", data: "2026-04-01", loja: "Loja Sul", total: "R$ 2.100,00", status: "entregue", itens: 8, endereco: "Rua Sul, 789 - Bairro Sul", telefone: "(11) 3456-7892", responsavel: "Carlos Oliveira", produtos: [{ nome: "Sabonete Líquido 5L", qtd: 20, valor: "R$ 500,00" }, { nome: "Desinfetante 2L", qtd: 25, valor: "R$ 500,00" }, { nome: "Detergente 500ml", qtd: 40, valor: "R$ 400,00" }, { nome: "Álcool Gel 1L", qtd: 20, valor: "R$ 300,00" }, { nome: "Água Sanitária 1L", qtd: 30, valor: "R$ 90,00" }, { nome: "Limpador Multiuso 1L", qtd: 15, valor: "R$ 150,00" }, { nome: "Amaciante 2L", qtd: 10, valor: "R$ 80,00" }, { nome: "Sabão em Pó 1kg", qtd: 10, valor: "R$ 80,00" }] },
  { id: "COM-004", data: "2026-04-01", loja: "Loja Leste", total: "R$ 450,75", status: "cancelado", itens: 2, endereco: "Av. Leste, 321 - Bairro Leste", telefone: "(11) 3456-7893", responsavel: "Ana Costa", produtos: [{ nome: "Sabonete Líquido 5L", qtd: 5, valor: "R$ 125,00" }, { nome: "Desinfetante 2L", qtd: 16, valor: "R$ 325,75" }] },
  { id: "COM-005", data: "2026-03-31", loja: "Loja Centro", total: "R$ 3.200,00", status: "entregue", itens: 10, endereco: "Rua das Flores, 123 - Centro", telefone: "(11) 3456-7890", responsavel: "João Silva", produtos: [{ nome: "Sabonete Líquido 5L", qtd: 30, valor: "R$ 750,00" }, { nome: "Desinfetante 2L", qtd: 40, valor: "R$ 800,00" }, { nome: "Detergente 500ml", qtd: 50, valor: "R$ 500,00" }, { nome: "Álcool Gel 1L", qtd: 30, valor: "R$ 450,00" }, { nome: "Água Sanitária 1L", qtd: 50, valor: "R$ 150,00" }, { nome: "Limpador Multiuso 1L", qtd: 25, valor: "R$ 250,00" }, { nome: "Amaciante 2L", qtd: 15, valor: "R$ 120,00" }, { nome: "Sabão em Pó 1kg", qtd: 15, valor: "R$ 120,00" }, { nome: "Esponja de Aço", qtd: 100, valor: "R$ 30,00" }, { nome: "Pano de Chão", qtd: 20, valor: "R$ 30,00" }] },
];

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-800" },
  entregue: { label: "Entregue", color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

type Order = typeof mockOrdersData[0];

export default function CometaPedidos() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState(mockOrdersData);

  const filteredOrders = orders.filter(order => {
    const matchFilter = filter === "todos" || order.status === filter;
    const matchSearch = order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.loja.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleView = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleConfirm = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "confirmado" } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status: "confirmado" } : null);
    toast.success(`Pedido ${id} confirmado com sucesso!`);
  };

  const handleCancel = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "cancelado" } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status: "cancelado" } : null);
    toast.error(`Pedido ${id} cancelado.`);
  };

  const handleExport = () => {
    toast.success("Pedidos exportados para Excel!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pedidos Cometa</h1>
          <p className="text-muted-foreground">Gerencie pedidos recebidos do Cometa Supermercados</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{orders.length}</div><p className="text-xs text-muted-foreground">Todos os períodos</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === "pendente").length}</div><p className="text-xs text-muted-foreground">Aguardando ação</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Confirmados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{orders.filter(o => o.status === "confirmado").length}</div><p className="text-xs text-muted-foreground">Em processamento</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Valor Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">R$ 7.890,25</div><p className="text-xs text-muted-foreground">Todos os pedidos</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input placeholder="Buscar por ID ou loja..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="confirmado">Confirmados</SelectItem>
              <SelectItem value="entregue">Entregues</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>{filteredOrders.length} pedido(s) — clique em qualquer pedido para ver os detalhes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
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
                        <p className="font-semibold">{order.id}</p>
                        <p className="text-sm text-muted-foreground">{order.loja} • {order.data}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{order.total}</p>
                      <p className="text-xs text-muted-foreground">{order.itens} itens</p>
                    </div>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => handleView(order)} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {order.status === "pendente" && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleConfirm(order.id)}>Confirmar</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleCancel(order.id)}>Cancelar</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                  Pedido {selectedOrder.id}
                  <Badge className={statusConfig[selectedOrder.status as keyof typeof statusConfig].color}>
                    {statusConfig[selectedOrder.status as keyof typeof statusConfig].label}
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
                    <div className="flex justify-between"><span className="text-muted-foreground">Endereço:</span><span className="font-medium">{selectedOrder.endereco}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Telefone:</span><span className="font-medium">{selectedOrder.telefone}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Responsável:</span><span className="font-medium">{selectedOrder.responsavel}</span></div>
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

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" /> Produtos ({selectedOrder.itens} itens)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOrder.produtos.map((produto, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm">{produto.nome}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {produto.qtd}</p>
                          </div>
                          <p className="font-semibold text-sm">{produto.valor}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selectedOrder.status === "pendente" && (
                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleConfirm(selectedOrder.id)}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Pedido
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleCancel(selectedOrder.id)}>
                      <XCircle className="h-4 w-4 mr-2" /> Cancelar Pedido
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
