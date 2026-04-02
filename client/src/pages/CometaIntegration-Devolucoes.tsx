import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const mockReturns = [
  { id: "DEV-001", data: "2026-04-02", produto: "Detergente Neutro", motivo: "Produto Danificado", loja: "Centro", quantidade: 5, status: "processada" },
  { id: "DEV-002", data: "2026-04-01", produto: "Desinfetante 1L", motivo: "Vencido", loja: "Norte", quantidade: 12, status: "pendente" },
  { id: "DEV-003", data: "2026-03-31", produto: "Sabonete Líquido", motivo: "Qualidade Inferior", loja: "Sul", quantidade: 8, status: "processada" },
  { id: "DEV-004", data: "2026-03-30", produto: "Álcool 70%", motivo: "Embalagem Aberta", loja: "Leste", quantidade: 3, status: "processada" },
  { id: "DEV-005", data: "2026-03-29", produto: "Pano de Limpeza", motivo: "Quantidade Incorreta", loja: "Centro", quantidade: 20, status: "pendente" },
];

const motivos = [
  { name: "Produto Danificado", value: 35 },
  { name: "Vencido", value: 25 },
  { name: "Qualidade Inferior", value: 20 },
  { name: "Embalagem Aberta", value: 12 },
  { name: "Quantidade Incorreta", value: 8 },
];

const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export default function CometaDevolucoes() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const filteredReturns = mockReturns.filter(item => {
    const matchFilter = filter === "todos" || item.status === filter;
    const matchSearch = item.id.toLowerCase().includes(search.toLowerCase()) ||
                       item.produto.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleExport = () => {
    toast.success("✅ Devoluções exportadas para Excel!");
  };

  const handleProcess = (id: string) => {
    toast.success(`✅ Devolução ${id} processada!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Devoluções Cometa</h1>
          <p className="text-muted-foreground">Gerencie devoluções de produtos</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Devoluções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockReturns.length}</div>
            <p className="text-xs text-muted-foreground">Todos os períodos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mockReturns.filter(r => r.status === "pendente").length}</div>
            <p className="text-xs text-muted-foreground">Aguardando processamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mockReturns.filter(r => r.status === "processada").length}</div>
            <p className="text-xs text-muted-foreground">Finalizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unidades Devolvidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockReturns.reduce((acc, r) => acc + r.quantidade, 0)}</div>
            <p className="text-xs text-muted-foreground">Total de itens</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Motivos de Devolução</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={motivos}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {motivos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Análise de Motivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {motivos.map((motivo, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <span className="text-sm">{motivo.name}</span>
                </div>
                <span className="text-sm font-semibold">{motivo.value}%</span>
              </div>
            ))}
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
              placeholder="Buscar por ID ou produto..."
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
              <SelectItem value="processada">Processadas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Devoluções</CardTitle>
          <CardDescription>{filteredReturns.length} devolução(ões) encontrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredReturns.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <RotateCcw className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{item.id}</p>
                      <p className="text-sm text-muted-foreground">{item.produto} • {item.loja}</p>
                      <p className="text-xs text-muted-foreground">Motivo: {item.motivo}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">{item.quantidade} un</p>
                    <p className="text-xs text-muted-foreground">{item.data}</p>
                  </div>

                  <Badge className={item.status === "processada" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                    {item.status === "processada" ? "✅ Processada" : "⏳ Pendente"}
                  </Badge>

                  {item.status === "pendente" && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleProcess(item.id)}
                    >
                      Processar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
