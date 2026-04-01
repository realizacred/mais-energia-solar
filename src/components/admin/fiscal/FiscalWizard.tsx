import { useState, useEffect } from "react";
import { Settings2, Building2, MapPin, FileText, Zap, TestTube, Globe, Loader2, Save, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ReadinessGate } from "./ReadinessGate";
import { useFiscalWizardSettings, useFiscalWizardServices, useSaveFiscalSettings } from "@/hooks/useFiscalWizard";

const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function FiscalWizard() {
  const { data: loadedSettings, isLoading: loading } = useFiscalWizardSettings();
  const { data: services = [], refetch: reloadServices } = useFiscalWizardServices();
  const saveMutation = useSaveFiscalSettings();
  const [saving, setSaving] = useState(false);
  const [syncingServices, setSyncingServices] = useState(false);
  const [settings, setSettings] = useState({
    id: null as string | null,
    cnpj_emitente: "",
    inscricao_municipal: "",
    municipio_emitente: "",
    uf_emitente: "",
    regime_tributario: "simples_nacional",
    portal_nacional_enabled: false,
    allow_deductions: false,
    auto_issue_on_payment: false,
    default_service_description: "",
    default_observations: "",
    default_taxes: {} as Record<string, unknown>,
    homologation_tested: false,
    is_active: false,
  });

  // Populate local state from loaded settings
  useEffect(() => {
    if (loadedSettings) {
      setSettings({
        id: loadedSettings.id,
        cnpj_emitente: loadedSettings.cnpj_emitente || "",
        inscricao_municipal: loadedSettings.inscricao_municipal || "",
        municipio_emitente: loadedSettings.municipio_emitente || "",
        uf_emitente: loadedSettings.uf_emitente || "",
        regime_tributario: loadedSettings.regime_tributario || "simples_nacional",
        portal_nacional_enabled: loadedSettings.portal_nacional_enabled || false,
        allow_deductions: loadedSettings.allow_deductions || false,
        auto_issue_on_payment: loadedSettings.auto_issue_on_payment || false,
        default_service_description: loadedSettings.default_service_description || "",
        default_observations: loadedSettings.default_observations || "",
        default_taxes: (loadedSettings.default_taxes as Record<string, unknown>) || {},
        homologation_tested: loadedSettings.homologation_tested || false,
        is_active: loadedSettings.is_active || false,
      });
    }
  }, [loadedSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const payload = {
        cnpj_emitente: settings.cnpj_emitente,
        inscricao_municipal: settings.inscricao_municipal,
        municipio_emitente: settings.municipio_emitente,
        uf_emitente: settings.uf_emitente,
        regime_tributario: settings.regime_tributario,
        portal_nacional_enabled: settings.portal_nacional_enabled,
        allow_deductions: settings.allow_deductions,
        auto_issue_on_payment: settings.auto_issue_on_payment,
        default_service_description: settings.default_service_description,
        default_observations: settings.default_observations,
        default_taxes: settings.default_taxes as any,
        is_active: settings.is_active,
      };

      if (settings.id) {
        const { error } = await supabase.from("fiscal_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("fiscal_settings").insert({ ...payload, tenant_id: profile.tenant_id } as any).select("id").single();
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }
      toast.success("Configuração fiscal salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncServices = async () => {
    setSyncingServices(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-municipal-services-sync");
      if (error) throw error;
      if (data.success) {
        toast.success(data.message);
        loadServices();
      } else {
        toast.warning(data.error || data.message);
      }
    } catch (e: any) {
      toast.error("Erro ao sincronizar: " + e.message);
    } finally {
      setSyncingServices(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Readiness Gate */}
      <SectionCard icon={Zap} title="Status de Prontidão" description="Verifique se tudo está configurado antes de emitir">
        <ReadinessGate />
      </SectionCard>

      {/* Emitente */}
      <SectionCard icon={Building2} title="Dados do Emitente" description="CNPJ e dados fiscais da empresa emissora">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <CpfCnpjInput value={settings.cnpj_emitente} onChange={v => setSettings(p => ({ ...p, cnpj_emitente: v }))} label="" showValidation={false} />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Municipal</Label>
            <Input placeholder="Número da IM" value={settings.inscricao_municipal} onChange={e => setSettings(p => ({ ...p, inscricao_municipal: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Município</Label>
            <Input placeholder="Ex: Cataguases" value={settings.municipio_emitente} onChange={e => setSettings(p => ({ ...p, municipio_emitente: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Select value={settings.uf_emitente} onValueChange={v => setSettings(p => ({ ...p, uf_emitente: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Regime Tributário</Label>
            <Select value={settings.regime_tributario} onValueChange={v => setSettings(p => ({ ...p, regime_tributario: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
                <SelectItem value="mei">MEI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Serviços Municipais */}
      <SectionCard icon={MapPin} title="Serviços Municipais" description="Serviços disponíveis para emissão de NFS-e"
        actions={
          <Button variant="outline" size="sm" onClick={handleSyncServices} disabled={syncingServices} className="gap-1.5">
            {syncingServices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Portal Nacional */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-info" />
                <Label className="text-sm font-medium">Portal Nacional</Label>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Se habilitado, serviços municipais podem não listar via API</p>
            </div>
            <Switch checked={settings.portal_nacional_enabled} onCheckedChange={v => setSettings(p => ({ ...p, portal_nacional_enabled: v }))} />
          </div>

          {/* Services list */}
          {services.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum serviço encontrado</p>
              <p className="text-xs">Clique em "Sincronizar" ou cadastre manualmente</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {services.map(svc => (
                <div key={svc.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{svc.service_name}</p>
                    {svc.service_code && <p className="text-xs text-muted-foreground">Código: {svc.service_code}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {svc.is_manual ? "Manual" : "Asaas"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Configurações Gerais */}
      <SectionCard icon={Settings2} title="Configurações Gerais" description="Opções de emissão automática e padrões">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição padrão do serviço</Label>
            <Textarea 
              placeholder="Ex: Prestação de serviço de engenharia para implantação de sistema de energia solar fotovoltaica"
              value={settings.default_service_description}
              onChange={e => setSettings(p => ({ ...p, default_service_description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações padrão</Label>
            <Textarea
              placeholder="Ex: Conforme contrato de prestação de serviços..."
              value={settings.default_observations}
              onChange={e => setSettings(p => ({ ...p, default_observations: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div>
              <Label className="text-sm font-medium">Permitir deduções</Label>
              <p className="text-xs text-muted-foreground">Habilitar campo de dedução na emissão</p>
            </div>
            <Switch checked={settings.allow_deductions} onCheckedChange={v => setSettings(p => ({ ...p, allow_deductions: v }))} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div>
              <Label className="text-sm font-medium">Emissão automática ao receber pagamento</Label>
              <p className="text-xs text-muted-foreground">NFS-e emitida automaticamente via webhook de pagamento</p>
            </div>
            <Switch checked={settings.auto_issue_on_payment} onCheckedChange={v => setSettings(p => ({ ...p, auto_issue_on_payment: v }))} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div>
              <Label className="text-sm font-medium">Módulo fiscal ativo</Label>
              <p className="text-xs text-muted-foreground">Habilitar emissão de NFS-e</p>
            </div>
            <Switch checked={settings.is_active} onCheckedChange={v => setSettings(p => ({ ...p, is_active: v }))} />
          </div>
        </div>
      </SectionCard>

      {/* Homologation */}
      <SectionCard icon={TestTube} title="Teste em Homologação" description="Obrigatório antes de emitir em produção">
        <div className="space-y-3">
          {settings.homologation_tested ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
              <Zap className="h-4 w-4 text-success" />
              <span className="text-sm text-success font-medium">Teste realizado com sucesso!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <TestTube className="h-4 w-4 text-warning" />
              <span className="text-sm text-warning">Emita uma NFS-e de teste na aba "Emissão" antes de usar em produção.</span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configuração Fiscal
        </Button>
      </div>
    </div>
  );
}
