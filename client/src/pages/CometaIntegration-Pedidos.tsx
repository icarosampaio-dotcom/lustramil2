import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Download, Eye, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

const mockOrders = [
  { id: "COM-001", data: "2026-04-02", loja: "Loja Centro", total: "R$ 1.250,00", status: "pendente", itens: 5 },
  { id: "COM-002", data: "2026-04-02", loja: "Loja Norte", total: "R$ 890,50", status: "confirmado", itens: 3 },
  { id: "COM-003", data: "2026-04-01", loja: "Loja Sul", total: "R$ 2.100,00", status: "entregue", itens: 8 },
  { id: "COM-004", data: "2026-04-01", loja: "Loja Leste", total: "R$ 450,75", status: "cancelado", itens: 2 },
  { id: "COM-005", data: "2026-03-31", loja: "Loja Centro", total: "R$ 3.200,00", status: "entregue", itens: 12 },
];

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  entregue: { label: "Entregue", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function CometaPedidos() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const filteredOrders = mockOrders.filter(order => {
    const matchFilter = filter === "todos" || order.status === filter;
    const matchSearch = order.id.toLowerCase().includes(search.toLowerCase()) || 
                       order.loja.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleConfirm = (id: string) => {
    toast.success(`✅ Pedido ${id} confirmado!`);
  };

  const handleCancel = (id: string) => {
    toast.error(`❌ Pedido ${id} cancelado!`);
  };

  const handleExport = () => {
    toast.success("✅ Pedidos exportados para Excel!");
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockOrders.length}</div>
            <p className="text-xs text-muted-foreground">Todos os períodos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mockOrders.filter(o => o.status === "pendente").length}</div>
            <p className="text-xs text-muted-foreground">Aguardando ação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{mockOrders.filter(o => o.status === "confirmado").length}</div>
            <p className="text-xs text-muted-foreground">Em processamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 7.890,25</div>
            <p className="text-xs text-muted-foreground">Todos os pedidos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por ID ou loja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
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
          <CardDescription>{filteredOrders.length} pedido(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
              return (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
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

                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>

                      {order.status === "pendente" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleConfirm(order.id)}
                          >
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancel(order.id)}
                          >
                            Cancelar
                          </Button>
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
    </div>
  );
}
