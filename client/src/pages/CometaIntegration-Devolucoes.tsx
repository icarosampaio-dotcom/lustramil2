import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function CometaDevolucoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Devolucoes Cometa</h1>
        <p className="text-muted-foreground">Devolucoes de produtos nas lojas do Cometa</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Devolucoes</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Endpoint de devolucoes em manutencao</p>
            <p className="text-sm mt-2">A API do Cometa ainda nao disponibiliza dados de devolucoes. Esta funcionalidade sera habilitada assim que o endpoint estiver disponivel.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
