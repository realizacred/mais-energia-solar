/**
 * UCDetailPage — Full detail page for a Unidade Consumidora.
 * Route: /admin/ucs/:id
 * All UC features: overview, monitoring, GD, invoices, comparativo, economy, config.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { unitService, type UCRecord } from "@/services/unitService";
import { meterService } from "@/services/meterService";
import { useUnitCredits, useDeleteUnitCredit } from "@/hooks/useUnitCredits";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, ArrowLeft, Zap, FileText, Settings, Edit, Trash2, Plus,
  Calendar, MoreHorizontal, Activity, BarChart3, TrendingUp, DollarSign, Gauge, Sun
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { UCBillingSettingsTab } from "./UCBillingSettingsTab";
import { UCServicePlanCard } from "./UCServicePlanCard";
import { UCBillingHistoryCard } from "./UCBillingHistoryCard";
import { UCInvoicesTab } from "./UCInvoicesTab";
import { UCFormDialog } from "./UCFormDialog";
import { AddCreditDialog } from "./AddCreditDialog";
import { UCShareLinkButton } from "./UCShareLinkButton";
import { SystemStatusCard } from "./SystemStatusCard";

import { UCMeterTab } from "./UCMeterTab";
import { UCPlantLinksTab } from "./UCPlantLinksTab";
import { UCOverviewTab } from "./UCOverviewTab";
import { UCComparativoTab } from "./UCComparativoTab";
import { UCHistoricoTab } from "./UCHistoricoTab";
import { UCEconomyReportTab } from "./UCEconomyReportTab";
import { UCGdTab } from "./UCGdTab";
import { formatDateTime } from "@/lib/dateUtils";
import { buildUcDetailPath, mergeUcSearchParams, readUcNavigationContext } from "./ucNavigation";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Beneficiária",
  gd_geradora: "GD Geradora",
  mista: "Mista",
  beneficiaria: "Beneficiária",
};

const PAPEL_GD_LABELS: Record<string, string> = {
  none: "Nenhum",
  geradora: "Geradora",
  beneficiaria: "Beneficiária",
};

const CATEGORIA_GD_LABELS: Record<string, string> = {
  gd1: "GD I",
  gd2: "GD II",
  gd3: "GD III",
};

export default function UCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const activeSubtab = searchParams.get("subtab") || "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { tenant } = useTenantSettings();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addCreditOpen, setAddCreditOpen] = useState(false);
  const navigationContext = readUcNavigationContext(searchParams);

  const { data: uc, isLoading, error } = useQuery({
    queryKey: ["uc_detail", id],
    queryFn: () => unitService.getById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

  // proxima_leitura_data is fetched directly from UC record (set by process-fatura-pdf)

  // Resolve linked meter
  const { data: meterLinks = [] } = useQuery({
    queryKey: ["unit_meter_links", id],
    queryFn: () => meterService.getLinksForUnit(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
  const activeLink = meterLinks.find(l => l.is_active);
  const activeMeterIdResolved = activeLink?.meter_device_id ?? null;

  const { data: activeMeter } = useQuery({
    queryKey: ["meter_device", activeMeterIdResolved],
    queryFn: () => meterService.getById(activeMeterIdResolved!),
    enabled: !!activeMeterIdResolved,
    staleTime: 1000 * 60 * 2,
  });

  // Resolve linked plant (use distinct queryKey to avoid collision with UCPlantLinksTab)
  const { data: plantLinks = [] } = useQuery({
    queryKey: ["unit_plant_links_active", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("unit_plant_links")
        .select("id, plant_id, relation_type, is_active")
        .eq("unit_id", id!)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
  const activePlantLink = plantLinks[0];
  const activePlantId = activePlantLink?.plant_id ?? null;

  const { data: activePlant } = useQuery({
    queryKey: ["monitor_plant_for_uc", activePlantId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("monitor_plants")
        .select("id, name, installed_power_kwp, legacy_plant_id, last_seen_at")
        .eq("id", activePlantId!)
        .single();
      return data;
    },
    enabled: !!activePlantId,
    staleTime: 1000 * 60 * 2,
  });

  const solarPlantId = activePlant?.legacy_plant_id ?? null;

  // Fetch GD group categoria for generators (fallback when uc.categoria_gd is null)
  const isGenerator = uc?.papel_gd === "geradora" || uc?.tipo_uc === "gd_geradora";
  const { data: gdGroupForGenerator } = useQuery({
    queryKey: ["gd_group_categoria_for_uc", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("gd_groups")
        .select("categoria_gd")
        .eq("uc_geradora_id", id!)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!id && isGenerator,
    staleTime: 1000 * 60 * 5,
  });
  const resolvedCategoriaGd = uc?.categoria_gd || gdGroupForGenerator?.categoria_gd || null;

  const { data: credits = [] } = useUnitCredits(id ?? null);
  const deleteCredit = useDeleteUnitCredit();

  const totalCreditoAdicionado = credits.reduce((sum, c) => sum + Number(c.quantidade_kwh), 0);

  /** Update search params preserving navigation context (origin, gd_group, etc.) */
  const updateSearchParams = (updates: Parameters<typeof mergeUcSearchParams>[1]) => {
    setSearchParams(mergeUcSearchParams(searchParams, updates));
  };

  const handleDeleteCredit = async (creditId: string) => {
    try {
      await deleteCredit.mutateAsync({ id: creditId, unitId: id! });
      toast({ title: "Crédito removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUC = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("delete_uc_permanently" as any, { p_unit_id: id });
      const result = data as any;
      if (rpcError) throw rpcError;
      if (!result?.success) {
        toast({ title: "Não foi possível excluir", description: result?.error || "Erro desconhecido", variant: "destructive" });
        return;
      }
      toast({ title: "UC excluída permanentemente" });
      navigate("/admin/ucs");
    } catch (err: any) {
      toast({ title: "Erro ao excluir UC", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
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
  const hasContextualOrigin = !!navigationContext.fromUcId && navigationContext.fromUcId !== uc.id;

  const handleBack = () => {
    if (hasContextualOrigin && navigationContext.fromUcId) {
      navigate(
        buildUcDetailPath(navigationContext.fromUcId, {
          tab: navigationContext.returnTab || "overview",
          subtab: navigationContext.returnSubtab || null,
          origin: "gd-return",
          fromUcId: uc.id,
          fromUcName: uc.nome,
          fromUcCode: uc.codigo_uc,
          gdGroupId: navigationContext.gdGroupId,
          gdGroupName: navigationContext.gdGroupName,
        }),
      );
      return;
    }
    navigate("/admin/ucs");
  };

  return (
    <div className="space-y-0 pb-6">
      {/* Back button + Actions row */}
      <div className="p-4 md:px-6 md:pt-6 pb-0 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {hasContextualOrigin ? "Voltar para UC relacionada" : "Voltar"}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setEditDialogOpen(true)}>
            <Edit className="w-3.5 h-3.5" /> Editar
          </Button>
        </div>
      </div>

      {/* Contextual breadcrumb when navigating between related UCs */}
      {hasContextualOrigin && navigationContext.fromUcId && (
        <div className="mx-4 md:mx-6 mt-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexto de navegação</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground truncate">{navigationContext.fromUcName || "UC relacionada"}</span>
                {navigationContext.gdGroupName && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground truncate">{navigationContext.gdGroupName}</span>
                  </>
                )}
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground truncate">{uc.nome}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {navigationContext.origin === "gd-generator"
                  ? "Você abriu esta UC a partir da visão da geradora; o retorno para o grupo foi preservado."
                  : navigationContext.origin === "gd-beneficiary"
                    ? "Você abriu esta UC a partir de uma beneficiária vinculada; os atalhos mantêm ida e volta."
                    : "Navegação contextual entre UCs relacionadas está ativa."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleBack}>
                <ArrowLeft className="w-3 h-3" /> Voltar para UC
              </Button>
              <Button
                variant="soft"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() =>
                  navigate(
                    buildUcDetailPath(navigationContext.fromUcId!, {
                      tab: "gd",
                      origin: "gd-return",
                      fromUcId: uc.id,
                      fromUcName: uc.nome,
                      fromUcCode: uc.codigo_uc,
                      gdGroupId: navigationContext.gdGroupId,
                      gdGroupName: navigationContext.gdGroupName,
                    }),
                  )
                }
              >
                <Sun className="w-3 h-3" /> Voltar para GD
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero header banner — redesigned */}
      <div className="mx-4 md:mx-6 mt-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Icon */}
            <div className="h-14 w-14 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="h-7 w-7 text-primary" />
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-start gap-3 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-foreground truncate">{uc.nome}</h1>
                    <p className="text-sm text-muted-foreground font-mono mt-0.5">{uc.codigo_uc}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Acompanhe energia, faturas e relações de GD desta unidade consumidora.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20 font-medium">
                    {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
                  </Badge>
                  <StatusBadge variant={uc.is_archived ? "muted" : uc.status === "active" ? "success" : "warning"} dot>
                    {uc.is_archived ? "Arquivada" : uc.status === "active" ? "Ativa" : uc.status}
                  </StatusBadge>
                  {!(uc as any).cliente_id && (
                    <Badge variant="outline" className="text-xs border-warning/30 text-warning bg-warning/5">
                      Cliente não vinculado
                    </Badge>
                  )}
                </div>
              </div>

              {/* Detail chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Concessionária</p>
                    <p className="text-sm font-semibold text-foreground truncate">{uc.concessionaria_nome || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-info shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Classificação</p>
                    <p className="text-sm font-semibold text-foreground">{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` / ${uc.classificacao_subgrupo}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-warning shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Modalidade</p>
                    <p className="text-sm font-semibold text-foreground">{uc.modalidade_tarifaria || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-success shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Papel GD</p>
                    <p className="text-sm font-semibold text-foreground">
                      {PAPEL_GD_LABELS[uc.papel_gd] || uc.papel_gd || "Nenhum"}
                      {resolvedCategoriaGd && (
                        <span className="text-muted-foreground font-normal text-xs ml-1.5">
                          ({CATEGORIA_GD_LABELS[resolvedCategoriaGd] || resolvedCategoriaGd})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cadastro details — inline in hero */}
              {(enderecoStr || uc.email_fatura) && (
                <div className="mt-3 pt-3 border-t border-primary/10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {enderecoStr && (
                    <div className="flex gap-1.5 min-w-0 sm:col-span-2">
                      <span className="text-muted-foreground shrink-0">Endereço:</span>
                      <span className="text-foreground">{enderecoStr}</span>
                    </div>
                  )}
                  {uc.email_fatura && (
                    <div className="flex gap-1.5 min-w-0">
                      <span className="text-muted-foreground shrink-0">E-mail Fatura:</span>
                      <span className="text-foreground truncate">{uc.email_fatura}</span>
                    </div>
                  )}
                  {uc.observacoes && (
                    <div className="flex gap-1.5 min-w-0 sm:col-span-2 lg:col-span-3">
                      <span className="text-muted-foreground shrink-0">Obs:</span>
                      <span className="text-foreground truncate">{uc.observacoes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GD cards removed — info is now inside the GD tab */}

      {/* Tabs — reorganized into 6 groups */}
      <div className="p-4 md:p-6 space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            updateSearchParams({
              tab: v,
              subtab: v === "energia" ? (activeTab === "energia" && activeSubtab ? activeSubtab : "medidor")
                : v === "analise" ? (activeTab === "analise" && activeSubtab ? activeSubtab : "comparativo")
                : null,
            });
          }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-border bg-muted/20 p-2">
            <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
              <TabsTrigger value="overview" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
              <TabsTrigger value="energia" className="gap-1"><Gauge className="w-3.5 h-3.5" /> Energia</TabsTrigger>
              <TabsTrigger value="faturas" className="gap-1"><FileText className="w-3.5 h-3.5" /> Faturas</TabsTrigger>
              <TabsTrigger value="analise" className="gap-1"><TrendingUp className="w-3.5 h-3.5" /> Análise</TabsTrigger>
              <TabsTrigger value="gd" className="gap-1"><Sun className="w-3.5 h-3.5" /> GD</TabsTrigger>
              <TabsTrigger value="config" className="gap-1"><Settings className="w-3.5 h-3.5" /> Configurações</TabsTrigger>
            </TabsList>
          </div>

          {/* === VISÃO GERAL === */}
          <TabsContent value="overview" className="space-y-6">
            <UCOverviewTab
              ucId={uc.id}
              meterId={activeMeterIdResolved}
              plantId={activePlantId}
              meterName={activeMeter?.name ?? null}
              meterOnline={activeMeter?.online_status ?? null}
              plantName={activePlant?.name ?? null}
              plantCapacityKwp={activePlant?.installed_power_kwp ?? null}
              proximaLeituraData={(uc as any)?.proxima_leitura_data ?? null}
            />
          </TabsContent>

          {/* === ENERGIA (sub-tabs: Medidor | Usinas | Histórico) === */}
          <TabsContent value="energia" className="space-y-4">
            <EnergiaSubTabs
              activeSubtab={activeSubtab}
              onSubtabChange={(sub) => updateSearchParams({ tab: "energia", subtab: sub })}
              ucId={uc.id}
              ucTipo={uc.tipo_uc}
              meterId={activeMeterIdResolved}
              plantId={activePlantId}
              solarPlantId={solarPlantId}
              onSwitchParentTab={(tab) => updateSearchParams({ tab, subtab: tab === "energia" ? "medidor" : tab === "analise" ? "comparativo" : null })}
            />
          </TabsContent>

          {/* === FATURAS === forceMount to keep upload alive */}
          <TabsContent value="faturas" forceMount className="data-[state=inactive]:hidden">
            <UCInvoicesTab unitId={uc.id} />
          </TabsContent>

          {/* === ANÁLISE (sub-tabs: Comparativo | Economia) === */}
          <TabsContent value="analise" className="space-y-4">
            <AnaliseSubTabs
              activeSubtab={activeSubtab}
              onSubtabChange={(sub) => updateSearchParams({ tab: "analise", subtab: sub })}
              unitId={uc.id}
              simulacaoId={(uc as any).simulacao_id ?? null}
            />
          </TabsContent>

          {/* === GD === */}
          <TabsContent value="gd" className="space-y-6">
            <UCGdTab uc={uc} />
          </TabsContent>

          {/* === CONFIGURAÇÕES TAB === */}
          <TabsContent value="config" className="space-y-6">
            {/* Status do Sistema — visão geral operacional */}
            <SystemStatusCard
              unitId={uc.id}
              leituraAutomaticaEmail={uc.leitura_automatica_email}
              servicoCobrancaAtivo={(uc as any).servico_cobranca_ativo || false}
              onNavigateToSection={(section) => {
                const el = document.getElementById(section);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onAction={async (action) => {
                if (action === "billing-test") {
                  toast({ title: "Testando recebimento de faturas...", description: "Aguarde enquanto verificamos seus e-mails." });
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) throw new Error("Sessão inválida");
                    const res = await supabase.functions.invoke("check-billing-emails", {
                      body: { manual: true, unit_id: uc.id },
                    });
                    if (res.error) throw res.error;
                    toast({ title: "Teste concluído", description: "Verifique a aba de faturas para resultados." });
                    qc.invalidateQueries({ queryKey: ["system_status_invoice", uc.id] });
                    qc.invalidateQueries({ queryKey: ["system_status_log", uc.id] });
                  } catch (err: any) {
                    toast({ title: "Erro ao testar", description: err?.message || "Falha ao verificar e-mails.", variant: "destructive" });
                  }
                } else if (action === "portal-copy-link") {
                  const el = document.getElementById("section-portal");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  toast({ title: "Portal do Cliente", description: "Use os botões abaixo para copiar o link ou gerenciar o acesso." });
                }
              }}
            />

            {/* Recebimento de Faturas — unificado */}
            <div id="section-billing-settings">
              <UCBillingSettingsTab unitId={uc.id} leituraAutomaticaEmail={uc.leitura_automatica_email} />
            </div>

            {/* Alertas e Notificações */}
            {/* (AlertPhoneCard is inside UCBillingSettingsTab) */}

            {/* Plano de Serviço / Cobrança */}
            <div id="section-billing-plan">
              <UCServicePlanCard
                unitId={uc.id}
                planoServicoId={(uc as any).plano_servico_id || null}
                valorMensalidade={(uc as any).valor_mensalidade || null}
                diaVencimento={(uc as any).dia_vencimento || null}
                servicoCobrancaAtivo={(uc as any).servico_cobranca_ativo || false}
              />
            </div>

            {/* Histórico de Cobranças */}
            <UCBillingHistoryCard
              unitId={uc.id}
              clienteId={(uc as any).cliente_id || null}
              tenantId={uc.tenant_id}
              valorMensalidade={(uc as any).valor_mensalidade || null}
              diaVencimento={(uc as any).dia_vencimento || null}
            />

            {/* Portal do Cliente */}
            <div id="section-portal">
              <UCShareLinkButton unitId={uc.id} />
            </div>

            {/* Créditos GD */}
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
                  <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">                    <Table>
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
                                {formatDateTime(c.data_vigencia, { month: "2-digit", year: "numeric" })}
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

            {/* Zona de perigo */}
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-destructive">Zona de Perigo</CardTitle>
              </CardHeader>
              <CardContent>
                {!deleteConfirmOpen ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      Esta ação é irreversível e removerá permanentemente a UC e todos os dados associados (faturas, créditos, medidores, tokens).
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive text-destructive hover:bg-destructive/10 text-xs gap-1"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remover UC permanentemente
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-destructive">
                      Tem certeza que deseja excluir "{uc.nome}" ({uc.codigo_uc})?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Faturas, créditos, medidores vinculados, tokens de acesso e configurações de cobrança serão removidos permanentemente.
                      {uc.papel_gd !== "none" && (
                        <span className="block mt-1 font-medium text-warning">
                          ⚠️ Se esta UC estiver vinculada a um grupo GD, a exclusão será bloqueada. Remova as associações GD primeiro.
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive text-destructive hover:bg-destructive/10 text-xs gap-1"
                        onClick={handleDeleteUC}
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {isDeleting ? "Excluindo..." : "Confirmar exclusão"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={isDeleting}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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

// ─── Sub-tab wrapper: Energia (Medidor | Usinas | Histórico) ───
interface EnergiaSubTabsProps {
  activeSubtab: string;
  onSubtabChange: (sub: string) => void;
  ucId: string;
  ucTipo: string;
  meterId: string | null;
  plantId: string | null;
  solarPlantId: string | null;
  onSwitchParentTab: (tab: string) => void;
}

function EnergiaSubTabs({ activeSubtab, onSubtabChange, ucId, ucTipo, meterId, plantId, solarPlantId, onSwitchParentTab }: EnergiaSubTabsProps) {
  const sub = activeSubtab || "medidor";

  return (
    <Tabs value={sub} onValueChange={onSubtabChange} className="space-y-4">
      <TabsList className="h-8 gap-0.5">
        <TabsTrigger value="medidor" className="text-xs h-7 px-3 gap-1"><Gauge className="w-3 h-3" /> Medidor</TabsTrigger>
        <TabsTrigger value="usinas" className="text-xs h-7 px-3 gap-1"><Activity className="w-3 h-3" /> Usinas</TabsTrigger>
        <TabsTrigger value="historico" className="text-xs h-7 px-3 gap-1"><Calendar className="w-3 h-3" /> Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="medidor" className="space-y-6">
        <UCMeterTab unitId={ucId} />
      </TabsContent>

      <TabsContent value="usinas" className="space-y-6">
        <UCPlantLinksTab unitId={ucId} ucTipo={ucTipo} />
      </TabsContent>

      <TabsContent value="historico" className="space-y-6">
        <UCHistoricoTab
          ucId={ucId}
          meterId={meterId}
          plantId={plantId}
          solarPlantId={solarPlantId}
          onSwitchParentTab={onSwitchParentTab}
        />
      </TabsContent>
    </Tabs>
  );
}

// ─── Sub-tab wrapper: Análise (Comparativo | Economia) ───
interface AnaliseSubTabsProps {
  activeSubtab: string;
  onSubtabChange: (sub: string) => void;
  unitId: string;
  simulacaoId: string | null;
}

function AnaliseSubTabs({ activeSubtab, onSubtabChange, unitId, simulacaoId }: AnaliseSubTabsProps) {
  const sub = activeSubtab || "comparativo";

  return (
    <Tabs value={sub} onValueChange={onSubtabChange} className="space-y-4">
      <TabsList className="h-8 gap-0.5">
        <TabsTrigger value="comparativo" className="text-xs h-7 px-3 gap-1"><TrendingUp className="w-3 h-3" /> Comparativo</TabsTrigger>
        <TabsTrigger value="economia" className="text-xs h-7 px-3 gap-1"><DollarSign className="w-3 h-3" /> Economia</TabsTrigger>
      </TabsList>

      <TabsContent value="comparativo" className="space-y-6">
        <UCComparativoTab unitId={unitId} simulacaoId={simulacaoId} />
      </TabsContent>

      <TabsContent value="economia" className="space-y-6">
        <UCEconomyReportTab unitId={unitId} />
      </TabsContent>
    </Tabs>
  );
}