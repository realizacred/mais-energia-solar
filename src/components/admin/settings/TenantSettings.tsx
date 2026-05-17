import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, MapPin, Settings2, Save, Loader2, Shield,
  Sparkles, MessageCircle, Clock, FileText, ExternalLink,
  Info, CheckCircle2, Ban, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLogo } from "@/hooks/useLogo";
import { useTenantSettings, type TenantData, type TenantConfig } from "@/hooks/useTenantSettings";
import { BusinessHoursConfig } from "./settings/BusinessHoursConfig";
import { HolidaysConfig } from "./settings/HolidaysConfig";
import { AutoReplyConfig } from "./settings/AutoReplyConfig";

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const CRM_REQUIRED_FIELD_OPTIONS = [
  { key: "phone", label: "Telefone", description: "Obrigatório no cadastro de lead/cliente" },
  { key: "email", label: "E-mail", description: "E-mail do contato" },
  { key: "document", label: "CPF/CNPJ", description: "Documento de identificação" },
  { key: "company", label: "Empresa", description: "Nome da empresa" },
  { key: "zipcode", label: "CEP", description: "Código postal" },
  { key: "address", label: "Endereço", description: "Rua/logradouro" },
  { key: "state", label: "Estado", description: "UF do contato" },
  { key: "city", label: "Cidade", description: "Cidade do contato" },
] as const;

const CRM_UNIQUE_FIELD_OPTIONS = [
  { key: "phone", label: "Telefone", description: "Impede dois leads/clientes com mesmo telefone" },
  { key: "document", label: "CPF/CNPJ", description: "Impede dois cadastros com mesmo documento" },
  { key: "email", label: "E-mail", description: "Impede dois cadastros com mesmo e-mail" },
  { key: "uc_number", label: "Nº da UC", description: "Impede duplicar unidade consumidora" },
] as const;

export function TenantSettings() {
  const { tenant: fetchedTenant, isLoading, refetch } = useTenantSettings();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [saving, setSaving] = useState(false);
  const logoUrl = useLogo();
  const navigate = useNavigate();

  // Sync local state from hook data
  useEffect(() => {
    if (fetchedTenant) setTenant(fetchedTenant);
  }, [fetchedTenant]);

  const updateField = <K extends keyof TenantData>(key: K, value: TenantData[K]) => {
    if (!tenant) return;
    setTenant({ ...tenant, [key]: value });
  };

  const getCrmConfig = () => tenant?.tenant_config?.crm || { block_duplicate_clients: false, required_fields: ["phone"], unique_fields: ["phone"] };

  const updateCrmConfig = (updates: Partial<TenantConfig["crm"]>) => {
    if (!tenant) return;
    const current = getCrmConfig();
    setTenant({
      ...tenant,
      tenant_config: {
        ...tenant.tenant_config,
        crm: { ...current, ...updates },
      },
    });
  };

  const toggleRequiredField = (field: string) => {
    const current = getCrmConfig().required_fields || [];
    const updated = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field];
    updateCrmConfig({ required_fields: updated });
  };

  const toggleUniqueField = (field: string) => {
    const current = getCrmConfig().unique_fields || [];
    const updated = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field];
    updateCrmConfig({ unique_fields: updated });
  };

  const handleSave = async () => {
    if (!tenant) return;

    if (!tenant.nome?.trim()) {
      toast({ title: "Campo obrigatório", description: "O nome da empresa é obrigatório.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("tenants")
      .update({
        nome: tenant.nome,
        documento: tenant.documento,
        inscricao_estadual: tenant.inscricao_estadual,
        estado: tenant.estado,
        cidade: tenant.cidade,
        tenant_config: tenant.tenant_config as any,
      })
      .eq("id", tenant.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!", description: "As alterações foram registradas no log de auditoria." });
      await refetch();
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Não foi possível carregar os dados da empresa.
      </div>
    );
  }

  const crmConfig = getCrmConfig();

  return (
    <div className="admin-layout-settings">
      {/* ═══ LEFT COLUMN: Form Sections ═══ */}
      <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Configurações da Empresa</h2>
            <p className="text-sm text-muted-foreground">
              Identidade, localização e regras de cadastro do seu tenant
            </p>
          </div>
        </div>
        {/* Desktop: inline button. Mobile: sticky footer */}
        <div className="hidden sm:block">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>Todas as alterações são registradas automaticamente no log de auditoria</span>
      </div>

      {/* ═══ BLOCO 1: IDENTIDADE ═══ */}
      <SectionCard icon={Building2} title="Identidade da Empresa" description="Dados básicos da sua empresa" variant="blue">
        <div className="space-y-4">
          {/* Logo preview (read-only, managed in brand_settings) */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border/60">
            <div className="h-14 w-14 rounded-lg border border-border/60 bg-background flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
              ) : (
                <Building2 className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Logo da empresa</p>
              <p className="text-xs text-muted-foreground">
                Gerencie o logo e cores em{" "}
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs text-primary"
                  onClick={() => navigate("/admin/site-config")}
                >
                  Site Institucional → Logos
                </Button>
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Empresa *</Label>
              <Input
                value={tenant.nome}
                onChange={(e) => updateField("nome", e.target.value)}
                placeholder="Mais Energia Solar"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input value={tenant.slug} disabled className="bg-muted/50" />
              <p className="text-[10px] text-muted-foreground">Identificador único — não editável</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <CpfCnpjInput
                value={tenant.documento || ""}
                onChange={(v) => updateField("documento", v || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input
                value={tenant.inscricao_estadual || ""}
                onChange={(e) => updateField("inscricao_estadual", e.target.value || null)}
                placeholder="000.000.000.000"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ═══ BLOCO 2: LOCALIZAÇÃO ═══ */}
      <SectionCard icon={MapPin} title="Localização" description="Endereço da sede da empresa" variant="green">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Select
                value={tenant.estado || ""}
                onValueChange={(v) => updateField("estado", v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={tenant.cidade || ""}
                onChange={(e) => updateField("cidade", e.target.value || null)}
                placeholder="Juiz de Fora"
              />
            </div>
          </div>
      </SectionCard>

      {/* ═══ BLOCO 3: REGRAS DE CADASTRO ═══ */}
      <SectionCard icon={Settings2} title="Regras de Cadastro" description="Configure validações e campos obrigatórios para leads e clientes" variant="neutral">
        <div className="space-y-6">

          {/* 3A — Campos Obrigatórios */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Campos Obrigatórios</p>
              <Badge variant="secondary" className="text-[10px]">
                {(crmConfig.required_fields || []).length} ativos
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Campos que o consultor é obrigado a preencher ao cadastrar um lead ou cliente.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {CRM_REQUIRED_FIELD_OPTIONS.map((opt) => {
                const isChecked = (crmConfig.required_fields || []).includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      isChecked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/60 bg-background hover:border-border"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleRequiredField(opt.key)}
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-[10px] text-muted-foreground leading-tight">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* 3B — Campos Únicos (Deduplicação) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-warning" />
              <p className="text-sm font-semibold">Campos Únicos (Deduplicação)</p>
              <Badge variant="secondary" className="text-[10px]">
                {(crmConfig.unique_fields || []).length} ativos
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Impede cadastrar dois registros com o mesmo valor nestes campos. Ex: se "CPF/CNPJ" estiver ativo, não será possível cadastrar dois clientes com o mesmo CPF.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {CRM_UNIQUE_FIELD_OPTIONS.map((opt) => {
                const isChecked = (crmConfig.unique_fields || []).includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      isChecked
                        ? "border-warning/30 bg-warning/5"
                        : "border-border/60 bg-background hover:border-border"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleUniqueField(opt.key)}
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-[10px] text-muted-foreground leading-tight">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ═══ BLOCO 4: BRANDING IA & WHATSAPP ═══ */}
      <SectionCard icon={Sparkles} title="Identidade da IA & WhatsApp" description="Personalize o nome e emoji do assistente de IA e do canal WhatsApp da sua empresa" variant="purple">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Nome da IA
              </Label>
              <Input
                value={tenant.tenant_config?.branding?.ai_name || ""}
                onChange={(e) =>
                  setTenant({
                    ...tenant,
                    tenant_config: {
                      ...tenant.tenant_config,
                      branding: {
                        ...tenant.tenant_config?.branding,
                        ai_name: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Ex: Solzinho"
              />
              <p className="text-[10px] text-muted-foreground">
                Nome usado nas sugestões, resumos e assinaturas da IA
              </p>
            </div>
            <div className="space-y-2">
              <Label>Emoji da IA</Label>
              <Input
                value={tenant.tenant_config?.branding?.ai_emoji || ""}
                onChange={(e) =>
                  setTenant({
                    ...tenant,
                    tenant_config: {
                      ...tenant.tenant_config,
                      branding: {
                        ...tenant.tenant_config?.branding,
                        ai_emoji: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Ex: ☀️"
                maxLength={4}
                className="w-24"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-success" />
                Nome do WhatsApp
              </Label>
              <Input
                value={tenant.tenant_config?.branding?.wa_name || ""}
                onChange={(e) =>
                  setTenant({
                    ...tenant,
                    tenant_config: {
                      ...tenant.tenant_config,
                      branding: {
                        ...tenant.tenant_config?.branding,
                        wa_name: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Ex: Mais Zap"
              />
              <p className="text-[10px] text-muted-foreground">
                Nome exibido no módulo de atendimento WhatsApp
              </p>
            </div>
            <div className="space-y-2">
              <Label>Emoji do WhatsApp</Label>
              <Input
                value={tenant.tenant_config?.branding?.wa_emoji || ""}
                onChange={(e) =>
                  setTenant({
                    ...tenant,
                    tenant_config: {
                      ...tenant.tenant_config,
                      branding: {
                        ...tenant.tenant_config?.branding,
                        wa_emoji: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Ex: 📱"
                maxLength={4}
                className="w-24"
              />
            </div>
          </div>

          {/* Preview */}
          {(tenant.tenant_config?.branding?.ai_name || tenant.tenant_config?.branding?.wa_name) && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/60 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prévia</p>
              {tenant.tenant_config?.branding?.ai_name && (
                <p className="text-sm">
                  {tenant.tenant_config.branding.ai_emoji || "🤖"}{" "}
                  <span className="font-medium">{tenant.tenant_config.branding.ai_name}</span>{" "}
                  <span className="text-muted-foreground">— Assistente de IA</span>
                </p>
              )}
              {tenant.tenant_config?.branding?.wa_name && (
                <p className="text-sm">
                  {tenant.tenant_config.branding.wa_emoji || "💬"}{" "}
                  <span className="font-medium">{tenant.tenant_config.branding.wa_name}</span>{" "}
                  <span className="text-muted-foreground">— Canal WhatsApp</span>
                </p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ═══ BLOCO 5: HORÁRIOS DE ATENDIMENTO ═══ */}
      <BusinessHoursConfig tenantId={tenant.id} />

      {/* ═══ BLOCO 6: FERIADOS ═══ */}
      <HolidaysConfig tenantId={tenant.id} />

      {/* ═══ BLOCO 7: AUTO-RESPOSTA FORA DO HORÁRIO ═══ */}
      <AutoReplyConfig tenantId={tenant.id} />

      {/* Mobile sticky save footer */}
      <div className="admin-sticky-footer sm:hidden">
        <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>
      {/* Spacer for mobile sticky footer */}
      <div className="h-16 sm:hidden" />
      </div>

      {/* ═══ RIGHT COLUMN: Contextual Panel (desktop only) ═══ */}
      <div className="admin-context-panel hidden lg:block">
        {/* Tenant Status */}
        <SectionCard icon={Info} title="Status do Tenant" variant="neutral">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Identificador</span>
              <Badge variant="outline" className="text-[10px] font-mono">{tenant.slug}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Estado</span>
              <span className="text-xs font-medium">{tenant.estado || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cidade</span>
              <span className="text-xs font-medium">{tenant.cidade || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">CNPJ</span>
              <span className="text-xs font-medium font-mono">{tenant.documento || "—"}</span>
            </div>
            <div className="h-px bg-border/50 my-1" />
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-medium">Tenant ativo</span>
            </div>
          </div>
        </SectionCard>

        {/* Quick Actions */}
        <SectionCard title="Ações Rápidas" variant="neutral">
          <div className="space-y-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 px-3 py-2 h-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/admin/site-config")}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span>Configurar logo e marca</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 px-3 py-2 h-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/admin/usuarios")}
            >
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>Gerenciar permissões</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 px-3 py-2 h-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/admin/auditoria")}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>Ver log de auditoria</span>
            </Button>
          </div>
        </SectionCard>

        {/* Resumo Regras de Cadastro */}
        <SectionCard title="Resumo Validações" variant="neutral">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Campos obrigatórios</span>
              <Badge variant="outline" className="text-[10px]">
                {(crmConfig.required_fields || []).length} campos
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Campos únicos</span>
              <Badge variant="outline" className="text-[10px]">
                {(crmConfig.unique_fields || []).length} campos
              </Badge>
            </div>
            {tenant.tenant_config?.branding?.ai_name && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Assistente IA</span>
                <span className="text-xs font-medium">
                  {tenant.tenant_config.branding.ai_emoji || "🤖"} {tenant.tenant_config.branding.ai_name}
                </span>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
