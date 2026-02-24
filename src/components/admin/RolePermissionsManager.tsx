import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      { key: "performance", label: "Performance", description: "Métricas de desempenho" },
      { key: "inteligencia", label: "Inteligência IA", description: "Insights e diretor comercial" },
    ],
  },
  {
    label: "Comercial",
    icon: <ClipboardList className="h-4 w-4" />,
    modules: [
      { key: "leads", label: "Leads", description: "Gestão de leads e pipeline" },
      { key: "pipeline", label: "Pipeline", description: "Kanban de oportunidades" },
      { key: "followup", label: "Follow-up", description: "Acompanhamento de leads" },
      { key: "propostas", label: "Propostas", description: "Propostas comerciais" },
      { key: "projetos", label: "Projetos", description: "Gestão de projetos" },
      { key: "distribuicao", label: "Distribuição", description: "Config de distribuição de leads" },
    ],
  },
  {
    label: "Atendimento",
    icon: <MessageCircle className="h-4 w-4" />,
    modules: [
      { key: "inbox", label: "Inbox WhatsApp", description: "Conversas e mensagens" },
      { key: "contatos", label: "Contatos", description: "Agenda de contatos" },
      { key: "respostas-rapidas", label: "Respostas Rápidas", description: "Templates de mensagem" },
      { key: "followup-wa", label: "Follow-up WA", description: "Regras de follow-up automático" },
      { key: "wa-etiquetas", label: "Etiquetas", description: "Tags de conversas" },
    ],
  },
  {
    label: "Clientes",
    icon: <Users className="h-4 w-4" />,
    modules: [
      { key: "clientes", label: "Clientes", description: "Base de clientes" },
      { key: "checklists", label: "Checklists", description: "Checklists de cliente" },
      { key: "avaliacoes", label: "Avaliações", description: "Satisfação do cliente" },
      { key: "documentos", label: "Documentos", description: "Documentos do cliente" },
    ],
  },
  {
    label: "Financeiro",
    icon: <DollarSign className="h-4 w-4" />,
    modules: [
      { key: "recebimentos", label: "Recebimentos", description: "Controle de recebimentos" },
      { key: "comissoes", label: "Comissões", description: "Comissões dos consultores" },
      { key: "inadimplencia", label: "Inadimplência", description: "Gestão de inadimplentes" },
      { key: "fiscal", label: "Fiscal", description: "Notas e impostos" },
    ],
  },
  {
    label: "Operações",
    icon: <Wrench className="h-4 w-4" />,
    modules: [
      { key: "instaladores", label: "Instaladores", description: "Equipe de instalação" },
      { key: "servicos", label: "Serviços", description: "Serviços prestados" },
      { key: "validacao", label: "Validação", description: "Validação de vendas" },
    ],
  },
  {
    label: "Cadastros",
    icon: <Settings className="h-4 w-4" />,
    modules: [
      { key: "vendedores", label: "Consultores", description: "Gestão de consultores" },
      { key: "usuarios", label: "Usuários", description: "Gestão de usuários" },
      { key: "equipamentos", label: "Equipamentos", description: "Módulos, inversores, baterias" },
      { key: "concessionarias", label: "Concessionárias", description: "Cadastro de concessionárias" },
      { key: "config", label: "Configurações", description: "Calculadora e premissas" },
    ],
  },
  {
    label: "Integrações",
    icon: <Zap className="h-4 w-4" />,
    modules: [
      { key: "wa-instances", label: "Instâncias WA", description: "Conexões WhatsApp" },
      { key: "whatsapp", label: "Automação WA", description: "Configuração de automação" },
      { key: "webhooks", label: "Webhooks", description: "Integrações externas" },
      { key: "integracoes", label: "Integrações", description: "Serviços conectados" },
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
const DEFAULT_PERMISSIONS: Record<string, Record<string, { view: boolean; edit: boolean }>> = {
  gerente: {
    dashboard: { view: true, edit: false },
    performance: { view: true, edit: false },
    inteligencia: { view: true, edit: false },
    leads: { view: true, edit: true },
    pipeline: { view: true, edit: true },
    followup: { view: true, edit: true },
    propostas: { view: true, edit: true },
    projetos: { view: true, edit: true },
    distribuicao: { view: true, edit: true },
    inbox: { view: true, edit: true },
    contatos: { view: true, edit: true },
    "respostas-rapidas": { view: true, edit: true },
    "followup-wa": { view: true, edit: true },
    "wa-etiquetas": { view: true, edit: true },
    clientes: { view: true, edit: true },
    checklists: { view: true, edit: true },
    avaliacoes: { view: true, edit: false },
    documentos: { view: true, edit: true },
    recebimentos: { view: true, edit: false },
    comissoes: { view: true, edit: false },
    inadimplencia: { view: true, edit: false },
    fiscal: { view: true, edit: false },
    instaladores: { view: true, edit: true },
    servicos: { view: true, edit: true },
    validacao: { view: true, edit: true },
    vendedores: { view: true, edit: true },
    usuarios: { view: true, edit: false },
    equipamentos: { view: true, edit: true },
    concessionarias: { view: true, edit: true },
    config: { view: true, edit: false },
    "wa-instances": { view: true, edit: false },
    whatsapp: { view: true, edit: false },
    webhooks: { view: false, edit: false },
    integracoes: { view: true, edit: false },
  },
  consultor: {
    dashboard: { view: false, edit: false },
    performance: { view: false, edit: false },
    inteligencia: { view: false, edit: false },
    leads: { view: true, edit: true },
    pipeline: { view: true, edit: false },
    followup: { view: true, edit: true },
    propostas: { view: true, edit: true },
    projetos: { view: true, edit: false },
    distribuicao: { view: false, edit: false },
    inbox: { view: true, edit: true },
    contatos: { view: true, edit: true },
    "respostas-rapidas": { view: true, edit: false },
    "followup-wa": { view: false, edit: false },
    "wa-etiquetas": { view: true, edit: false },
    clientes: { view: true, edit: true },
    checklists: { view: true, edit: true },
    avaliacoes: { view: false, edit: false },
    documentos: { view: true, edit: true },
    recebimentos: { view: false, edit: false },
    comissoes: { view: false, edit: false },
    inadimplencia: { view: false, edit: false },
    fiscal: { view: false, edit: false },
    instaladores: { view: false, edit: false },
    servicos: { view: false, edit: false },
    validacao: { view: false, edit: false },
    vendedores: { view: false, edit: false },
    usuarios: { view: false, edit: false },
    equipamentos: { view: true, edit: false },
    concessionarias: { view: false, edit: false },
    config: { view: false, edit: false },
    "wa-instances": { view: false, edit: false },
    whatsapp: { view: false, edit: false },
    webhooks: { view: false, edit: false },
    integracoes: { view: false, edit: false },
  },
  instalador: {
    dashboard: { view: false, edit: false },
    performance: { view: false, edit: false },
    inteligencia: { view: false, edit: false },
    leads: { view: false, edit: false },
    pipeline: { view: false, edit: false },
    followup: { view: false, edit: false },
    propostas: { view: false, edit: false },
    projetos: { view: true, edit: false },
    distribuicao: { view: false, edit: false },
    inbox: { view: false, edit: false },
    contatos: { view: false, edit: false },
    "respostas-rapidas": { view: false, edit: false },
    "followup-wa": { view: false, edit: false },
    "wa-etiquetas": { view: false, edit: false },
    clientes: { view: true, edit: false },
    checklists: { view: true, edit: true },
    avaliacoes: { view: false, edit: false },
    documentos: { view: true, edit: false },
    recebimentos: { view: false, edit: false },
    comissoes: { view: false, edit: false },
    inadimplencia: { view: false, edit: false },
    fiscal: { view: false, edit: false },
    instaladores: { view: false, edit: false },
    servicos: { view: true, edit: true },
    validacao: { view: false, edit: false },
    vendedores: { view: false, edit: false },
    usuarios: { view: false, edit: false },
    equipamentos: { view: true, edit: false },
    concessionarias: { view: false, edit: false },
    config: { view: false, edit: false },
    "wa-instances": { view: false, edit: false },
    whatsapp: { view: false, edit: false },
    webhooks: { view: false, edit: false },
    integracoes: { view: false, edit: false },
  },
  financeiro: {
    dashboard: { view: true, edit: false },
    performance: { view: false, edit: false },
    inteligencia: { view: false, edit: false },
    leads: { view: true, edit: false },
    pipeline: { view: true, edit: false },
    followup: { view: false, edit: false },
    propostas: { view: true, edit: false },
    projetos: { view: true, edit: false },
    distribuicao: { view: false, edit: false },
    inbox: { view: false, edit: false },
    contatos: { view: false, edit: false },
    "respostas-rapidas": { view: false, edit: false },
    "followup-wa": { view: false, edit: false },
    "wa-etiquetas": { view: false, edit: false },
    clientes: { view: true, edit: false },
    checklists: { view: false, edit: false },
    avaliacoes: { view: false, edit: false },
    documentos: { view: true, edit: false },
    recebimentos: { view: true, edit: true },
    comissoes: { view: true, edit: true },
    inadimplencia: { view: true, edit: true },
    fiscal: { view: true, edit: true },
    instaladores: { view: false, edit: false },
    servicos: { view: false, edit: false },
    validacao: { view: true, edit: true },
    vendedores: { view: true, edit: false },
    usuarios: { view: false, edit: false },
    equipamentos: { view: false, edit: false },
    concessionarias: { view: false, edit: false },
    config: { view: false, edit: false },
    "wa-instances": { view: false, edit: false },
    whatsapp: { view: false, edit: false },
    webhooks: { view: false, edit: false },
    integracoes: { view: false, edit: false },
  },
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

      // Need to get tenant_id for upsert
      const { data: profileData } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profileData?.tenant_id) throw new Error("Tenant não encontrado");

      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          rows.map((r) => ({
            ...r,
            tenant_id: profileData.tenant_id,
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
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeRole === role
                ? ROLE_COLORS[role] + " ring-1 ring-current"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
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
