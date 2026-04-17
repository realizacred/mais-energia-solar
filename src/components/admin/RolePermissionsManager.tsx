import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useToast } from "@/hooks/use-toast";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Eye,
  Pencil,
  Save,
  RotateCcw,
  BarChart3,
  Users,
  MessageCircle,
  DollarSign,
  Settings,
  Wrench,
  Zap,
  Brain,
  ClipboardList,
  Sun,
  Globe,
  Package,
  Trophy,
  Sparkles,
} from "lucide-react";

// ═══ Module definitions ═══
interface ModuleDef {
  key: string;
  label: string;
  description: string;
}

interface ModuleCategory {
  label: string;
  icon: React.ReactNode;
  modules: ModuleDef[];
}

const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    label: "Visão Geral",
    icon: <BarChart3 className="h-4 w-4" />,
    modules: [
      { key: "dashboard", label: "Dashboard", description: "Painel analítico geral" },
      { key: "performance", label: "Performance", description: "Métricas de desempenho e ranking" },
    ],
  },
  {
    label: "Comercial",
    icon: <ClipboardList className="h-4 w-4" />,
    modules: [
      { key: "leads", label: "Leads", description: "Gestão de leads e funil" },
      { key: "pipeline", label: "Funil", description: "Kanban de oportunidades" },
      { key: "followup", label: "Follow-up", description: "Acompanhamento de leads" },
      { key: "propostas", label: "Propostas", description: "Propostas comerciais" },
      { key: "projetos", label: "Projetos", description: "Gestão de projetos" },
      { key: "distribuicao", label: "Distribuição", description: "Config de distribuição de leads" },
      { key: "sla-breaches", label: "SLA & Breaches", description: "Leads com tempo de resposta excedido" },
      { key: "proposta-comercial", label: "Editor de Proposta", description: "Editor visual de templates" },
      { key: "validacao", label: "Validação", description: "Validação de vendas" },
      { key: "aprovacao", label: "Aprovações", description: "Aprovar novos usuários e acessos" },
    ],
  },
  {
    label: "Inteligência Comercial",
    icon: <Brain className="h-4 w-4" />,
    modules: [
      { key: "inteligencia", label: "Inteligência IA", description: "Scoring e previsão de receita" },
      { key: "inteligencia-alertas", label: "Alertas Inteligentes", description: "Alertas de preço e urgência" },
      { key: "inteligencia-metricas", label: "Métricas de Inteligência", description: "Conversão por temperamento" },
      { key: "inteligencia-config", label: "Config Inteligência", description: "Thresholds e detecção" },
    ],
  },
  {
    label: "Atendimento",
    icon: <MessageCircle className="h-4 w-4" />,
    modules: [
      { key: "inbox", label: "Inbox WhatsApp", description: "Conversas e mensagens" },
      { key: "contatos", label: "Contatos", description: "Agenda de contatos" },
      { key: "respostas-rapidas", label: "Respostas Rápidas", description: "Templates de mensagem" },
      { key: "followup-wa", label: "Regras Follow-up WA", description: "Automação de follow-up" },
      { key: "wa-etiquetas", label: "Etiquetas WA", description: "Tags de conversas" },
      { key: "metricas-atendimento", label: "Métricas Atendimento", description: "Performance por consultor" },
    ],
  },
  {
    label: "Clientes",
    icon: <Users className="h-4 w-4" />,
    modules: [
      { key: "clientes", label: "Clientes", description: "Base de clientes" },
      { key: "checklists", label: "Checklists", description: "Checklists de cliente" },
      { key: "avaliacoes", label: "Avaliações NPS", description: "Satisfação do cliente" },
      { key: "documentos", label: "Documentos", description: "Documentos e assinaturas" },
    ],
  },
  {
    label: "Pós-Venda",
    icon: <Wrench className="h-4 w-4" />,
    modules: [
      { key: "pos-venda", label: "Dashboard Pós-Venda", description: "Visão geral e preventivas" },
      { key: "pos-venda-visitas", label: "Preventivas", description: "Visitas técnicas" },
      { key: "pos-venda-planos", label: "Planos Manutenção", description: "Planos por projeto" },
      { key: "pos-venda-checklists", label: "Checklists Pós-Venda", description: "Templates de inspeção" },
      { key: "pos-venda-upsell", label: "Oportunidades", description: "Vendas adicionais e upgrades" },
    ],
  },
  {
    label: "Operações",
    icon: <Package className="h-4 w-4" />,
    modules: [
      { key: "instaladores", label: "Instaladores", description: "Equipe de instalação" },
      { key: "servicos", label: "Agenda de Serviços", description: "Visitas e agendamentos" },
      { key: "estoque", label: "Estoque", description: "Materiais e insumos" },
      { key: "tarefas", label: "Tarefas & SLA", description: "Controle de pendências" },
      { key: "visitas-tecnicas", label: "Visitas Técnicas", description: "Calendário de visitas" },
    ],
  },
  {
    label: "Financeiro",
    icon: <DollarSign className="h-4 w-4" />,
    modules: [
      { key: "financeiro-dashboard", label: "Dashboard Financeiro", description: "Visão consolidada" },
      { key: "recebimentos", label: "Recebimentos", description: "Controle de recebimentos" },
      { key: "comissoes", label: "Comissões", description: "Comissões dos consultores" },
      { key: "inadimplencia", label: "Inadimplência", description: "Gestão de inadimplentes" },
      { key: "fiscal", label: "Fiscal", description: "Notas e impostos" },
      { key: "financiamento", label: "Financiamentos", description: "Bancos, taxas e simulações" },
      { key: "engenharia", label: "Premissas Fiscais", description: "ICMS, fio B, payback" },
      { key: "politica-precos", label: "Política de Preços", description: "Regras de precificação" },
    ],
  },
  {
    label: "Energia",
    icon: <Sun className="h-4 w-4" />,
    modules: [
      { key: "ucs", label: "Unidades Consumidoras", description: "Gestão de UCs" },
      { key: "monitoramento", label: "Monitoramento Solar", description: "Dashboard de usinas" },
      { key: "faturas-energia", label: "Faturas de Energia", description: "Recebimento automático" },
      { key: "gd-rateio", label: "GD e Rateio", description: "Geração distribuída e créditos" },
      { key: "saude-tarifaria", label: "Saúde Tarifária", description: "Alertas e governança de tarifas" },
      { key: "medidores", label: "Medidores", description: "Dispositivos IoT" },
    ],
  },
  {
    label: "Equipe",
    icon: <Trophy className="h-4 w-4" />,
    modules: [
      { key: "vendedores", label: "Consultores", description: "Gestão de consultores" },
      { key: "gamificacao", label: "Gamificação", description: "Metas e ranking" },
      { key: "usuarios", label: "Usuários", description: "Gestão de usuários" },
    ],
  },
  {
    label: "IA",
    icon: <Sparkles className="h-4 w-4" />,
    modules: [
      { key: "diretor", label: "Copilot IA", description: "Análises e sugestões automáticas" },
      { key: "ai-config", label: "Config de IA", description: "Modelo e regras de IA" },
    ],
  },
  {
    label: "Site",
    icon: <Globe className="h-4 w-4" />,
    modules: [
      { key: "site-config", label: "Conteúdo & Visual", description: "Branding e identidade" },
      { key: "site-servicos", label: "Serviços do Site", description: "Página institucional" },
      { key: "obras", label: "Portfólio", description: "Galeria de projetos" },
    ],
  },
  {
    label: "Cadastros",
    icon: <Settings className="h-4 w-4" />,
    modules: [
      { key: "equipamentos", label: "Equipamentos", description: "Disjuntores e transformadores" },
      { key: "modulos", label: "Módulos Fotovoltaicos", description: "Catálogo de painéis" },
      { key: "inversores-cadastro", label: "Inversores", description: "Catálogo de inversores" },
      { key: "baterias", label: "Baterias", description: "Catálogo de baterias" },
      { key: "fornecedores", label: "Fornecedores", description: "Distribuidores e fabricantes" },
      { key: "concessionarias", label: "Concessionárias", description: "Distribuidoras de energia" },
      { key: "config", label: "Calculadora Solar", description: "Parâmetros de cálculo" },
      { key: "premissas", label: "Premissas", description: "Parâmetros financeiros e técnicos" },
    ],
  },
  {
    label: "Integrações",
    icon: <Zap className="h-4 w-4" />,
    modules: [
      { key: "catalogo-integracoes", label: "Catálogo Integrações", description: "Integrações disponíveis" },
      { key: "wa-instances", label: "Instâncias WA", description: "Conexões WhatsApp" },
      { key: "whatsapp", label: "Automação WA", description: "Configuração de automação" },
      { key: "integracao-asaas", label: "Integração Asaas", description: "Cobrança automática" },
    ],
  },
];

const EDITABLE_ROLES = ["gerente", "consultor", "instalador", "financeiro"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  gerente: "bg-primary/10 text-primary",
  consultor: "bg-success/10 text-success",
  instalador: "bg-warning/10 text-warning",
  financeiro: "bg-info/10 text-info",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  consultor: "Consultor",
  instalador: "Instalador",
  financeiro: "Financeiro",
};

// ═══ Default permissions (when no DB record exists) ═══
// Helper: generate defaults for all modules from categories
function buildDefaults(overrides: Record<string, { view: boolean; edit: boolean }>): Record<string, { view: boolean; edit: boolean }> {
  const allModules = MODULE_CATEGORIES.flatMap(c => c.modules);
  const result: Record<string, { view: boolean; edit: boolean }> = {};
  for (const mod of allModules) {
    result[mod.key] = overrides[mod.key] || { view: false, edit: false };
  }
  return result;
}

const DEFAULT_PERMISSIONS: Record<string, Record<string, { view: boolean; edit: boolean }>> = {
  gerente: buildDefaults({
    // Visão Geral
    dashboard: { view: true, edit: false },
    performance: { view: true, edit: false },
    // Comercial
    leads: { view: true, edit: true },
    pipeline: { view: true, edit: true },
    followup: { view: true, edit: true },
    propostas: { view: true, edit: true },
    projetos: { view: true, edit: true },
    distribuicao: { view: true, edit: true },
    "sla-breaches": { view: true, edit: false },
    "proposta-comercial": { view: true, edit: true },
    validacao: { view: true, edit: true },
    aprovacao: { view: true, edit: true },
    // Inteligência
    inteligencia: { view: true, edit: false },
    "inteligencia-alertas": { view: true, edit: false },
    "inteligencia-metricas": { view: true, edit: false },
    "inteligencia-config": { view: false, edit: false },
    // Atendimento
    inbox: { view: true, edit: true },
    contatos: { view: true, edit: true },
    "respostas-rapidas": { view: true, edit: true },
    "followup-wa": { view: true, edit: true },
    "wa-etiquetas": { view: true, edit: true },
    "metricas-atendimento": { view: true, edit: false },
    // Clientes
    clientes: { view: true, edit: true },
    checklists: { view: true, edit: true },
    avaliacoes: { view: true, edit: false },
    documentos: { view: true, edit: true },
    // Pós-Venda
    "pos-venda": { view: true, edit: false },
    "pos-venda-visitas": { view: true, edit: true },
    "pos-venda-planos": { view: true, edit: true },
    "pos-venda-checklists": { view: true, edit: true },
    "pos-venda-upsell": { view: true, edit: true },
    // Operações
    instaladores: { view: true, edit: true },
    servicos: { view: true, edit: true },
    estoque: { view: true, edit: true },
    tarefas: { view: true, edit: true },
    "visitas-tecnicas": { view: true, edit: true },
    // Financeiro
    "financeiro-dashboard": { view: true, edit: false },
    recebimentos: { view: true, edit: false },
    comissoes: { view: true, edit: false },
    inadimplencia: { view: true, edit: false },
    fiscal: { view: true, edit: false },
    financiamento: { view: true, edit: false },
    engenharia: { view: true, edit: false },
    "politica-precos": { view: true, edit: false },
    // Energia
    ucs: { view: true, edit: true },
    monitoramento: { view: true, edit: false },
    "faturas-energia": { view: true, edit: false },
    "gd-rateio": { view: true, edit: false },
    "saude-tarifaria": { view: true, edit: false },
    medidores: { view: true, edit: false },
    // Equipe
    vendedores: { view: true, edit: true },
    gamificacao: { view: true, edit: false },
    usuarios: { view: true, edit: false },
    // IA
    diretor: { view: true, edit: false },
    "ai-config": { view: false, edit: false },
    // Site
    "site-config": { view: true, edit: false },
    "site-servicos": { view: true, edit: false },
    obras: { view: true, edit: false },
    // Cadastros
    equipamentos: { view: true, edit: true },
    modulos: { view: true, edit: true },
    "inversores-cadastro": { view: true, edit: true },
    baterias: { view: true, edit: true },
    fornecedores: { view: true, edit: true },
    concessionarias: { view: true, edit: true },
    config: { view: true, edit: false },
    premissas: { view: true, edit: false },
    // Integrações
    "catalogo-integracoes": { view: true, edit: false },
    "wa-instances": { view: true, edit: false },
    whatsapp: { view: true, edit: false },
    "integracao-asaas": { view: true, edit: false },
  }),
  consultor: buildDefaults({
    leads: { view: true, edit: true },
    pipeline: { view: true, edit: false },
    followup: { view: true, edit: true },
    propostas: { view: true, edit: true },
    projetos: { view: true, edit: false },
    inbox: { view: true, edit: true },
    contatos: { view: true, edit: true },
    "respostas-rapidas": { view: true, edit: false },
    "wa-etiquetas": { view: true, edit: false },
    clientes: { view: true, edit: true },
    checklists: { view: true, edit: true },
    documentos: { view: true, edit: true },
    "pos-venda": { view: true, edit: false },
    "pos-venda-visitas": { view: true, edit: false },
    tarefas: { view: true, edit: true },
    equipamentos: { view: true, edit: false },
    diretor: { view: true, edit: false },
    inteligencia: { view: true, edit: false },
    "inteligencia-alertas": { view: true, edit: false },
  }),
  instalador: buildDefaults({
    projetos: { view: true, edit: false },
    clientes: { view: true, edit: false },
    checklists: { view: true, edit: true },
    documentos: { view: true, edit: false },
    servicos: { view: true, edit: true },
    "visitas-tecnicas": { view: true, edit: true },
    "pos-venda": { view: true, edit: false },
    "pos-venda-visitas": { view: true, edit: true },
    "pos-venda-checklists": { view: true, edit: true },
    tarefas: { view: true, edit: true },
    equipamentos: { view: true, edit: false },
  }),
  financeiro: buildDefaults({
    dashboard: { view: true, edit: false },
    leads: { view: true, edit: false },
    pipeline: { view: true, edit: false },
    propostas: { view: true, edit: false },
    projetos: { view: true, edit: false },
    clientes: { view: true, edit: false },
    documentos: { view: true, edit: false },
    validacao: { view: true, edit: true },
    "financeiro-dashboard": { view: true, edit: false },
    recebimentos: { view: true, edit: true },
    comissoes: { view: true, edit: true },
    inadimplencia: { view: true, edit: true },
    fiscal: { view: true, edit: true },
    financiamento: { view: true, edit: true },
    engenharia: { view: true, edit: false },
    "politica-precos": { view: true, edit: false },
    vendedores: { view: true, edit: false },
    "integracao-asaas": { view: true, edit: true },
  }),
};

type PermState = Record<string, Record<string, { view: boolean; edit: boolean }>>;

export function RolePermissionsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState<string>("gerente");
  const [localState, setLocalState] = useState<PermState | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current permissions from DB
  const { data: dbPerms, isLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, module_key, can_view, can_edit");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Build merged state: DB overrides defaults
  const mergedState = useMemo(() => {
    const state: PermState = {};
    for (const role of EDITABLE_ROLES) {
      state[role] = {};
      const allModules = MODULE_CATEGORIES.flatMap((c) => c.modules);
      for (const mod of allModules) {
        const defaults = DEFAULT_PERMISSIONS[role]?.[mod.key] || { view: false, edit: false };
        const dbRow = dbPerms?.find((p) => p.role === role && p.module_key === mod.key);
        state[role][mod.key] = dbRow
          ? { view: dbRow.can_view, edit: dbRow.can_edit }
          : defaults;
      }
    }
    return state;
  }, [dbPerms]);

  const currentState = localState || mergedState;

  const handleToggle = (role: string, moduleKey: string, field: "view" | "edit") => {
    const newState = { ...currentState };
    const roleState = { ...newState[role] };
    const modState = { ...roleState[moduleKey] };

    if (field === "view") {
      modState.view = !modState.view;
      if (!modState.view) modState.edit = false; // can't edit without view
    } else {
      modState.edit = !modState.edit;
      if (modState.edit) modState.view = true; // edit implies view
    }

    roleState[moduleKey] = modState;
    newState[role] = roleState;
    setLocalState(newState);
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!localState) return;
      type AppRole = "admin" | "consultor" | "financeiro" | "gerente" | "instalador" | "super_admin";
      const rows: Array<{
        role: AppRole;
        module_key: string;
        can_view: boolean;
        can_edit: boolean;
      }> = [];

      for (const role of EDITABLE_ROLES) {
        for (const [moduleKey, perms] of Object.entries(localState[role] || {})) {
          rows.push({
            role: role as AppRole,
            module_key: moduleKey,
            can_view: perms.view,
            can_edit: perms.edit,
          });
        }
      }

      const { tenantId } = await getCurrentTenantId();
      const tenantIdValue = tenantId;

      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          rows.map((r) => ({
            ...r,
            tenant_id: tenantIdValue,
          })),
          { onConflict: "tenant_id,role,module_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Permissões salvas!" });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      setHasChanges(false);
      setLocalState(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const handleReset = () => {
    setLocalState(null);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const rolePerms = currentState[activeRole] || {};

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Shield}
        title="Permissões por Papel"
        description="Configure o acesso de cada papel aos módulos do sistema"
        actions={hasChanges ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Desfazer
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        ) : undefined}
      />

      <SectionCard variant="red" description="Admin sempre possui acesso total a todos os módulos e não pode ser restringido." />

      {/* Role tabs */}
      <div className="flex gap-2 flex-wrap">
        {EDITABLE_ROLES.map((role) => (
          <Button
            key={role}
            variant="ghost"
            size="sm"
            onClick={() => setActiveRole(role)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeRole === role
                ? ROLE_COLORS[role] + " ring-1 ring-current"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {ROLE_LABELS[role]}
          </Button>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="space-y-4">
        {MODULE_CATEGORIES.map((cat) => (
          <SectionCard key={cat.label} title={cat.label} variant="neutral" noPadding>
              <div className="divide-y divide-border/30">
                {cat.modules.map((mod) => {
                  const perms = rolePerms[mod.key] || { view: false, edit: false };
                  return (
                    <div
                      key={mod.key}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{mod.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Ver</span>
                          <Switch
                            checked={perms.view}
                            onCheckedChange={() => handleToggle(activeRole, mod.key, "view")}
                          />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Editar</span>
                          <Switch
                            checked={perms.edit}
                            onCheckedChange={() => handleToggle(activeRole, mod.key, "edit")}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
