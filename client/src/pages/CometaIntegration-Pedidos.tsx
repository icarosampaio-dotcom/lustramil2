import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Download, Eye, Package, MapPin, Calendar, DollarSign, RefreshCw, Loader2, FileText, FileSpreadsheet, Printer } from "lucide-react";
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

function downloadBase64File(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CometaPedidos() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [relatorioStatus, setRelatorioStatus] = useState<"pendente" | "entregue" | "todos">("pendente");

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

  const exportPDFMutation = trpc.cometa.exportPedidosPDF.useMutation({
    onSuccess: (result) => {
      downloadBase64File(result.base64, result.filename, result.mimeType);
      toast.success("Relatório PDF gerado com sucesso!");
      setShowRelatorioModal(false);
    },
    onError: (err) => {
      toast.error("Erro ao gerar relatório PDF: " + err.message);
    },
  });

  const exportExcelMutation = trpc.cometa.exportPedidosExcel.useMutation({
    onSuccess: (result) => {
      downloadBase64File(result.base64, result.filename, result.mimeType);
      toast.success("Planilha Excel gerada com sucesso!");
      setShowRelatorioModal(false);
    },
    onError: (err) => {
      toast.error("Erro ao gerar planilha: " + err.message);
    },
  });

  const filteredOrders = orders.filter((order: Order) => {
    const matchFilter = filter === "todos" || order.status === filter;
    const matchSearch = order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.loja.toLowerCase().includes(search.toLowerCase()) ||
      order.produtos.some(p => p.nome.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const handleView = (order: Order) => setSelectedOrder(order);
  const handleForceSync = () => forceSyncMutation.mutate();

  const totalPendentes = orders.filter((o: Order) => o.status === "pendente").length;
  const totalEntregues = orders.filter((o: Order) => o.status === "entregue").length;
  const valorTotal = orders.reduce((sum: number, o: Order) => sum + o.valor_total, 0);

  const isExporting = exportPDFMutation.isPending || exportExcelMutation.isPending;

  const statusLabels = {
    pendente: "Pendentes (para separar/produzir)",
    entregue: "Entregues/Baixados",
    todos: "Todos os pedidos",
  };

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
          <Button
            variant="outline"
            onClick={() => setShowRelatorioModal(true)}
            disabled={isLoading || orders.length === 0}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Printer className="h-4 w-4 mr-2" />
            Gerar Relatório
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

      {/* ─── Modal de Relatório ─────────────────────────────────────────────── */}
      <Dialog open={showRelatorioModal} onOpenChange={setShowRelatorioModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              Gerar Relatório de Pedidos
            </DialogTitle>
            <DialogDescription>
              Selecione o tipo de relatório e o formato desejado para download.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Seleção de status */}
            <div>
              <label className="text-sm font-medium mb-2 block">Pedidos a incluir:</label>
              <div className="grid grid-cols-3 gap-2">
                {(["pendente", "entregue", "todos"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setRelatorioStatus(s)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                      relatorioStatus === s
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <div className="font-semibold capitalize">
                      {s === "pendente" ? "⏳ Pendentes" : s === "entregue" ? "✅ Entregues" : "📋 Todos"}
                    </div>
                    <div className="text-xs mt-1 font-normal text-gray-500">
                      {s === "pendente"
                        ? `${totalPendentes} pedido(s)`
                        : s === "entregue"
                        ? `${totalEntregues} pedido(s)`
                        : `${orders.length} pedido(s)`}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Descrição do relatório selecionado */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">📄 O relatório incluirá:</p>
              <ul className="space-y-1 text-xs text-blue-700">
                <li>• Resumo com total de pedidos, unidades e valor</li>
                <li>• <strong>Consolidado por produto</strong> (soma de todas as quantidades)</li>
                <li>• Detalhamento por pedido agrupado por loja</li>
                <li>• Produtos, quantidades, EANs e valores de cada pedido</li>
              </ul>
            </div>

            {/* Botões de download */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => exportPDFMutation.mutate({ filtroStatus: relatorioStatus })}
                disabled={isExporting}
                className="bg-red-600 hover:bg-red-700 text-white h-14 flex-col gap-1"
              >
                {exportPDFMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                <span className="text-xs">
                  {exportPDFMutation.isPending ? "Gerando..." : "Baixar PDF"}
                </span>
              </Button>

              <Button
                onClick={() => exportExcelMutation.mutate({ filtroStatus: relatorioStatus })}
                disabled={isExporting}
                className="bg-green-600 hover:bg-green-700 text-white h-14 flex-col gap-1"
              >
                {exportExcelMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5" />
                )}
                <span className="text-xs">
                  {exportExcelMutation.isPending ? "Gerando..." : "Baixar Excel"}
                </span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              O PDF é ideal para imprimir e entregar à expedição. O Excel permite análise detalhada.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal de Detalhes do Pedido ────────────────────────────────────── */}
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
