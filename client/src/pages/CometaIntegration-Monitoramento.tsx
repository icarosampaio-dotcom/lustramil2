import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, Loader2, CheckCircle, XCircle, Clock, Database,
  Wifi, WifiOff, Activity, Package, ShoppingCart, Boxes, RotateCcw, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function CometaMonitoramento() {
  const { data: status, isLoading, refetch, error } = trpc.cometa.syncStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    retry: 2,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Cache invalidado. Dados serão atualizados na próxima consulta.");
    },
    onError: () => {
      toast.error("Erro ao invalidar cache.");
    },
  });

  const formatAge = (seconds: number | null) => {
    if (seconds === null) return "—";
    if (seconds < 60) return `${seconds}s atrás`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min atrás`;
    return `${Math.round(seconds / 3600)}h atrás`;
  };

  const formatDate = (ts: string | null) => {
    if (!ts) return "Nunca";
    try { return new Date(ts).toLocaleString("pt-BR"); } catch { return "—"; }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento Cometa</h1>
          <p className="text-muted-foreground">Status da integração com a API do Cometa Supermercados</p>
        </div>
        <Button variant="outline" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending || isLoading}>
          {forceSyncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Forçar Atualização
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-muted-foreground">Verificando status da integração...</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <XCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Erro ao verificar status</p>
              <p className="text-sm text-red-600">Verifique sua conexão e tente novamente.</p>
            </div>
          </CardContent>
        </Card>
      ) : status ? (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Total de Syncs", value: status.totalSyncs, icon: Activity, color: "text-blue-600" },
              { label: "Bem-sucedidas", value: status.successfulSyncs, icon: CheckCircle, color: "text-green-600" },
              { label: "Com Erros", value: status.failedSyncs, icon: XCircle, color: "text-red-600" },
              { label: "Notificações", value: status.unreadNotifications, icon: AlertTriangle, color: "text-purple-600" },
            ].map((m) => (
              <Card key={m.label}>
                <CardHeader className="pb-2">
                  <CardDescription className={`flex items-center gap-1 ${m.color}`}>
                    <m.icon className="h-3.5 w-3.5" /> {m.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" /> Cache de Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {status.cacheValid ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-orange-500" />}
                    <div>
                      <p className="font-medium text-sm">Status do Cache</p>
                      <p className="text-xs text-muted-foreground">{status.cacheValid ? "Dados em memória válidos" : "Cache expirado ou vazio"}</p>
                    </div>
                  </div>
                  <Badge variant={status.cacheValid ? "default" : "secondary"}>{status.cacheValid ? "Válido" : "Expirado"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Idade do Cache</p>
                      <p className="text-xs text-muted-foreground">Tempo desde última atualização</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatAge(status.cacheAge)}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {status.isRunning ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> : <CheckCircle className="h-5 w-5 text-gray-400" />}
                    <div>
                      <p className="font-medium text-sm">Sincronização</p>
                      <p className="text-xs text-muted-foreground">Estado atual do processo</p>
                    </div>
                  </div>
                  <Badge variant={status.isRunning ? "default" : "outline"}>{status.isRunning ? "Em execução" : "Inativa"}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-600" /> Conexão com Cometa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-sm">API Cometa</p>
                      <p className="text-xs text-muted-foreground">vendas.cometasupermercados.com.br</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600">Ativa</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Última Sincronização</p>
                      <p className="text-xs text-muted-foreground">{formatDate(status.lastSync)}</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <p className="text-xs text-blue-800 font-medium">ℹ️ Sobre a integração</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Os dados são buscados diretamente da API do Cometa em tempo real. O cache é renovado automaticamente a cada 10 minutos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Módulos Integrados</CardTitle>
              <CardDescription>Dados disponíveis via API do Cometa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {[
                  { icon: Package, label: "Pedidos", desc: "Pedidos de compra por loja", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                  { icon: ShoppingCart, label: "Vendas", desc: "Histórico de vendas", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
                  { icon: Boxes, label: "Estoque", desc: "Posição de estoque", color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
                  { icon: RotateCcw, label: "Devoluções", desc: "Devoluções registradas", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
                ].map((mod) => (
                  <div key={mod.label} className={`p-3 rounded-lg border ${mod.bg} ${mod.border}`}>
                    <mod.icon className={`h-6 w-6 ${mod.color} mb-2`} />
                    <p className={`font-semibold text-sm ${mod.color}`}>{mod.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-600" /> Ativo
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum dado disponível. Clique em "Forçar Atualização".</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
