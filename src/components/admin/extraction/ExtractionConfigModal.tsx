/**
 * ExtractionConfigModal — Modal for creating/editing extraction config per concessionária.
 * §25: FormModalTemplate pattern.
 */
import { useState, useEffect } from "react";
import { FormModalTemplate, FormSection, FormGrid, FormDivider } from "@/components/ui-kit/FormModalTemplate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Settings2 } from "lucide-react";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useSaveExtractionConfig, type ExtractionConfig, type ExtractionStrategyMode } from "@/hooks/useExtractionConfigs";
import { toast } from "sonner";

interface ExtractionConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ExtractionConfig | null;
}

const DEFAULT_REQUIRED_FIELDS = ["consumo_kwh", "valor_total", "referencia_mes", "referencia_ano"];
const PROVIDER_OPTIONS = [
  { value: "infosimples", label: "Infosimples" },
];

export function ExtractionConfigModal({ open, onOpenChange, config }: ExtractionConfigModalProps) {
  const { data: concessionarias = [] } = useConcessionarias();
  const saveConfig = useSaveExtractionConfig();

  const [form, setForm] = useState({
    concessionaria_code: "",
    concessionaria_nome: "",
    concessionaria_id: null as string | null,
    strategy_mode: "native" as ExtractionStrategyMode,
    native_enabled: true,
    provider_enabled: false,
    provider_name: "",
    provider_endpoint_key: "",
    provider_requires_base64: false,
    provider_requires_password: false,
    fallback_enabled: false,
    required_fields: DEFAULT_REQUIRED_FIELDS,
    optional_fields: [] as string[],
    parser_version: "3.0.2",
    active: true,
    notes: "",
  });

  useEffect(() => {
    if (config) {
      setForm({
        concessionaria_code: config.concessionaria_code,
        concessionaria_nome: config.concessionaria_nome,
        concessionaria_id: config.concessionaria_id,
        strategy_mode: config.strategy_mode,
        native_enabled: config.native_enabled,
        provider_enabled: config.provider_enabled,
        provider_name: config.provider_name || "",
        provider_endpoint_key: config.provider_endpoint_key || "",
        provider_requires_base64: config.provider_requires_base64,
        provider_requires_password: config.provider_requires_password,
        fallback_enabled: config.fallback_enabled,
        required_fields: config.required_fields || DEFAULT_REQUIRED_FIELDS,
        optional_fields: config.optional_fields || [],
        parser_version: config.parser_version || "3.0.2",
        active: config.active,
        notes: config.notes || "",
      });
    } else {
      setForm({
        concessionaria_code: "",
        concessionaria_nome: "",
        concessionaria_id: null,
        strategy_mode: "native",
        native_enabled: true,
        provider_enabled: false,
        provider_name: "",
        provider_endpoint_key: "",
        provider_requires_base64: false,
        provider_requires_password: false,
        fallback_enabled: false,
        required_fields: DEFAULT_REQUIRED_FIELDS,
        optional_fields: [],
        parser_version: "3.0.2",
        active: true,
        notes: "",
      });
    }
  }, [config, open]);

  const handleConcessionariaSelect = (concId: string) => {
    const conc = concessionarias.find(c => c.id === concId);
    if (conc) {
      setForm(f => ({
        ...f,
        concessionaria_id: conc.id,
        concessionaria_code: conc.sigla || conc.nome.toLowerCase().replace(/\s+/g, "_"),
        concessionaria_nome: conc.nome,
      }));
    }
  };

  const handleSave = async () => {
    if (!form.concessionaria_code || !form.concessionaria_nome) {
      toast.error("Selecione uma concessionária");
      return;
    }

    try {
      await saveConfig.mutateAsync({
        ...(config?.id ? { id: config.id } : {}),
        concessionaria_id: form.concessionaria_id,
        concessionaria_code: form.concessionaria_code,
        concessionaria_nome: form.concessionaria_nome,
        strategy_mode: form.strategy_mode,
        native_enabled: form.native_enabled,
        provider_enabled: form.provider_enabled,
        provider_name: form.provider_name || null,
        provider_endpoint_key: form.provider_endpoint_key || null,
        provider_requires_base64: form.provider_requires_base64,
        provider_requires_password: form.provider_requires_password,
        fallback_enabled: form.fallback_enabled,
        required_fields: form.required_fields,
        optional_fields: form.optional_fields,
        parser_version: form.parser_version,
        active: form.active,
        notes: form.notes || null,
      } as any);
      toast.success(config ? "Configuração atualizada" : "Configuração criada");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configuração");
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title={config ? "Editar Configuração" : "Nova Configuração de Extração"}
      subtitle="Configure a estratégia de extração de dados por concessionária"
      icon={Settings2}
      onSubmit={handleSave}
      submitLabel={config ? "Salvar" : "Cadastrar"}
      saving={saveConfig.isPending}
      disabled={!form.concessionaria_code}
      className="w-[90vw] max-w-3xl"
    >
      <FormSection title="Concessionária">
        <FormGrid>
          <div className="space-y-1.5">
            <Label>Concessionária</Label>
            <Select
              value={form.concessionaria_id || ""}
              onValueChange={handleConcessionariaSelect}
              disabled={!!config}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {concessionarias.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.sigla ? `(${c.sigla})` : ""} {c.estado ? `- ${c.estado}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Código (slug)</Label>
            <Input
              value={form.concessionaria_code}
              onChange={e => setForm(f => ({ ...f, concessionaria_code: e.target.value }))}
              placeholder="energisa, light, cemig..."
            />
          </div>
        </FormGrid>
      </FormSection>

      <FormDivider />

      <FormSection title="Estratégia de Extração">
        <FormGrid>
          <div className="space-y-1.5">
            <Label>Modo</Label>
            <Select
              value={form.strategy_mode}
              onValueChange={(v) => setForm(f => ({ ...f, strategy_mode: v as ExtractionStrategyMode }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="native">Parser Nativo</SelectItem>
                <SelectItem value="provider">Provedor Externo</SelectItem>
                <SelectItem value="auto">Automático (fallback)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Versão do Parser</Label>
            <Input
              value={form.parser_version || ""}
              onChange={e => setForm(f => ({ ...f, parser_version: e.target.value }))}
              placeholder="3.0.2"
            />
          </div>
        </FormGrid>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Parser Nativo</p>
            <p className="text-xs text-muted-foreground">Usar parser determinístico interno</p>
          </div>
          <Switch checked={form.native_enabled} onCheckedChange={v => setForm(f => ({ ...f, native_enabled: v }))} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Fallback Habilitado</p>
            <p className="text-xs text-muted-foreground">Se parser falhar, tenta provedor externo</p>
          </div>
          <Switch checked={form.fallback_enabled} onCheckedChange={v => setForm(f => ({ ...f, fallback_enabled: v }))} />
        </div>
      </FormSection>

      <FormDivider />

      <FormSection title="Provedor Externo">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Provedor Habilitado</p>
            <p className="text-xs text-muted-foreground">Ativar extração via API externa</p>
          </div>
          <Switch checked={form.provider_enabled} onCheckedChange={v => setForm(f => ({ ...f, provider_enabled: v }))} />
        </div>

        {form.provider_enabled && (
          <>
            <FormGrid>
              <div className="space-y-1.5">
                <Label>Provedor</Label>
                <Select
                  value={form.provider_name}
                  onValueChange={v => setForm(f => ({ ...f, provider_name: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Endpoint Key</Label>
                <Input
                  value={form.provider_endpoint_key}
                  onChange={e => setForm(f => ({ ...f, provider_endpoint_key: e.target.value }))}
                  placeholder="light, cemig, enel..."
                />
              </div>
            </FormGrid>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Requer Base64</p>
                <p className="text-xs text-muted-foreground">Backend converte PDF do Storage para base64</p>
              </div>
              <Switch checked={form.provider_requires_base64} onCheckedChange={v => setForm(f => ({ ...f, provider_requires_base64: v }))} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Requer Senha</p>
                <p className="text-xs text-muted-foreground">PDF protegido por senha da concessionária</p>
              </div>
              <Switch checked={form.provider_requires_password} onCheckedChange={v => setForm(f => ({ ...f, provider_requires_password: v }))} />
            </div>
          </>
        )}
      </FormSection>

      <FormDivider />

      <FormSection title="Campos e Status">
        <div className="space-y-1.5">
          <Label>Campos Obrigatórios (JSON)</Label>
          <Textarea
            value={JSON.stringify(form.required_fields, null, 2)}
            onChange={e => {
              try {
                setForm(f => ({ ...f, required_fields: JSON.parse(e.target.value) }));
              } catch { /* ignore parse errors during typing */ }
            }}
            rows={3}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Ativo</p>
            <p className="text-xs text-muted-foreground">Habilitar esta configuração</p>
          </div>
          <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
        </div>

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notas sobre esta configuração..."
            rows={2}
          />
        </div>
      </FormSection>
    </FormModalTemplate>
  );
}
