import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Plus, ExternalLink, Zap, MapPin, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { OrcamentoViewDialog } from "@/components/admin/leads/OrcamentoViewDialog";
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface WaOrcamentosDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string | null;
  clienteNome?: string | null;
  clienteTelefone?: string | null;
}

export function WaOrcamentosDrawer({
  open,
  onOpenChange,
  leadId,
  clienteNome,
  clienteTelefone,
}: WaOrcamentosDrawerProps) {
  const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoDisplayItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const { data: orcamentos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["wa-orcamentos-drawer", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      // Query simples SEM join inner — evita lista vazia por RLS ou lead deletado
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Transform to OrcamentoDisplayItem usando props do chat como fallback
      return (data || []).map((orc: any): OrcamentoDisplayItem => ({
        id: orc.id,
        orc_code: orc.orc_code,
        lead_id: orc.lead_id,
        lead_code: null,
        nome: clienteNome || "",
        telefone: clienteTelefone || "",
        cep: orc.cep,
        estado: orc.estado,
        cidade: orc.cidade,
        bairro: orc.bairro,
        rua: orc.rua,
        numero: orc.numero,
        complemento: orc.complemento,
        area: orc.area,
        tipo_telhado: orc.tipo_telhado,
        rede_atendimento: orc.rede_atendimento,
        media_consumo: orc.media_consumo,
        consumo_previsto: orc.consumo_previsto,
        arquivos_urls: orc.arquivos_urls,
        observacoes: orc.observacoes,
        vendedor: orc.vendedor,
        vendedor_id: orc.vendedor_id,
        vendedor_nome: null,
        status_id: orc.status_id,
        visto: orc.visto,
        visto_admin: orc.visto_admin,
        ultimo_contato: orc.ultimo_contato,
        proxima_acao: orc.proxima_acao,
        data_proxima_acao: orc.data_proxima_acao,
        created_at: orc.created_at,
        updated_at: orc.updated_at,
      }));
    },
    enabled: open && !!leadId,
    staleTime: 15_000,
  });

  // Fetch statuses for badge colors
  const { data: statuses = [] } = useQuery({
    queryKey: ["wa-orc-statuses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_status")
        .select("id, nome, cor")
        .order("ordem");
      return data || [];
    },
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const getStatusInfo = (statusId: string | null) => {
    if (!statusId) return null;
    return statuses.find((s) => s.id === statusId) || null;
  };

  const handleClickOrcamento = (orc: OrcamentoDisplayItem) => {
    setSelectedOrcamento(orc);
    setViewDialogOpen(true);
  };

  const handleNewOrcamento = () => {
    // Open lead form with pre-filled data in a new tab
    const params = new URLSearchParams();
    if (leadId) params.set("lead_id", leadId);
    if (clienteNome) params.set("nome", clienteNome);
    if (clienteTelefone) params.set("telefone", clienteTelefone);
    window.open(`/formulario?${params.toString()}`, "_blank");
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Orçamentos deste cliente
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {clienteNome || "Cliente"} · {orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleNewOrcamento}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo orçamento
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 pb-4" style={{ maxHeight: "60vh" }}>
            {!leadId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum lead vinculado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Vincule um lead para ver os orçamentos
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="sm" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-destructive/30 mb-2" />
                <p className="text-sm text-destructive">Erro ao carregar orçamentos</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : orcamentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Crie um novo orçamento para este cliente
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {orcamentos.map((orc) => {
                  const status = getStatusInfo(orc.status_id);
                  return (
                    <button
                      key={orc.id}
                      onClick={() => handleClickOrcamento(orc)}
                      className="w-full text-left p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5">
                            {orc.orc_code || "—"}
                          </Badge>
                          {status && (
                            <Badge
                              className="text-[9px] px-1.5 py-0"
                              style={{
                                backgroundColor: status.cor + "20",
                                color: status.cor,
                                borderColor: status.cor + "40",
                              }}
                            >
                              {status.nome}
                            </Badge>
                          )}
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-warning" />
                          {orc.consumo_previsto} kWh
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {orc.cidade}/{orc.estado}
                        </span>
                        <span className="flex items-center gap-1 ml-auto">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(orc.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <OrcamentoViewDialog
        orcamento={selectedOrcamento}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onRefresh={() => refetch()}
      />
    </>
  );
}
