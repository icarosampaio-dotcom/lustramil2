import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const mockStock = [
  { id: "PROD-001", nome: "Detergente Neutro 500ml", loja: "Centro", quantidade: 245, minimo: 50, status: "ok" },
  { id: "PROD-002", nome: "Desinfetante 1L", loja: "Centro", quantidade: 12, minimo: 100, status: "baixo" },
  { id: "PROD-003", nome: "Sabonete Líquido 250ml", loja: "Norte", quantidade: 0, minimo: 30, status: "zerado" },
  { id: "PROD-004", nome: "Álcool 70% 1L", loja: "Sul", quantidade: 156, minimo: 100, status: "ok" },
  { id: "PROD-005", nome: "Pano de Limpeza", loja: "Leste", quantidade: 45, minimo: 80, status: "baixo" },
];

export default function CometaEstoque() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const filteredStock = mockStock.filter(item => {
    const matchFilter = filter === "todos" || item.status === filter;
    const matchSearch = item.nome.toLowerCase().includes(search.toLowerCase()) ||
                       item.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleExport = () => {
    toast.success("✅ Estoque exportado para Excel!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-green-100 text-green-800";
      case "baixo":
        return "bg-yellow-100 text-yellow-800";
      case "zerado":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ok":
        return "✅ OK";
      case "baixo":
        return "⚠️ Baixo";
      case "zerado":
        return "❌ Zerado";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Estoque Cometa</h1>
          <p className="text-muted-foreground">Monitore o estoque disponível nas lojas</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Produtos em Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStock.filter(s => s.status === "ok").length}</div>
            <p className="text-xs text-muted-foreground">Acima do mínimo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mockStock.filter(s => s.status === "baixo").length}</div>
            <p className="text-xs text-muted-foreground">Abaixo do mínimo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Zerado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mockStock.filter(s => s.status === "zerado").length}</div>
            <p className="text-xs text-muted-foreground">Sem estoque</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStock.reduce((acc, s) => acc + s.quantidade, 0)}</div>
            <p className="text-xs text-muted-foreground">Unidades em estoque</p>
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
              placeholder="Buscar por produto ou código..."
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
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="baixo">Estoque Baixo</SelectItem>
              <SelectItem value="zerado">Zerado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estoque por Produto</CardTitle>
          <CardDescription>{filteredStock.length} produto(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <p className="font-semibold">{item.nome}</p>
                  <p className="text-sm text-muted-foreground">{item.id} • {item.loja}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">{item.quantidade} un</p>
                    <p className="text-xs text-muted-foreground">Mín: {item.minimo}</p>
                  </div>

                  <div className="w-24">
                    <div className="bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.status === "ok" ? "bg-green-500" :
                          item.status === "baixo" ? "bg-yellow-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${Math.min((item.quantidade / item.minimo) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <Badge className={getStatusColor(item.status)}>
                    {getStatusLabel(item.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alertas de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockStock.filter(s => s.status !== "ok").map((item) => (
              <div key={item.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-medium text-sm">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.status === "zerado" ? "Sem estoque" : `Apenas ${item.quantidade} un (mín: ${item.minimo})`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Produtos em Ordem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockStock.filter(s => s.status === "ok").map((item) => (
              <div key={item.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-sm">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantidade} un em estoque
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
