import { useState, useEffect } from "react";
import {
  Building2, MapPin, Settings2, Save, Loader2, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLogo } from "@/hooks/useLogo";

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const CRM_FIELD_OPTIONS = [
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "document", label: "CPF/CNPJ" },
  { key: "company", label: "Empresa" },
  { key: "zipcode", label: "CEP" },
  { key: "address", label: "Endereço" },
  { key: "state", label: "Estado" },
  { key: "city", label: "Cidade" },
] as const;

type TenantConfig = {
  crm?: {
    block_duplicate_clients?: boolean;
    required_fields?: string[];
  };
};

type TenantData = {
  id: string;
  nome: string;
  slug: string;
  documento: string | null;
  inscricao_estadual: string | null;
  estado: string | null;
  cidade: string | null;
  tenant_config: TenantConfig;
};

export function TenantSettings() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoUrl = useLogo();

  useEffect(() => {
    loadTenant();
  }, []);

  const loadTenant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tenants")
      .select("id, nome, slug, documento, inscricao_estadual, estado, cidade, tenant_config")
      .single();

    if (error) {
      console.error("Error loading tenant:", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } else if (data) {
      setTenant({
        ...data,
        tenant_config: (data.tenant_config as TenantConfig) || {},
      });
    }
    setLoading(false);
  };

  const updateField = <K extends keyof TenantData>(key: K, value: TenantData[K]) => {
    if (!tenant) return;
    setTenant({ ...tenant, [key]: value });
  };

  const getCrmConfig = () => tenant?.tenant_config?.crm || { block_duplicate_clients: false, required_fields: ["phone"] };

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

  const handleSave = async () => {
    if (!tenant) return;
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
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Configurações da Empresa</h2>
            <p className="text-sm text-muted-foreground">
              Identidade, localização e regras de cadastro do seu tenant
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>Todas as alterações são registradas automaticamente no log de auditoria</span>
      </div>

      {/* ═══ BLOCO 1: IDENTIDADE ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Identidade da Empresa</CardTitle>
          </div>
          <CardDescription>Dados básicos da sua empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <a href="/admin/site-config" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  Site Institucional → Logos
                </a>
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
              <Input
                value={tenant.documento || ""}
                onChange={(e) => updateField("documento", e.target.value || null)}
                placeholder="00.000.000/0000-00"
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
        </CardContent>
      </Card>

      {/* ═══ BLOCO 2: LOCALIZAÇÃO ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Localização</CardTitle>
          </div>
          <CardDescription>Endereço da sede da empresa</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* ═══ BLOCO 3: REGRAS DE CADASTRO (CRM) ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Regras de Cadastro</CardTitle>
          </div>
          <CardDescription>Configure como leads e clientes são validados no seu CRM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Duplicate blocking */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/60">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Bloquear clientes duplicados</p>
              <p className="text-xs text-muted-foreground">
                Impede cadastro de leads com telefone já existente
              </p>
            </div>
            <Switch
              checked={crmConfig.block_duplicate_clients || false}
              onCheckedChange={(v) => updateCrmConfig({ block_duplicate_clients: v })}
            />
          </div>

          {/* Required fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Campos obrigatórios no cadastro</p>
              <Badge variant="secondary" className="text-[10px]">
                {(crmConfig.required_fields || []).length} selecionados
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {CRM_FIELD_OPTIONS.map((opt) => {
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
                    <span className="text-sm">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
