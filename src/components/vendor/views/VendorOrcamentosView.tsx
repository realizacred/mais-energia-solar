import { useNavigate } from "react-router-dom";
import { MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorFollowUpManager } from "@/components/vendor/VendorFollowUpManager";
import { VendorPendingDocumentation } from "@/components/vendor/VendorPendingDocumentation";
import { VendorLeadFilters, VendorOrcamentosTable, VendorLeadViewDialog } from "@/components/vendor/leads";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { OfflineConversionsManager } from "@/components/leads/OfflineConversionsManager";
import { OfflineDuplicateResolver } from "@/components/vendor/OfflineDuplicateResolver";
import { VendedorShareLink } from "@/components/vendor/portal";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useOrcamentoSort } from "@/hooks/useOrcamentoSort";
import { OrcamentoSortSelector } from "@/components/ui/orcamento-sort-selector";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, UserPlus, Package, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function VendorOrcamentosView({ portal }: Props) {
  const { sortOption, updateSort } = useOrcamentoSort("vendedor_portal");
  const { hasPermission } = useUserPermissions();
  const canDeleteLeads = hasPermission("delete_leads");

  const {
    vendedor,
    isAdminMode,
    isViewingAsVendedor,
    orcamentos,
    filteredOrcamentos,
    statuses,
    estados,
    leadsForAlerts,
    searchTerm,
    setSearchTerm,
    filterVisto,
    setFilterVisto,
    filterEstado,
    setFilterEstado,
    filterStatus,
    setFilterStatus,
    excludeTerminal,
    setExcludeTerminal,
    maxAgeDays,
    setMaxAgeDays,
    handleClearFilters,
    operationalStatus,
    setOperationalStatus,
    selectedOrcamento,
    setSelectedOrcamento,
    isConvertOpen,
    setIsConvertOpen,
    orcamentoToConvert,
    setOrcamentoToConvert,
    fetchOrcamentos,
    loadMore,
    hasMore,
    totalCount,
    loadingMore,
    toggleVisto,
    updateStatus,
    deleteOrcamento,
    copyLink,
    orcamentoToLead,
  } = portal;

  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">Oportunidades e solicitações de orçamento</p>
          </div>
        </div>
        <div className="flex md:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-h-[44px]"
            onClick={() => navigate("/consultor/whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </div>
      <VendorFollowUpManager
        leads={leadsForAlerts}
        diasAlerta={3}
        onViewLead={(lead) => {
          const orc = orcamentos.find((o) => o.lead_id === lead.id);
          if (orc) setSelectedOrcamento(orc);
        }}
      />

      <VendorPendingDocumentation
        leads={leadsForAlerts}
        statuses={statuses}
        showAll={!excludeTerminal}
        onConvertClick={(lead) => {
          const orc = orcamentos.find((o) => o.lead_id === lead.id);
          if (orc) {
            setOrcamentoToConvert(orc);
            setIsConvertOpen(true);
          }
        }}
      />

      <OfflineDuplicateResolver vendedorNome={vendedor?.nome} />
      <OfflineConversionsManager />

      {(!isAdminMode || isViewingAsVendedor) && vendedor && (
        <VendedorShareLink slug={vendedor.slug || vendedor.codigo} onCopy={copyLink} />
      )}

      <Tabs defaultValue="meus-leads" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="meus-leads" className="gap-2">
            <Users className="h-4 w-4" /> Meus Leads
          </TabsTrigger>
          <TabsTrigger value="leads-disponiveis" className="gap-2">
            <UserPlus className="h-4 w-4" /> Leads Disponíveis
            <AvailableLeadsBadge />
          </TabsTrigger>
          <TabsTrigger value="meus-projetos" className="gap-2">
            <Package className="h-4 w-4" /> Projetos em Execução
            <StaleProjectsBadge />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meus-leads" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Meus Leads</CardTitle>
                  <CardDescription>
                    Exibindo {filteredOrcamentos.length} {filteredOrcamentos.length === 1 ? 'lead' : 'leads'} 
                    {totalCount > filteredOrcamentos.length ? ` (Página ${portal.page + 1})` : ""} de {totalCount} filtrados
                  </CardDescription>
                  {(excludeTerminal || maxAgeDays !== null) && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30 rounded-md text-[11px] text-yellow-700 dark:text-yellow-400 font-medium animate-in fade-in slide-in-from-top-1">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      Alguns orçamentos estão ocultos por filtros operacionais.
                      <button 
                        onClick={handleClearFilters}
                        className="ml-auto underline hover:no-underline"
                      >
                        Mostrar todos
                      </button>
                    </div>
                  )}
                </div>
                <OrcamentoSortSelector value={sortOption} onChange={updateSort} />
              </div>
              <VendorLeadFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                filterVisto={filterVisto}
                onFilterVistoChange={setFilterVisto}
                filterEstado={filterEstado}
                onFilterEstadoChange={setFilterEstado}
                filterStatus={filterStatus}
                onFilterStatusChange={setFilterStatus}
                estados={estados}
                statuses={statuses}
                excludeTerminal={excludeTerminal}
                onExcludeTerminalChange={setExcludeTerminal}
                maxAgeDays={maxAgeDays}
                onMaxAgeDaysChange={setMaxAgeDays}
                operationalStatus={operationalStatus}
                onOperationalStatusChange={setOperationalStatus}
                onClearFilters={handleClearFilters}
              />
            </CardHeader>
            <CardContent>
              <VendorOrcamentosTable
                orcamentos={filteredOrcamentos}
                statuses={statuses}
                sortOption={sortOption}
                onToggleVisto={toggleVisto}
                onView={(orc) => setSelectedOrcamento(orc)}
                onStatusChange={updateStatus}
                onDelete={canDeleteLeads ? (orc) => deleteOrcamento(orc.id) : undefined}
                onConvert={(orc) => {
                  setOrcamentoToConvert(orc);
                  setIsConvertOpen(true);
                }}
                onRefresh={fetchOrcamentos}
              />

              {hasMore && (
                <div className="flex justify-center pt-6 pb-2">
                  <Button 
                    variant="outline" 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    className="w-full sm:w-auto min-w-[200px]"
                  >
                    {loadingMore ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Carregando...
                      </>
                    ) : (
                      "Carregar mais leads"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads-disponiveis">
          <AvailableLeadsList portal={portal} />
        </TabsContent>

        <TabsContent value="meus-projetos">
          <MyProjectsList />
        </TabsContent>
      </Tabs>

      <ConvertLeadToClientDialog
        lead={orcamentoToConvert ? orcamentoToLead(orcamentoToConvert) : null}
        open={isConvertOpen}
        onOpenChange={setIsConvertOpen}
        orcamentoId={orcamentoToConvert?.id ?? null}
        onSuccess={fetchOrcamentos}
      />

      <VendorLeadViewDialog
        lead={selectedOrcamento ? orcamentoToLead(selectedOrcamento) : null}
        open={!!selectedOrcamento}
        onOpenChange={(open) => {
          if (!open) setSelectedOrcamento(null);
        }}
      />
    </div>
  );
}

function AvailableLeadsBadge() {
  const { user } = useAuth();
  const { data: count = 0 } = useQuery({
    queryKey: ["available-leads-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .is("consultor_id", null)
        .is("deleted_at", null)
        .not("status_id", "in", "('ganho', 'perdido')");
      if (error) throw error;
      return count || 0;
    }
  });

  if (count === 0) return null;
  return (
    <Badge variant="destructive" className="ml-1 px-1.5 h-4 min-w-[16px] text-[10px] flex items-center justify-center">
      {count}
    </Badge>
  );
}

function StaleProjectsBadge() {
  const { user } = useAuth();
  const { data: count = 0 } = useQuery({
    queryKey: ["stale-projects-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("projetos")
        .select("*", { count: "exact", head: true })
        .eq("consultor_id", user!.id)
        .not("status", "in", "('cancelado', 'concluido')")
        .lt("updated_at", sevenDaysAgo);
      if (error) throw error;
      return count || 0;
    }
  });

  if (count === 0) return null;
  return (
    <Badge variant="destructive" className="ml-1 px-1.5 h-4 min-w-[16px] text-[10px] flex items-center justify-center">
      {count}
    </Badge>
  );
}

function AvailableLeadsList({ portal }: { portal: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["available-leads"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, clientes(nome, telefone)")
        .is("consultor_id", null)
        .is("deleted_at", null)
        .not("status_id", "in", "('ganho', 'perdido')")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const assumeMutation = useMutation({
    mutationFn: async (leadId: string) => {
      // 1. Update lead
      const { error: updateError } = await supabase
        .from("leads")
        .update({ consultor_id: user!.id })
        .eq("id", leadId);
      if (updateError) throw updateError;

      // 2. Log history
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
      if (profile) {
        await supabase.from("consultor_historico").insert({
          lead_id: leadId,
          consultor_id: user!.id,
          acao: "assumiu_lead",
          tenant_id: profile.tenant_id
        });
      }
    },
    onSuccess: () => {
      toast.success("Lead assumido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["available-leads"] });
      queryClient.invalidateQueries({ queryKey: ["available-leads-count"] });
      portal.fetchOrcamentos();
    },
    onError: (err: any) => {
      toast.error("Erro ao assumir lead: " + err.message);
    }
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  if (leads.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="font-medium">Nenhum lead disponível para atribuição</p>
          <p className="text-sm text-muted-foreground">Novos leads aparecerão aqui assim que forem captados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {leads.map((lead: any) => (
        <Card key={lead.id} className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{lead.nome || lead.clientes?.nome || "Lead Sem Nome"}</CardTitle>
            <CardDescription>{lead.cidade}, {lead.estado}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> 
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
              </span>
              {lead.media_consumo && (
                <Badge variant="outline" className="font-mono">{lead.media_consumo} kWh</Badge>
              )}
            </div>
            <Button 
              className="w-full gap-2" 
              onClick={() => assumeMutation.mutate(lead.id)}
              disabled={assumeMutation.isPending}
            >
              {assumeMutation.isPending ? "Assumindo..." : "Assumir Lead"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MyProjectsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["my-active-projects", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, clientes(nome), projeto_etapas(nome), projeto_funis(nome)")
        .eq("consultor_id", user!.id)
        .not("status", "in", "('cancelado', 'concluido')")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  if (isLoading) return <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  if (projetos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="font-medium">Você não tem projetos em execução</p>
          <p className="text-sm text-muted-foreground">Seus projetos ativos aparecerão aqui após a conversão dos leads.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Etapa / Funil</TableHead>
            <TableHead>Inatividade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projetos.map((p: any) => {
            const stale = new Date(p.updated_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return (
              <TableRow key={p.id} className={stale ? "bg-destructive/5" : ""}>
                <TableCell>
                  <div className="font-medium">{p.clientes?.nome || "Cliente"}</div>
                  <div className="text-xs text-muted-foreground">{p.valor_total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor_total) : "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="w-fit text-[10px] uppercase">{p.projeto_funis?.nome || "Padrão"}</Badge>
                    <span className="text-sm">{p.projeto_etapas?.nome || "Sem etapa"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn("text-xs flex items-center gap-1", stale ? "text-destructive font-bold" : "text-muted-foreground")}>
                    {stale && <Clock className="h-3 w-3" />}
                    {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(`/admin/projetos/${p.id}`)}>
                    Ver projeto <ExternalLink className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

