import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function CometaMonitoramento() {
  const { data: status, isLoading, refetch } = trpc.cometa.syncStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  const forceSyncMutation = trpc.cometa.forceSync.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Cache invalidado. Dados serao atualizados na proxima consulta.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento Cometa</h1>
          <p className="text-muted-foreground">Status da integracao com a API do Cometa</p>
        </div>
        <Button variant="outline" onClick={() => forceSyncMutation.mutate()} disabled={forceSyncMutation.isPending}>
          {forceSyncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Forcar Atualizacao
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Status da Integracao</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verificando status...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {status && Object.entries(status).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {value?.ok ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{key}</p>
                      {value?.lastSync && <p className="text-xs text-muted-foreground">Ultimo sync: {new Date(value.lastSync).toLocaleString("pt-BR")}</p>}
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${value?.ok ? "text-green-600" : "text-red-600"}`}>
                    {value?.ok ? "OK" : "Erro"}
                  </span>
                </div>
              ))}
              {!status && (
                <p className="text-muted-foreground text-center py-4">Nenhum dado de status disponivel</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
