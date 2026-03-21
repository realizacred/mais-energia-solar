/**
 * ClienteEnergiaDashboardPage — Admin page that wraps ClienteEnergiaDashboard
 * with a client selector. Allows admins to preview the client-facing energy view.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClienteEnergiaDashboard } from "./ClienteEnergiaDashboard";

function useClientesComGD() {
  return useQuery({
    queryKey: ["clientes_com_gd"],
    queryFn: async () => {
      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("cliente_id")
        .eq("status", "active");

      const uniqueIds = [...new Set(groups.map(g => g.cliente_id).filter(Boolean))] as string[];
      if (uniqueIds.length === 0) return [];

      const { data: clientes = [] } = await supabase
        .from("clientes")
        .select("id, nome")
        .in("id", uniqueIds)
        .order("nome");

      return clientes;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function ClienteEnergiaDashboardPage() {
  const { data: clientes, isLoading } = useClientesComGD();
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Client selector */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1">Selecione um cliente</p>
            {isLoading ? (
              <Skeleton className="h-9 w-full max-w-xs" />
            ) : (
              <Select
                value={selectedClienteId || ""}
                onValueChange={(v) => setSelectedClienteId(v || null)}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Escolha um cliente com GD..." />
                </SelectTrigger>
                <SelectContent>
                  {(clientes || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dashboard */}
      {selectedClienteId ? (
        <ClienteEnergiaDashboard clienteId={selectedClienteId} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Selecione um cliente acima</p>
          <p className="text-xs text-muted-foreground mt-1">O painel de energia do cliente será exibido aqui</p>
        </div>
      )}
    </div>
  );
}
