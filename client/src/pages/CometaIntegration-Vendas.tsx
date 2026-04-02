import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

const mockSalesData = [
  { data: "01/04", vendas: 4200, meta: 5000, loja: "Centro" },
  { data: "02/04", vendas: 5100, meta: 5000, loja: "Centro" },
  { data: "03/04", vendas: 3800, meta: 5000, loja: "Centro" },
  { data: "04/04", vendas: 6200, meta: 5000, loja: "Centro" },
  { data: "05/04", vendas: 5900, meta: 5000, loja: "Centro" },
];

const mockSalesByStore = [
  { loja: "Loja Centro", vendas: 25400, percentual: 35 },
  { loja: "Loja Norte", vendas: 18900, percentual: 26 },
  { loja: "Loja Sul", vendas: 16200, percentual: 22 },
  { loja: "Loja Leste", vendas: 12500, percentual: 17 },
];

export default function CometaVendas() {
  const [period, setPeriod] = useState("mes");
  const [store, setStore] = useState("todas");

  const handleExport = () => {
    toast.success("✅ Vendas exportadas para Excel!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendas Cometa</h1>
          <p className="text-muted-foreground">Análise de vendas sincronizadas do Cometa</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 73.000</div>
            <p className="text-xs text-muted-foreground">+15% vs período anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 245,50</div>
            <p className="text-xs text-muted-foreground">Por transação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">297</div>
            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Meta Atingida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">102%</div>
            <p className="text-xs text-muted-foreground">Acima da meta</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Última Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="trimestre">Este Trimestre</SelectItem>
                <SelectItem value="ano">Este Ano</SelectItem>
              </SelectContent>
            </Select>

            <Select value={store} onValueChange={setStore}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Lojas</SelectItem>
                <SelectItem value="centro">Loja Centro</SelectItem>
                <SelectItem value="norte">Loja Norte</SelectItem>
                <SelectItem value="sul">Loja Sul</SelectItem>
                <SelectItem value="leste">Loja Leste</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Busca Rápida</CardTitle>
          </CardHeader>
          <CardContent>
            <Input placeholder="Buscar por produto, categoria..." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução de Vendas</CardTitle>
          <CardDescription>Últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockSalesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="vendas" stroke="#3b82f6" strokeWidth={2} name="Vendas (R$)" />
              <Line type="monotone" dataKey="meta" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Meta (R$)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendas por Loja</CardTitle>
          <CardDescription>Distribuição de vendas</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockSalesByStore}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="loja" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="vendas" fill="#10b981" name="Vendas (R$)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de Lojas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockSalesByStore.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold">{item.loja}</p>
                  <p className="text-sm text-muted-foreground">R$ {item.vendas.toLocaleString()}</p>
                </div>
                <div className="w-24 bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${item.percentual}%` }}
                  />
                </div>
                <span className="text-sm font-semibold ml-4">{item.percentual}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
