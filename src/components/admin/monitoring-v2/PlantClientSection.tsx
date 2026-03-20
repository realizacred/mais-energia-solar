import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updatePlantClientId } from "@/services/monitoring/monitorService";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Link as LinkIcon, Unlink, Search, UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlantCreateClientDialog } from "./PlantCreateClientDialog";

interface Props {
  plantId: string;
  clientId: string | null;
  clientName: string | null;
}

const STALE_TIME = 1000 * 60 * 5;

export function PlantClientSection({ plantId, clientId, clientName }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-search", search],
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, cidade, estado")
        .eq("ativo", true)
        .order("nome")
        .limit(20);

      if (search.length >= 2) {
        // Search by name OR phone
        query = query.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%`);
      }
      const { data } = await query;
      return (data || []) as Array<{
        id: string;
        nome: string;
        telefone: string;
        cidade: string | null;
        estado: string | null;
      }>;
    },
    staleTime: STALE_TIME,
    enabled: showSearch,
  });

  const linkMutation = useMutation({
    mutationFn: (newClientId: string | null) => updatePlantClientId(plantId, newClientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-plant-detail", plantId] });
      queryClient.invalidateQueries({ queryKey: ["monitor-plants-health"] });
      queryClient.invalidateQueries({ queryKey: ["monitor-dashboard-stats"] });
      toast.success(clientId ? "Cliente desvinculado" : "Cliente vinculado com sucesso");
      setShowSearch(false);
      setSearch("");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao vincular cliente"),
  });

  return (
    <>
      <SectionCard title="Cliente" icon={Users}>
        {clientId && clientName ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{clientName}</p>
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                  <LinkIcon className="h-3 w-3 mr-1" />
                  Vinculado
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
            >
              <Unlink className="h-3.5 w-3.5 mr-1.5" />
              Desvincular
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                Sem cliente vinculado
              </Badge>
              {!showSearch && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowSearch(true)}>
                    <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                    Vincular Existente
                  </Button>
                  <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Novo Cliente
                  </Button>
                </div>
              )}
            </div>
            {showSearch && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                {search.length >= 2 && clientes.length === 0 && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Nenhum cliente encontrado</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowSearch(false);
                        setSearch("");
                        setShowCreateDialog(true);
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Criar Novo Cliente
                    </Button>
                  </div>
                )}
                {clientes.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-1">
                    {clientes.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => linkMutation.mutate(c.id)}
                        disabled={linkMutation.isPending}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors",
                          "flex items-center justify-between"
                        )}
                      >
                        <div>
                          <p className="font-medium text-foreground">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.telefone}
                            {(c.cidade || c.estado) && (
                              <span className="ml-2">
                                · {[c.cidade, c.estado].filter(Boolean).join(" - ")}
                              </span>
                            )}
                          </p>
                        </div>
                        <LinkIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowSearch(false);
                      setSearch("");
                      setShowCreateDialog(true);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Criar Novo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowSearch(false); setSearch(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <PlantCreateClientDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        plantId={plantId}
      />
    </>
  );
}
