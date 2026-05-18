import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, X, Check, ChevronDown, ChevronRight, Trash2, Loader2, GripVertical, Trophy, XCircle, AlertTriangle,
  Package, Truck, DollarSign, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useUserFunnelOrder } from "@/hooks/useUserFunnelOrder";
import { useUserRole } from "@/hooks/useUserRole";
import { formatBRL } from "@/lib/formatters";
import { VincularFornecedorModal } from "@/components/vendor/VincularFornecedorModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


// Aba arrastável de pipeline (funil) no detalhe do projeto.
// UX: o chip inteiro é o handle — o clique ainda seleciona graças ao
// activationConstraint por distância no PointerSensor.
function SortablePipelineTab({
  membershipId,
  pipelineName,
  active,
  onSelect,
}: {
  membershipId: string;
  pipelineName: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: membershipId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          onClick={onSelect}
          {...attributes}
          {...listeners}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 touch-none select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
            active
              ? "bg-secondary/10 text-secondary border border-secondary/30 shadow-sm"
              : "bg-muted/40 text-muted-foreground hover:bg-muted/80 border border-transparent",
          )}
        >
          <GripVertical className="h-3 w-3 opacity-50" />
          {pipelineName}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        Arraste para reordenar • Clique para selecionar
      </TooltipContent>
    </Tooltip>
  );
}

interface PipelineInfo {
  id: string;
  name: string;
}

interface StageInfo {
  id: string;
  name: string;
  position: number;
  is_closed: boolean;
  is_won: boolean;
  probability: number;
}

interface DealPipelineMembership {
  id: string;
  pipeline_id: string;
  stage_id: string;
  pipeline_name: string;
  stage_name: string;
}

interface Props {
  dealId: string;
  projetoId?: string | null;
  dealStatus?: string;
  pipelines: PipelineInfo[];
  allStagesMap: Map<string, StageInfo[]>;
  onMembershipChange?: () => void;
  /** ID do pipeline a selecionar por default (ex: quando vem do kanban) */
  initialPipelineId?: string;
  /** Nome do funil selecionado no kanban, usado quando IDs não batem */
  initialPipelineName?: string;
}

export function ProjetoMultiPipelineManager({ dealId, projetoId, dealStatus, pipelines, allStagesMap, onMembershipChange, initialPipelineId, initialPipelineName }: Props) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const projetoIdFromPath = location.pathname.match(/projeto=([0-9a-f-]{36})/i)?.[1] ?? null;
  const projetoIdAtual = projetoId || searchParams.get("projeto") || searchParams.get("projeto_id") || projetoIdFromPath || dealId;
  const isCommercialLocked = dealStatus === "lost" || dealStatus === "won";
  const isTechnicalLocked = dealStatus === "lost" || dealStatus === "canceled";
  const { isAdmin } = useUserRole();
  const [memberships, setMemberships] = useState<DealPipelineMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(initialPipelineId || null);
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Estados para o modal de validação de checklist
  const [validationDialog, setValidationDialog] = useState<{
    isOpen: boolean;
    membershipId: string;
    newStageId: string;
    missingDocs: string[];
  }>({
    isOpen: false,
    membershipId: "",
    newStageId: "",
    missingDocs: [],
  });

  // Estado para interceptador de fornecedor
  const [fornecedorModal, setFornecedorModal] = useState<{
    projetoId: string;
    projetoCodigo?: string;
    clienteNome?: string;
    etapaId: string;
    etapaNome: string;
    membershipId: string;
  } | null>(null);

  // Estado para exibir dados do fornecedor/ordem abaixo das bolinhas
  const [ordemCompra, setOrdemCompra] = useState<any>(null);
  const [loadingOrdem, setLoadingOrdem] = useState(false);

  const [projectData, setProjectData] = useState<any>(null);

  const fetchProjectData = useCallback(async () => {
    if (!dealId) return;
    const { data } = await supabase
      .from("projetos")
      .select("tenant_id, cliente_id, codigo, projeto_num, clientes(nome)")
      .eq("id", dealId)
      .maybeSingle();
    
    if (data) {
      setProjectData({
        ...data,
        cliente_nome: (data.clientes as any)?.nome
      });
    }
  }, [dealId]);

  const fetchOrdemCompra = useCallback(async () => {
    if (!dealId) return;
    setLoadingOrdem(true);
    try {
      const { data, error } = await supabase
        .from('ordens_compra')
        .select('*, fornecedores(nome, telefone)')
        .eq('projeto_id', dealId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setOrdemCompra(data);
    } catch (err) {
      console.error("Erro ao buscar ordem de compra:", err);
    } finally {
      setLoadingOrdem(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchOrdemCompra();
    fetchProjectData();
  }, [fetchOrdemCompra, fetchProjectData]);


  // Load memberships
  const fetchMemberships = async () => {
    const { data } = await supabase
      .from("deal_pipeline_stages")
      .select("id, pipeline_id, stage_id")
      .eq("deal_id", dealId);

    if (data) {
      const mapped: DealPipelineMembership[] = (data as any[]).map(m => {
        const pipeline = pipelines.find(p => p.id === m.pipeline_id);
        const stages = allStagesMap.get(m.pipeline_id) || [];
        const stage = stages.find(s => s.id === m.stage_id);
        return {
          id: m.id,
          pipeline_id: m.pipeline_id,
          stage_id: m.stage_id,
          pipeline_name: pipeline?.name || "—",
          stage_name: stage?.name || "—",
        };
      });
      setMemberships(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMemberships(); }, [dealId, pipelines.length]);

  // Auto-select first pipeline tab when memberships load
  useEffect(() => {
    if (memberships.length === 0) return;

    const hasCurrent = activePipelineId && memberships.some(m => m.pipeline_id === activePipelineId);
    if (hasCurrent) return;

    const normalizedInitialName = (initialPipelineName || "").trim().toLowerCase();
    const byId = initialPipelineId && memberships.find(m => m.pipeline_id === initialPipelineId)?.pipeline_id;
    const byName = normalizedInitialName
      ? memberships.find(m => m.pipeline_name.trim().toLowerCase() === normalizedInitialName)?.pipeline_id
      : null;

    setActivePipelineId(byId || byName || memberships[0].pipeline_id);
  }, [memberships, activePipelineId, initialPipelineId, initialPipelineName]);

  // Ordem: (1) canônica via pipelines.position (ordem exibida na aba Projetos),
  // (2) sobrescrita pela preferência pessoal do usuário via drag-and-drop.
  const { sortByUserOrder, setOrder } = useUserFunnelOrder("deal-pipelines");
  const pipelineOrderIndex = useMemo(() => {
    const m = new Map<string, number>();
    pipelines.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [pipelines]);
  const orderedMemberships = useMemo(() => {
    const canonical = [...memberships].sort((a, b) => {
      const pa = pipelineOrderIndex.get(a.pipeline_id) ?? Number.POSITIVE_INFINITY;
      const pb = pipelineOrderIndex.get(b.pipeline_id) ?? Number.POSITIVE_INFINITY;
      return pa - pb;
    });
    // sortByUserOrder ordena por `.id`; usamos pipeline_id como chave de ordenação
    // mas restauramos o id original (membership.id) para não quebrar mutations.
    const byPipelineId = canonical.map((m) => ({ ...m, id: m.pipeline_id, _membershipId: m.id }));
    const sorted = sortByUserOrder(byPipelineId) as Array<DealPipelineMembership & { _membershipId: string }>;
    return sorted.map(({ _membershipId, ...rest }) => ({ ...rest, id: _membershipId })) as DealPipelineMembership[];
  }, [memberships, pipelineOrderIndex, sortByUserOrder]);

  const activeMembership = orderedMemberships.find(m => m.pipeline_id === activePipelineId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const handleTabDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = orderedMemberships.map((m) => m.pipeline_id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(ids, oldIndex, newIndex));
  };

  const availablePipelines = useMemo(() =>
    pipelines.filter(p => !memberships.some(m => m.pipeline_id === p.id)),
    [pipelines, memberships]
  );

  const addToPipeline = async (pipelineId: string, stageId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    
    const pipelineName = (
      pipeline?.name || 
      pipelines.find(p => p.id === pipelineId)?.name || 
      ""
    ).toLowerCase();

    const isComercial = pipelineName.includes("comercial") || pipelineName.includes("venda");
    const locked = isComercial ? isCommercialLocked : isTechnicalLocked;
    
    if (locked) { 
      toast({ 
        title: "Funil bloqueado", 
        description: `Não é possível adicionar ao funil ${pipeline?.name} devido ao status do projeto.`, 
        variant: "destructive" 
      }); 
      return; 
    }
    setSaving(pipelineId);
    try {
      const { error } = await supabase.from("deal_pipeline_stages").insert({
        deal_id: dealId,
        pipeline_id: pipelineId,
        stage_id: stageId,
      } as any);
      if (error) throw error;
      toast({ title: "Projeto adicionado ao funil" });
      await fetchMemberships();
      onMembershipChange?.();
      setExpandedPipeline(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const changeStage = async (membershipId: string, newStageId: string, force = false) => {
    const membership = memberships.find(m => m.id === membershipId);
    const stages = allStagesMap.get(membership?.pipeline_id || "") || [];
    const newStage = stages.find(s => s.id === newStageId);
    
    const pipelineName = (
      membership?.pipeline_name || 
      pipelines.find(p => p.id === membership?.pipeline_id)?.name || 
      ""
    ).toLowerCase();

    const isComercial = pipelineName.includes("comercial") || pipelineName.includes("venda");
    const locked = isComercial ? isCommercialLocked : isTechnicalLocked;

    if (locked) { 
      toast({ 
        title: "Funil bloqueado", 
        description: `Não é possível alterar etapas no funil ${membership?.pipeline_name} due to status do projeto.`, 
        variant: "destructive" 
      }); 
      return; 
    }

    setSaving(membershipId);
    try {
      const { data: validations } = await supabase
        .from("pipeline_stage_validations")
        .select(`
          *,
          pipeline_stages!inner (
            id,
            position
          )
        `)
        .eq("ativo", true)
        .or(
          `stage_id.eq.${newStageId},` +
          `and(aplicar_a_partir.eq.true,pipeline_stages.position.lte.${newStage?.position})`
        );

      if (validations && validations.length > 0) {
        const [projectDocsRes, customFieldsRes, fieldsRes, ordersRes] = await Promise.all([
          supabase.from("project_documents" as any).select("categoria").eq("deal_id", dealId).eq("is_deleted", false),
          supabase.from("deal_custom_field_values").select("field_id, value_text").eq("deal_id", dealId),
          supabase.from("deal_custom_fields").select("id, field_key"),
          supabase.from("ordens_compra").select("id").eq("projeto_id", dealId).limit(1)
        ]);

        const projectDocuments = (projectDocsRes.data || []) as any[];
        const customFieldValues = (customFieldsRes.data || []) as any[];
        const fields = (fieldsRes.data || []) as any[];
        const hasOrder = (ordersRes.data || []).length > 0;

        const results = validations.map(v => {
          let fulfilled = false;
          const config = (v.configuracao || {}) as any;
          
          switch (v.tipo_validacao) {
            case 'documento_obrigatorio':
              fulfilled = projectDocuments.some((d: any) => d.categoria === config.documento_tipo);
              if (!fulfilled) {
                const categoryToKey: Record<string, string> = {
                  'rg_cnh': 'cap_identidade',
                  'conta_luz': 'cap_comprovante_endereco',
                  'iptu': 'cap_documentos',
                  'contrato_assinado': 'cap_contrato'
                };
                const legacyKey = categoryToKey[config.documento_tipo];
                if (legacyKey) {
                  const fieldId = fields.find(f => f.field_key === legacyKey)?.id;
                  const val = customFieldValues.find((val: any) => val.field_id === fieldId)?.value_text;
                  if (val && val !== "[]" && val !== "") fulfilled = true;
                }
              }
              break;
            case 'fornecedor_vinculado':
              fulfilled = hasOrder;
              break;
            case 'campo_preenchido':
              const directValue = projectData?.[config.campo];
              if (directValue !== undefined && directValue !== null && directValue !== "") {
                fulfilled = true;
              } else {
                const fId = fields.find(f => f.field_key === config.campo)?.id;
                const cVal = customFieldValues.find((val: any) => val.field_id === fId)?.value_text;
                if (cVal && cVal !== "" && cVal !== "[]") fulfilled = true;
              }
              break;
            case 'valor_minimo':
              const fieldVal = projectData?.[config.campo] || 0;
              fulfilled = Number(fieldVal) >= (config.valor_minimo || 0);
              break;
            case 'aprovacao_manual':
              fulfilled = false; 
              break;
          }
          return { ...v, fulfilled };
        });

        const blocking = results.filter(r => !r.fulfilled && r.bloquear_avanco);
        const warnings = results.filter(r => !r.fulfilled && !r.bloquear_avanco);

        if (!force && blocking.length > 0) {
          setValidationDialog({
            isOpen: true,
            membershipId,
            newStageId,
            missingDocs: blocking.map(b => b.mensagem_bloqueio || (b.configuracao as any)?.label || b.tipo_validacao)
          });
          setSaving(null);
          return;
        }

        warnings.forEach(w => {
          toast({
            title: "Atenção: Pendência",
            description: w.mensagem_bloqueio || `A etapa requer: ${(w.configuracao as any)?.label || w.tipo_validacao}`,
            variant: "warning" as any
          });
        });
      }
    } catch (err) {
      console.error("Erro no sistema de validações:", err);
    } finally {
      // Logic continues to the standard stage change if not blocked
    }

    // Interceptor: Pedido Efetuado
    const stageName = newStage?.name?.toLowerCase() || "";
    const isPedidoEfetuado = stageName.includes('pedido efetuado');
    const isPedidoPago = stageName.includes('pedido pago');

    if (isPedidoEfetuado) {
      const { data: ordens } = await supabase
        .from('ordens_compra')
        .select('id, fornecedor_id, fornecedores(nome)')
        .eq('projeto_id', dealId)
        .limit(1);

      if (ordens && ordens.length > 0) {
        const confirmar = window.confirm(
          `Fornecedor ${ordens[0].fornecedores?.nome} já vinculado.\nConfirmar avanço para "${newStage?.name}"?`
        );
        if (!confirmar) {
          setSaving(null);
          return;
        }
      } else {
        setFornecedorModal({
          projetoId: dealId,
          etapaId: newStageId,
          etapaNome: newStage?.name || "",
          membershipId
        });
        setSaving(null);
        return;
      }
    }

    // Validação: Pedido Pago sem ordem
    if (isPedidoPago) {
      const { data: ordens } = await supabase
        .from('ordens_compra')
        .select('id')
        .eq('projeto_id', dealId)
        .limit(1);

      if (!ordens || ordens.length === 0) {
        toast({
          title: "Ação bloqueada",
          description: 'Registre o fornecedor em "Pedido Efetuado" antes de avançar.',
          variant: "destructive"
        });
        setSaving(null);
        return;
      }
    }

    setSaving(membershipId);
    try {
      const { error } = await supabase
        .from("deal_pipeline_stages")
        .update({ stage_id: newStageId })
        .eq("id", membershipId);
      if (error) throw error;

      // Sincronizar status da ordem com a etapa do funil de Equipamento
      if (membership?.pipeline_name.toLowerCase().includes('equipamento') || membership?.pipeline_name.toLowerCase().includes('suprimentos')) {
        let novoStatus: string | null = null;
        if (stageName.includes('pedido efetuado')) novoStatus = 'pedido_efetuado';
        else if (stageName.includes('pedido pago')) novoStatus = 'deposito_pago';
        else if (stageName.includes('depósito')) novoStatus = 'deposito_confirmado';
        else if (stageName.includes('cliente')) novoStatus = 'entregue_cliente';
        else if (stageName.includes('instalação')) novoStatus = 'instalado';
        else if (stageName.includes('sistema em operação')) novoStatus = 'concluido';

        if (novoStatus) {
          const { data: ordem } = await supabase
            .from('ordens_compra')
            .select('id')
            .eq('projeto_id', dealId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ordem) {
            await supabase
              .from('ordens_compra')
              .update({ status: novoStatus } as any)
              .eq('id', (ordem as any).id);
            fetchOrdemCompra();
          }
        }
      }

      toast({ title: "Etapa atualizada" });

      // Notificar Hub
      supabase.functions.invoke('notification-hub', {
        body: {
          evento: 'projeto_status_mudou',
          tenant_id: (membership as any)?.tenant_id || projectData?.tenant_id,
          dados: {
            projeto_id: dealId,
            status_novo: stageName,
            cliente_id: projectData?.cliente_id
          }
        }
      }).catch(err => console.error("[notification-hub] Erro ao invocar:", err));

      await fetchMemberships();
      onMembershipChange?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeFromPipeline = async (membershipId: string) => {
    const membership = memberships.find(m => m.id === membershipId);
    
    const pipelineName = (
      membership?.pipeline_name || 
      pipelines.find(p => p.id === membership?.pipeline_id)?.name || 
      ""
    ).toLowerCase();

    const isComercial = pipelineName.includes("comercial") || pipelineName.includes("venda");
    const locked = isComercial ? isCommercialLocked : isTechnicalLocked;

    if (locked) { 
      toast({ 
        title: "Funil bloqueado", 
        description: `Não é possível remover do funil ${membership?.pipeline_name} devido ao status do projeto.`, 
        variant: "destructive" 
      }); 
      return; 
    }

    // Encontrar o membership alvo para validar regras de negócio
    const target = memberships.find(m => m.id === membershipId);
    if (!target) {
      toast({ title: "Erro", description: "Funil não encontrado.", variant: "destructive" });
      return;
    }

    // Bloquear remoção do funil PRIMÁRIO do deal (Comercial). Senão a trigger
    // sync_deal_primary_pipeline_membership recria o registro automaticamente.
    const { data: dealRow } = await supabase
      .from("deals")
      .select("pipeline_id")
      .eq("id", dealId)
      .maybeSingle();
    if (dealRow?.pipeline_id === target.pipeline_id) {
      toast({
        title: "Não é possível remover",
        description: "Este é o funil principal do projeto. Mova o projeto para outro funil principal antes de remover.",
        variant: "destructive",
      });
      return;
    }

    setSaving(membershipId);
    try {
      // .select() força retornar as linhas afetadas — assim detectamos RLS silencioso
      const { data, error } = await supabase
        .from("deal_pipeline_stages")
        .delete()
        .eq("id", membershipId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhum registro foi removido (verifique permissões).");
      }
      toast({ title: "Removido do funil" });
      await fetchMemberships();
      onMembershipChange?.();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  /**
   * Marca o resultado (ganho/perdido) deste funil específico:
   *  - Move o projeto para a etapa terminal correspondente do pipeline
   *  - Se o pipeline for "Comercial", também atualiza deals.status (sincroniza
   *    com os botões globais Ganhar/Perder do topo do detalhe)
   * Permite alternar entre won ↔ lost mesmo quando o deal já está fechado.
   */
  const markFunnelOutcome = async (
    membership: DealPipelineMembership,
    outcome: "won" | "lost",
  ) => {
    const stages = allStagesMap.get(membership.pipeline_id) || [];
    const target = outcome === "won"
      ? stages.find(s => s.is_won)
      : stages.find(s => s.is_closed && !s.is_won);

    if (!target) {
      toast({
        title: "Etapa não configurada",
        description: `Este funil não possui etapa de ${outcome === "won" ? "ganho" : "perda"}. Configure em Configurações > Funis.`,
        variant: "destructive",
      });
      return;
    }
    if (target.id === membership.stage_id && (membership.pipeline_name.toLowerCase() !== "comercial")) {
      return;
    }

    setSaving(membership.id);
    try {
      const { error: stageErr } = await supabase
        .from("deal_pipeline_stages")
        .update({ stage_id: target.id })
        .eq("id", membership.id);
      if (stageErr) throw stageErr;

      // Sincroniza deals.status apenas para o funil Comercial
      const isComercial = membership.pipeline_name.trim().toLowerCase() === "comercial" || membership.pipeline_name.trim().toLowerCase() === "vendas";
      if (isComercial) {
        const { error: dealErr } = await supabase
          .from("deals")
          .update({ status: outcome })
          .eq("id", dealId);
        if (dealErr) throw dealErr;

        // Ao ganhar o funil comercial, dispara criação automática de funis técnicos
        if (outcome === "won") {
          autoCreateTechnicalPipelines();
        }
      }


      toast({
        title: outcome === "won" ? "Funil marcado como Ganho" : "Funil marcado como Perdido",
        description: membership.pipeline_name,
      });
      await fetchMemberships();
      onMembershipChange?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const autoCreateTechnicalPipelines = async () => {
    // Busca dados do projeto para a notificação
    const { data: projData } = await supabase
      .from("projetos")
      .select("id, tenant_id, valor_total, potencia_kwp, cliente_id, responsavel_tecnico_id, clientes:cliente_id(nome)")
      .eq("deal_id", dealId)
      .maybeSingle();

    const projeto = projData as any;
    
    // Busca funis configurados no tenant

    const technicalKeywords = ["engenharia", "equipamento", "instalação", "pós-venda", "execução"];
    const toAdd = pipelines.filter(p => 
      technicalKeywords.some(kw => p.name.toLowerCase().includes(kw)) &&
      !memberships.some(m => m.pipeline_id === p.id)
    );

    if (toAdd.length === 0) return;

    let createdCount = 0;
    for (const pipeline of toAdd) {
      const stages = allStagesMap.get(pipeline.id) || [];
      const firstStage = stages.sort((a, b) => a.position - b.position)[0];
      if (!firstStage) continue;

      const { error } = await supabase.from("deal_pipeline_stages").insert({
        deal_id: dealId,
        pipeline_id: pipeline.id,
        stage_id: firstStage.id,
      } as any);

      if (!error) createdCount++;
    }

    if (createdCount > 0) {
      toast({ 
        title: "Projeto em execução", 
        description: `${createdCount} funis técnicos criados automaticamente.` 
      });

      // Dispara notificações de handoff
      if (projeto && projeto.responsavel_tecnico_id) {
        const clienteNome = projeto.clientes?.nome || "Cliente";
        const valor = projeto.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
        const kwp = projeto.potencia_kwp || 0;
        
        // 1. Notificação interna
        await supabase.from("user_notifications").insert({
          tenant_id: projeto.tenant_id,
          user_id: projeto.responsavel_tecnico_id,
          tipo: 'novo_projeto',
          titulo: 'Novo projeto para execução',
          mensagem: `Cliente: ${clienteNome} — ${valor} — ${kwp} kWp. Atribuído a você.`,
          link: `/admin/projetos?projeto=${projeto.id}`,
          metadata: { projeto_id: projeto.id, deal_id: dealId }
        });

        // 2. WhatsApp (se configurado)
        try {
          const { data: waConfig } = await supabase
            .from("whatsapp_automation_config")
            .select("ativo")
            .eq("tenant_id", projeto.tenant_id)
            .maybeSingle();

          if (waConfig?.ativo) {
            const { data: tecnico } = await supabase
              .from("profiles")
              .select("telefone")
              .eq("user_id", projeto.responsavel_tecnico_id)
              .maybeSingle();

            if (tecnico?.telefone) {
              const msg = `Novo projeto atribuído: ${clienteNome}. ${valor}, ${kwp} kWp. Acesse: ${window.location.origin}/admin/projetos?projeto=${projeto.id}`;
              await supabase.functions.invoke("send-whatsapp-message", {
                body: {
                  telefone: tecnico.telefone,
                  mensagem: msg,
                  tenant_id: projeto.tenant_id,
                  tipo: "automatico"
                }
              });
            }
          }
        } catch (waErr) {
          console.error("Erro ao enviar WA de handoff:", waErr);
        }
      }

      await fetchMemberships();
      onMembershipChange?.();
    }
  };



  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando funis...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Diálogo de Validação de Checklist */}
      <AlertDialog 
        open={validationDialog.isOpen} 
        onOpenChange={(open) => !open && setValidationDialog(prev => ({ ...prev, isOpen: false }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Documentos Obrigatórios Faltando
            </AlertDialogTitle>
            <AlertDialogDescription>
              Para avançar para <strong>Engenharia</strong>, os seguintes documentos são obrigatórios:
              <ul className="list-disc list-inside mt-2 space-y-1 text-foreground">
                {validationDialog.missingDocs.map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
              <p className="mt-4">
                {isAdmin 
                  ? "Deseja avançar mesmo assim? Como administrador, você pode forçar esta transição."
                  : "Por favor, anexe os documentos necessários antes de avançar a etapa."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e anexar</AlertDialogCancel>
            {isAdmin && (
              <AlertDialogAction
                className="bg-warning hover:bg-warning/90 text-warning-foreground"
                onClick={() => {
                  changeStage(validationDialog.membershipId, validationDialog.newStageId, true);
                  setValidationDialog(prev => ({ ...prev, isOpen: false }));
                }}
              >
                Avançar mesmo assim
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Funis do Projeto
          </span>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {memberships.length}
          </Badge>
        </div>

        {/* Add to pipeline popover */}
        {availablePipelines.length > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="default" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Adicionar a funil
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="p-3 border-b border-border/40">
                <p className="text-sm font-medium">Adicionar a um funil</p>
                <p className="text-xs text-muted-foreground mt-0.5">Selecione o funil e a etapa inicial</p>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {availablePipelines.map(pipeline => {
                  const pStages = (allStagesMap.get(pipeline.id) || []).sort((a, b) => a.position - b.position);
                  const isExpanded = expandedPipeline === pipeline.id;
                  return (
                    <div key={pipeline.id}>
                      <button
                        onClick={() => setExpandedPipeline(isExpanded ? null : pipeline.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 rounded-md transition-colors"
                      >
                        <span className="font-medium">{pipeline.name}</span>
                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 pb-1 space-y-0.5">
                              {pStages.map(stage => (
                                <button
                                  key={stage.id}
                                  onClick={() => addToPipeline(pipeline.id, stage.id)}
                                  disabled={saving === pipeline.id || (pipeline.name.toLowerCase().includes("comercial") ? isCommercialLocked : isTechnicalLocked)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-primary/5 rounded-md transition-colors text-left disabled:opacity-50"
                                >
                                  {saving === pipeline.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <div className={cn(
                                      "w-2 h-2 rounded-full shrink-0",
                                      stage.is_won ? "bg-success" : stage.is_closed ? "bg-destructive" : "bg-info"
                                    )} />
                                  )}
                                  <span>{stage.name}</span>
                                  <span className="text-muted-foreground ml-auto">{stage.probability}%</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Tabs for pipeline memberships */}
      {memberships.length > 0 && (
        <div className="space-y-2">
          {/* Tab bar — ordem canônica (pipelines.position) sobrescrita por preferência pessoal */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
            <SortableContext
              items={orderedMemberships.map((m) => m.pipeline_id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {orderedMemberships.map((membership) => (
                  <SortablePipelineTab
                    key={membership.id}
                    membershipId={membership.pipeline_id}
                    pipelineName={membership.pipeline_name}
                    active={activePipelineId === membership.pipeline_id}
                    onSelect={() => setActivePipelineId(membership.pipeline_id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Active pipeline stepper */}
          {activeMembership && (() => {
            const allPStages = (allStagesMap.get(activeMembership.pipeline_id) || []).sort((a, b) => a.position - b.position);
            // Separate linear stages from terminal "lost" stages (is_closed && !is_won)
            const linearStages = allPStages.filter(s => !(s.is_closed && !s.is_won));
            const terminalLostStages = allPStages.filter(s => s.is_closed && !s.is_won);
            const currentLinearIndex = linearStages.findIndex(s => s.id === activeMembership.stage_id);
            const isOnTerminal = terminalLostStages.some(s => s.id === activeMembership.stage_id);
            const isComercial = activeMembership.pipeline_name.toLowerCase() === "comercial";

            return (
              <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2 min-h-[100px]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{activeMembership.pipeline_name}</span>
                  <div className="flex items-center gap-1.5">
                    {/* Botões Ganhar / Perder por funil */}
                    {(() => {
                      const wonStage = allPStages.find(s => s.is_won);
                      const lostStage = allPStages.find(s => s.is_closed && !s.is_won);
                      const isOnWon = wonStage && wonStage.id === activeMembership.stage_id;
                      const isOnLost = lostStage && lostStage.id === activeMembership.stage_id;
                      const busy = saving === activeMembership.id;
                      return (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={isOnWon ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-7 text-xs gap-1",
                                  isOnWon
                                    ? "bg-success text-success-foreground hover:bg-success/90 border-success"
                                    : "text-success border-success/30 hover:bg-success/10 hover:text-success",
                                )}
                                onClick={() => markFunnelOutcome(activeMembership, "won")}
                                disabled={busy || !wonStage || isOnWon}
                              >
                                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trophy className="h-3 w-3" />}
                                Ganhar
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {wonStage
                                ? `Marcar este funil como ganho (${wonStage.name})`
                                : "Funil sem etapa de ganho configurada"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={isOnLost ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-7 text-xs gap-1",
                                  isOnLost
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive"
                                    : "text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive",
                                )}
                                onClick={() => markFunnelOutcome(activeMembership, "lost")}
                                disabled={busy || !lostStage || isOnLost}
                              >
                                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                Perder
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {lostStage
                                ? `Marcar este funil como perdido (${lostStage.name})`
                                : "Funil sem etapa de perda configurada"}
                            </TooltipContent>
                          </Tooltip>
                        </>
                      );
                    })()}
                    {!isComercial && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromPipeline(activeMembership.id)}
                            disabled={saving === activeMembership.id || isTechnicalLocked}
                          >
                            {saving === activeMembership.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          Remover deste funil
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>


                {/* Mini stepper — linear stages only */}
                <div className="relative pt-1">
                  <div className="absolute top-[14px] left-0 right-0 h-0.5 bg-border rounded-full" />
                  {linearStages.length > 1 && !isOnTerminal && currentLinearIndex >= 0 && (
                    <motion.div
                      className="absolute top-[14px] left-0 h-0.5 bg-success rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(currentLinearIndex / (linearStages.length - 1)) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  )}
                  <div className="relative flex justify-between">
                    {linearStages.map((stage, i) => {
                      const isPast = !isOnTerminal && i < currentLinearIndex;
                      const isCurrent = !isOnTerminal && i === currentLinearIndex;
                      const isFuture = isOnTerminal || i > currentLinearIndex;

                      return (
                        <Tooltip key={stage.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (stage.id !== activeMembership.stage_id) {
                                  const locked = isComercial ? isCommercialLocked : isTechnicalLocked;
                                  if (!locked) {
                                    changeStage(activeMembership.id, stage.id);
                                  } else {
                                    toast({ title: "Funil bloqueado", variant: "destructive" });
                                  }
                                }
                              }}
                              className="flex flex-col items-center z-10 group cursor-pointer gap-1"
                            >
                              <motion.div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                  isPast && "bg-success border-success",
                                  isCurrent && "bg-secondary border-secondary ring-2 ring-secondary/30 ring-offset-1 ring-offset-card",
                                  isFuture && "bg-card border-border",
                                  !isCurrent && "group-hover:ring-1 group-hover:ring-primary/20"
                                )}
                                animate={{ scale: isCurrent ? 1.15 : 1 }}
                                transition={{ duration: 0.3 }}
                              >
                                {isPast && <Check className="h-2.5 w-2.5 text-success-foreground" />}
                              </motion.div>
                              <span className={cn(
                                "text-[9px] font-medium max-w-[60px] text-center leading-tight",
                                isPast && "text-success",
                                isCurrent && "text-secondary font-bold",
                                isFuture && "text-muted-foreground"
                              )}>
                                {stage.name}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {stage.name} • {stage.probability}%
                            {isCurrent && " (atual)"}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Exibição do fornecedor se for funil de Equipamento */}
                {(activeMembership.pipeline_name.toLowerCase().includes('equipamento') || activeMembership.pipeline_name.toLowerCase().includes('suprimentos')) && ordemCompra && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-lg border border-border bg-muted/30 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        {ordemCompra.fornecedores?.nome || "Fornecedor vinculado"}
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase h-4 px-1 bg-background">
                        {ordemCompra.status || 'Pendente'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        Pedido: {ordemCompra.numero_pedido || "—"}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatBRL(ordemCompra.valor_total || 0)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Entrega: {ordemCompra.data_previsao_entrega ? new Date(ordemCompra.data_previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Bloco 1: Aviso de fornecedor ausente (GAP 1) */}
                {(() => {
                  const stageName = activeMembership.stage_name.toLowerCase();
                  // Regra: Funil de Equipamento, etapa >= "Pedido Efetuado" (ou "Pedido Pago"), sem ordem de compra
                  const isEquipamento = activeMembership.pipeline_name.toLowerCase().includes('equipamento') || 
                                      activeMembership.pipeline_name.toLowerCase().includes('suprimentos');
                  const needsOrdem = stageName.includes('pedido pago') || 
                                    stageName.includes('depósito') || 
                                    stageName.includes('cliente') || 
                                    stageName.includes('instalação');
                  
                  if (isEquipamento && needsOrdem && !ordemCompra && !loadingOrdem) {
                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 p-3 rounded-lg border border-warning/30 bg-warning/5 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2 text-warning text-xs font-bold">
                          <AlertTriangle className="h-4 w-4" />
                          Fornecedor não vinculado
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Este projeto está na etapa <strong>"{activeMembership.stage_name}"</strong> mas não possui um fornecedor registrado.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] w-fit gap-1 border-warning/40 hover:bg-warning/10"
                          onClick={() => {
                            setFornecedorModal({
                              projetoId: projetoId || dealId,
                              projetoCodigo: projectData?.codigo || (projectData?.projeto_num ? `SM-PROJ-${projectData.projeto_num}` : undefined),
                              clienteNome: projectData?.cliente_nome,
                              etapaId: activeMembership.stage_id,
                              etapaNome: activeMembership.stage_name,
                              membershipId: activeMembership.id
                            });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Vincular Fornecedor
                        </Button>
                      </motion.div>
                    );
                  }
                  return null;
                })()}

                {/* Terminal stages (e.g. "Perdido") — shown separately below the line */}
                {terminalLostStages.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    {terminalLostStages.map(stage => {
                      const isCurrent = stage.id === activeMembership.stage_id;
                      return (
                        <Tooltip key={stage.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (stage.id !== activeMembership.stage_id) {
                                  const locked = isComercial ? isCommercialLocked : isTechnicalLocked;
                                  if (!locked) {
                                    changeStage(activeMembership.id, stage.id);
                                  } else {
                                    toast({ title: "Funil bloqueado", variant: "destructive" });
                                  }
                                }
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-medium border transition-all cursor-pointer",
                                isCurrent
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-muted/40 text-muted-foreground border-border hover:bg-destructive/5 hover:text-destructive"
                              )}
                            >
                              <X className="h-2.5 w-2.5" />
                              {stage.name}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {stage.name} • {stage.probability}%
                            {isCurrent && " (atual)"}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Modal de Interceptação de Fornecedor */}
          {fornecedorModal && (
            <VincularFornecedorModal
              open={!!fornecedorModal}
              onOpenChange={(open) => !open && setFornecedorModal(null)}
              projetoId={fornecedorModal?.projetoId || projetoId || dealId || ""}
              projetoCodigo={fornecedorModal?.projetoCodigo}
              clienteNome={fornecedorModal?.clienteNome}
              onSuccess={() => {
                const { membershipId, etapaId } = fornecedorModal;
                setFornecedorModal(null);
                // Força atualização da etapa após vincular
                supabase
                  .from("deal_pipeline_stages")
                  .update({ stage_id: etapaId })
                  .eq("id", membershipId)
                  .then(() => {
                    fetchMemberships();
                    onMembershipChange?.();
                    fetchOrdemCompra();
                  });
              }}
              onCancel={() => setFornecedorModal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
