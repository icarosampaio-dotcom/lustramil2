import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

const mockData = [
  { month: "Jan", vendas: 4000, estoque: 2400, pedidos: 2400 },
  { month: "Fev", vendas: 3000, estoque: 1398, pedidos: 2210 },
  { month: "Mar", vendas: 2000, estoque: 9800, pedidos: 2290 },
  { month: "Abr", vendas: 2780, estoque: 3908, pedidos: 2000 },
  { month: "Mai", vendas: 1890, estoque: 4800, pedidos: 2181 },
];

const mockLogs = [
  { id: 1, timestamp: "2026-04-02 10:30", tipo: "Vendas", status: "✅ Sucesso", registros: 245 },
  { id: 2, timestamp: "2026-04-02 09:30", tipo: "Estoque", status: "✅ Sucesso", registros: 1203 },
  { id: 3, timestamp: "2026-04-02 08:30", tipo: "Pedidos", status: "✅ Sucesso", registros: 45 },
  { id: 4, timestamp: "2026-04-02 07:30", tipo: "Devoluções", status: "✅ Sucesso", registros: 12 },
];

export default function CometaDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState("2026-04-02 10:30:00");

  const handleSync = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      setLastSync(new Date().toLocaleString("pt-BR"));
      toast.success("✅ Sincronização concluída com sucesso!");
    } catch (error) {
      toast.error("❌ Erro na sincronização");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Cometa</h1>
          <p className="text-muted-foreground">Monitore a sincronização de dados em tempo real</p>
        </div>
        <Button onClick={handleSync} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Agora
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vendas Sincronizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,245</div>
            <p className="text-xs text-muted-foreground">+12% desde ontem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estoque Atualizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3,456</div>
            <p className="text-xs text-muted-foreground">Produtos monitorados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">Aguardando processamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.8%</div>
            <p className="text-xs text-muted-foreground">Última sincronização</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="vendas" fill="#3b82f6" />
                <Bar dataKey="estoque" fill="#10b981" />
                <Bar dataKey="pedidos" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da Sincronização</CardTitle>
            <CardDescription>Última atualização: {lastSync}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Vendas</span>
              </div>
              <Badge className="bg-green-600">Ativo</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Estoque</span>
              </div>
              <Badge className="bg-green-600">Ativo</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Pedidos</span>
              </div>
              <Badge className="bg-green-600">Ativo</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Devoluções</span>
              </div>
              <Badge className="bg-green-600">Ativo</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Sincronizações</CardTitle>
          <CardDescription>Últimas 10 sincronizações realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mockLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <p className="font-medium">{log.tipo}</p>
                  <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">{log.registros} registros</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {log.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
