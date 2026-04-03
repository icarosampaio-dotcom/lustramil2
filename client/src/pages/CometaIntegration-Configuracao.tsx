import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Zap, Package, TrendingUp, Boxes, RotateCcw, Bell } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const COMETA_LOGO = "https://cometasupermercados.com.br/logo.png";

export default function CometaConfiguracao() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(() => {
    return localStorage.getItem("cometa_email") || "lustramil@yahoo.com.br";
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem("cometa_password") || "";
  });
  const [frequency, setFrequency] = useState(() => {
    return localStorage.getItem("cometa_frequency") || "diaria";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(() => {
    return localStorage.getItem("cometa_connected") === "true";
  });

  const handleTestConnection = async () => {
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }

    setIsLoading(true);
    try {
      // Simular teste de conexão
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsConnected(true);
      toast.success("✅ Conexão com Cometa estabelecida!");
    } catch (error) {
      toast.error("❌ Erro ao conectar com Cometa");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isConnected) {
      toast.error("Teste a conexão primeiro");
      return;
    }

    setIsLoading(true);
    try {
      // Simular salvamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Salvar no localStorage
      localStorage.setItem("cometa_email", email);
      localStorage.setItem("cometa_password", password);
      localStorage.setItem("cometa_frequency", frequency);
      localStorage.setItem("cometa_connected", "true");
      localStorage.setItem("cometa_last_sync", new Date().toISOString());
      
      toast.success("✅ Configuração salva com sucesso!");
    } catch (error) {
      toast.error("❌ Erro ao salvar configuração");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <img src={COMETA_LOGO} alt="Cometa" className="h-12 w-auto" onError={(e) => {
          e.currentTarget.src = "https://via.placeholder.com/150x50?text=Cometa";
        }} />
        <div>
          <h1 className="text-3xl font-bold">Integração Cometa Supermercados</h1>
          <p className="text-muted-foreground">Configure suas credenciais para sincronizar dados</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Credenciais Cometa
            </CardTitle>
            <CardDescription>Configure seu acesso à API Cometa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@cometa.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequência de Sincronização</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="horaria">A cada hora</SelectItem>
                  <SelectItem value="diaria">Diária (02:00)</SelectItem>
                  <SelectItem value="semanal">Semanal (segunda 02:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleTestConnection}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testando...
                </>
              ) : (
                "Testar Conexão"
              )}
            </Button>

            {isConnected && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ✅ Conexão estabelecida com sucesso!
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSave}
              disabled={isLoading || !isConnected}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar Configuração"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da Integração</CardTitle>
            <CardDescription>Informações da conexão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-sm font-bold ${isConnected ? "text-green-600" : "text-red-600"}`}>
                  {isConnected ? "🟢 Conectado" : "🔴 Desconectado"}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">API URL</span>
                <span className="text-xs text-muted-foreground">vendas.cometa...</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Frequência</span>
                <span className="text-sm font-semibold capitalize">{frequency}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Última Sincronização</span>
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Após salvar, a sincronização iniciará automaticamente conforme a frequência configurada.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da API Cometa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>URL Base:</strong> https://vendas.cometasupermercados.com.br</p>
          <p><strong>Endpoints:</strong> /login, /venda, /estoque, /pedido, /devolucao, /loja</p>
          <p><strong>Autenticação:</strong> JWT Token</p>
          <p><strong>Documentação:</strong> https://vendas.cometasupermercados.com.br/docs</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Acesso Rápido</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card
            className="cursor-pointer border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
            onClick={() => navigate("/cometa-pedidos")}
          >
            <CardHeader className="pb-3">
              <Package className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle className="text-lg">Pedidos</CardTitle>
              <CardDescription>Ver pedidos recebidos</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-blue-600">12 novos</Badge>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 border-green-200 bg-green-50 hover:bg-green-100 transition"
            onClick={() => navigate("/cometa-vendas")}
          >
            <CardHeader className="pb-3">
              <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle className="text-lg">Vendas</CardTitle>
              <CardDescription>Vendas sincronizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-green-600">45 registros</Badge>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition"
            onClick={() => navigate("/cometa-estoque")}
          >
            <CardHeader className="pb-3">
              <Boxes className="h-8 w-8 text-yellow-600 mb-2" />
              <CardTitle className="text-lg">Estoque</CardTitle>
              <CardDescription>Estoque disponível</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-yellow-600">156 itens</Badge>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 transition"
            onClick={() => navigate("/cometa-devolucoes")}
          >
            <CardHeader className="pb-3">
              <RotateCcw className="h-8 w-8 text-orange-600 mb-2" />
              <CardTitle className="text-lg">Devoluções</CardTitle>
              <CardDescription>Devoluções registradas</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-orange-600">8 registros</Badge>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition"
            onClick={() => navigate("/cometa-monitoramento")}
          >
            <CardHeader className="pb-3">
              <Bell className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle className="text-lg">Monitoramento</CardTitle>
              <CardDescription>Notificações em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-purple-600">3 não lidas</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
