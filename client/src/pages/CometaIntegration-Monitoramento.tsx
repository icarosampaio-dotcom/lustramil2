import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, CheckCircle, AlertTriangle, Package, TrendingUp, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "novo_pedido" | "nova_venda" | "estoque_atualizado" | "devolucao";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface SyncLog {
  type: "vendas" | "pedidos" | "estoque" | "devolucoes";
  success: boolean;
  recordsProcessed: number;
  newRecords: number;
  timestamp: Date;
  error?: string;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "novo_pedido",
    title: "🎉 Novo Pedido Recebido",
    message: "Pedido PEDIDO-001 de R$ 2.100,00 - 8 itens",
    timestamp: new Date(Date.now() - 5 * 60000),
    read: false,
  },
  {
    id: "2",
    type: "nova_venda",
    title: "💰 Nova Venda Sincronizada",
    message: "Venda de R$ 1.250,50 na loja Centro",
    timestamp: new Date(Date.now() - 15 * 60000),
    read: false,
  },
  {
    id: "3",
    type: "estoque_atualizado",
    title: "⚠️ Estoque Baixo",
    message: "Desinfetante 1L na Norte: 12 un (mín: 100)",
    timestamp: new Date(Date.now() - 30 * 60000),
    read: true,
  },
  {
    id: "4",
    type: "devolucao",
    title: "📦 Devolução Registrada",
    message: "5 un de Detergente Neutro - Motivo: Produto Danificado",
    timestamp: new Date(Date.now() - 1 * 3600000),
    read: true,
  },
];

const mockSyncLogs: SyncLog[] = [
  {
    type: "pedidos",
    success: true,
    recordsProcessed: 12,
    newRecords: 2,
    timestamp: new Date(Date.now() - 5 * 60000),
  },
  {
    type: "vendas",
    success: true,
    recordsProcessed: 45,
    newRecords: 3,
    timestamp: new Date(Date.now() - 10 * 60000),
  },
  {
    type: "estoque",
    success: true,
    recordsProcessed: 156,
    newRecords: 1,
    timestamp: new Date(Date.now() - 15 * 60000),
  },
  {
    type: "devolucoes",
    success: true,
    recordsProcessed: 8,
    newRecords: 1,
    timestamp: new Date(Date.now() - 20 * 60000),
  },
];

export default function CometaMonitoramento() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(mockSyncLogs);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Simular nova notificação a cada 30 segundos
      if (Math.random() > 0.7) {
        const types: Notification["type"][] = ["novo_pedido", "nova_venda", "estoque_atualizado", "devolucao"];
        const randomType = types[Math.floor(Math.random() * types.length)];

        const newNotification: Notification = {
          id: Date.now().toString(),
          type: randomType,
          title: `Notificação ${randomType}`,
          message: "Nova notificação recebida em tempo real",
          timestamp: new Date(),
          read: false,
        };

        setNotifications(prev => [newNotification, ...prev]);
        toast.success(`Nova notificação: ${newNotification.title}`);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("Todas as notificações marcadas como lidas");
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    toast.success("Notificações limpas");
  };

  const handleRefresh = async () => {
    toast.loading("Sincronizando...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success("Sincronização concluída!");
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "novo_pedido":
        return "🎉";
      case "nova_venda":
        return "💰";
      case "estoque_atualizado":
        return "⚠️";
      case "devolucao":
        return "📦";
      default:
        return "📢";
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Monitoramento Cometa
          </h1>
          <p className="text-muted-foreground">Acompanhe notificações e sincronizações em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-50 border-green-200" : ""}
          >
            {autoRefresh ? "🔄 Auto-refresh ON" : "⏸ Auto-refresh OFF"}
          </Button>
          <Button onClick={handleRefresh}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Sincronizar Agora
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notificações Não Lidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Aguardando ação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Notificações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">Todos os períodos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncLogs.length}</div>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">100%</div>
            <p className="text-xs text-muted-foreground">Todas as sincronizações</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Notificações em Tempo Real</CardTitle>
                <CardDescription>{notifications.length} notificação(ões)</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleMarkAllAsRead}>
                  Marcar Tudo como Lido
                </Button>
                <Button size="sm" variant="destructive" onClick={handleClearNotifications}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <Alert>
                <AlertDescription>Nenhuma notificação no momento</AlertDescription>
              </Alert>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    notification.read
                      ? "bg-muted/50 border-muted"
                      : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {getNotificationIcon(notification.type)} {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.timestamp).toLocaleTimeString("pt-BR")}
                      </p>
                    </div>
                    {!notification.read && (
                      <Badge className="bg-blue-600">Novo</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Sincronizações</CardTitle>
            <CardDescription>{syncLogs.length} sincronização(ões)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {syncLogs.map((log, index) => (
              <div key={index} className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {log.type === "pedidos" && <Package className="h-4 w-4" />}
                    {log.type === "vendas" && <TrendingUp className="h-4 w-4" />}
                    {log.type === "estoque" && <AlertTriangle className="h-4 w-4" />}
                    {log.type === "devolucoes" && <RotateCcw className="h-4 w-4" />}
                    <span className="font-semibold text-sm capitalize">{log.type}</span>
                  </div>
                  {log.success ? (
                    <Badge className="bg-green-600">✅ Sucesso</Badge>
                  ) : (
                    <Badge variant="destructive">❌ Erro</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Processados</p>
                    <p className="font-semibold">{log.recordsProcessed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Novos</p>
                    <p className="font-semibold text-green-600">{log.newRecords}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como Funciona o Monitoramento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Polling Automático</p>
              <p className="text-muted-foreground">Verifica novos dados a cada 60 minutos (configurável)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Webhooks em Tempo Real</p>
              <p className="text-muted-foreground">Recebe notificações instantâneas do Cometa quando há novos dados</p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Alertas Inteligentes</p>
              <p className="text-muted-foreground">Notificações automáticas para pedidos, vendas, estoque baixo e devoluções</p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Histórico Completo</p>
              <p className="text-muted-foreground">Acompanhe todas as sincronizações e notificações recebidas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
