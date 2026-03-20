/**
 * UCDetailPage — Full detail page for a Unidade Consumidora.
 * Route: /admin/ucs/:id
 * Improved with prominent header banner, restructured Config tab.
 * Tarefa: meter/plant links fetched once here, passed as props.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { unitService, type UCRecord } from "@/services/unitService";
import { useUnitCredits, useDeleteUnitCredit } from "@/hooks/useUnitCredits";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, MapPin, Zap, FileText, Settings, Gauge, Link2, History, Edit, Trash2, Mail, Lock, Sun, Plus, Calendar, MoreHorizontal, BarChart3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { UCMeterTab } from "./UCMeterTab";
import { UCBillingSettingsTab } from "./UCBillingSettingsTab";
import { UCInvoicesTab } from "./UCInvoicesTab";
import { UCPlantLinksTab } from "./UCPlantLinksTab";
import { UCFormDialog } from "./UCFormDialog";
import { AddCreditDialog } from "./AddCreditDialog";
import { UCOverviewTab } from "./UCOverviewTab";
import { UCHistoricoTab } from "./UCHistoricoTab";
import { PlantGenerationReport } from "@/components/admin/monitoring-v2/reports/PlantGenerationReport";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Consumo",
  gd_geradora: "GD Geradora",
  beneficiaria: "Beneficiária",
};

export default function UCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { tenant } = useTenantSettings();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addCreditOpen, setAddCreditOpen] = useState(false);

  const { data: uc, isLoading, error } = useQuery({
    queryKey: ["uc_detail", id],
    queryFn: () => unitService.getById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: credits = [] } = useUnitCredits(id ?? null);
  const deleteCredit = useDeleteUnitCredit();

  // §23: Fetch meter link ONCE here, pass as props
  const { data: meterLink } = useQuery({
    queryKey: ["uc_meter_link", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_meter_links")
        .select("meter_device_id, meter_devices(id, name, online_status)")
        .eq("unit_id", id!)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  // §23: Fetch plant link ONCE here, pass as props
  // monitor_plants.legacy_plant_id maps to solar_plants.id (needed for metrics)
  const { data: plantLink } = useQuery({
    queryKey: ["uc_plant_link", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_plant_links")
        .select("plant_id, monitor_plants(id, name, installed_power_kwp, legacy_plant_id)")
        .eq("unit_id", id!)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const meterId = (meterLink as any)?.meter_device_id ?? null;
  const meterDevice = (meterLink as any)?.meter_devices ?? null;
  const plantId = (plantLink as any)?.plant_id ?? null;
  const plantDevice = (plantLink as any)?.monitor_plants ?? null;
  // solar_plants.id for metrics queries (resolved via legacy_plant_id)
  const solarPlantId = plantDevice?.legacy_plant_id ?? null;

  const totalCreditoAdicionado = credits.reduce((sum, c) => sum + Number(c.quantidade_kwh), 0);

  const handleDeleteCredit = async (creditId: string) => {
    try {
      await deleteCredit.mutateAsync({ id: creditId, unitId: id! });
      toast({ title: "Crédito removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !uc) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ucs")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="text-center py-12 text-muted-foreground">UC não encontrada.</div>
      </div>
    );
  }

  const end = uc.endereco || {};
  const enderecoStr = [end.logradouro, end.numero, end.bairro, end.cidade, end.estado].filter(Boolean).join(", ");

  return (
    <div className="space-y-0">
      {/* Back button */}
      <div className="p-4 md:px-6 md:pt-6 pb-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ucs")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>

      {/* Hero header banner */}
      <div className="mx-4 md:mx-6 mt-3 rounded-xl bg-gradient-to-r from-card to-muted/30 border shadow-sm p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Denominação</p>
              <p className="text-sm font-bold truncate">{uc.nome}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contrato</p>
              <p className="text-sm font-bold font-mono">{uc.codigo_uc}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Concessionária</p>
              <p className="text-sm font-bold truncate">{uc.concessionaria_nome || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Classificação</p>
              <p className="text-sm font-bold">{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` - ${uc.classificacao_subgrupo}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs">
              {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
            </Badge>
            <StatusBadge variant={uc.is_archived ? "muted" : uc.status === "active" ? "success" : "warning"} dot>
              {uc.is_archived ? "Arquivada" : uc.status === "active" ? "Ativa" : uc.status}
            </StatusBadge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 md:p-6 space-y-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="config" className="gap-1"><Settings className="w-3.5 h-3.5" /> Configurações</TabsTrigger>
            <TabsTrigger value="medidor" className="gap-1"><Gauge className="w-3.5 h-3.5" /> Medidor</TabsTrigger>
            <TabsTrigger value="faturas" className="gap-1"><FileText className="w-3.5 h-3.5" /> Faturas</TabsTrigger>
            <TabsTrigger value="usinas" className="gap-1"><Link2 className="w-3.5 h-3.5" /> Usinas</TabsTrigger>
            {plantId && <TabsTrigger value="relatorios" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> Relatórios</TabsTrigger>}
            <TabsTrigger value="historico" className="gap-1"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          {/* === OVERVIEW TAB (replaces "Geral") === */}
          <TabsContent value="overview">
            <UCOverviewTab
              ucId={uc.id}
              meterId={meterId}
              plantId={plantId}
              solarPlantId={solarPlantId}
              meterName={meterDevice?.name}
              meterOnline={meterDevice?.online_status}
              plantName={plantDevice?.name}
              plantCapacityKwp={plantDevice?.installed_power_kwp}
              proximaLeituraData={(uc as any).proxima_leitura_data}
            />
          </TabsContent>

          {/* === CONFIGURAÇÕES TAB === */}
          <TabsContent value="config" className="space-y-6">
            {/* Cadastro section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Cadastro</CardTitle>
                  <Button variant="link" size="sm" className="text-primary h-auto p-0 text-xs" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="w-3 h-3 mr-1" /> Editar Cadastro
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Denominação:</span>
                  <span>{uc.nome}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Concessionária:</span>
                  <span>{uc.concessionaria_nome || "Não definida"}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Contrato:</span>
                  <span className="font-mono">{uc.codigo_uc}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Classificação:</span>
                  <span>{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` - ${uc.classificacao_subgrupo}` : ""}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Modalidade:</span>
                  <span>{uc.modalidade_tarifaria || "—"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Créditos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> Crédito GD</CardTitle>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setAddCreditOpen(true)}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar Crédito
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <Card className="border-l-[3px] border-l-primary">
                    <CardContent className="py-5">
                      <p className="text-xs text-muted-foreground mb-1">Crédito Acumulado</p>
                      <p className="text-2xl font-bold">{totalCreditoAdicionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-[3px] border-l-info">
                    <CardContent className="py-5">
                      <p className="text-xs text-muted-foreground mb-1">Crédito Adicionado</p>
                      <p className="text-2xl font-bold">{totalCreditoAdicionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
                    </CardContent>
                  </Card>
                </div>

                {credits.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold text-foreground">Vigência</TableHead>
                          <TableHead className="font-semibold text-foreground">Quantidade</TableHead>
                          <TableHead className="font-semibold text-foreground">Posto</TableHead>
                          <TableHead className="font-semibold text-foreground">Observações</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {credits.map((c) => (
                          <TableRow key={c.id} className="hover:bg-muted/30">
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                {new Date(c.data_vigencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono font-medium">
                              {Number(c.quantidade_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="outline" className="text-xs">
                                {c.posto_tarifario === "fora_ponta" ? "Fora Ponta" : c.posto_tarifario === "ponta" ? "Ponta" : "Intermediário"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]" title={c.observacoes || ""}>
                              {c.observacoes || "—"}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteCredit(c.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vincular usina */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Sun className="w-4 h-4" /> Instalar Usina</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Selecione a usina que deseja vincular, apenas usinas sem lista de compensação serão listadas.</p>
                <UCPlantLinksTab unitId={uc.id} ucTipo={uc.tipo_uc} />
              </CardContent>
            </Card>

            {/* Faturas por E-mail */}
            <UCBillingSettingsTab unitId={uc.id} />

            {/* Remover */}
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-destructive">Outros</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10 text-xs gap-1">
                  <Trash2 className="w-3 h-3 mr-1" /> Remover UC
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medidor">
            <UCMeterTab unitId={uc.id} />
          </TabsContent>

          <TabsContent value="faturas">
            <UCInvoicesTab unitId={uc.id} />
          </TabsContent>

          <TabsContent value="usinas">
            <UCPlantLinksTab unitId={uc.id} ucTipo={uc.tipo_uc} />
          </TabsContent>

          {plantId && (
            <TabsContent value="relatorios">
              <PlantGenerationReport plantId={plantId} />
            </TabsContent>
          )}

          <TabsContent value="historico">
            <UCHistoricoTab
              ucId={uc.id}
              meterId={meterId}
              plantId={plantId}
              solarPlantId={solarPlantId}
            />
          </TabsContent>
        </Tabs>
      </div>

      <UCFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingUC={uc}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["uc_detail", id] });
          setEditDialogOpen(false);
        }}
      />

      {tenant && (
        <AddCreditDialog
          open={addCreditOpen}
          onOpenChange={setAddCreditOpen}
          unitId={uc.id}
          tenantId={tenant.id}
        />
      )}
    </div>
  );
}
