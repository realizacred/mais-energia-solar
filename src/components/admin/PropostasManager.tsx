import { FileText, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PropostasManager() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Propostas Comerciais</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie propostas enviadas aos clientes
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Proposta
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 opacity-30" />
          </div>
          <p className="font-medium">Nenhuma proposta cadastrada</p>
          <p className="text-sm mt-1">
            Propostas geradas a partir de leads ou orçamentos aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
