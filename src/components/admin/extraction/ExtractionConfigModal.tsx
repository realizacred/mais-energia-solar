/**
 * ExtractionConfigModal — Modal for creating/editing extraction config per concessionária.
 * §25: FormModalTemplate pattern. Reposicionado para modelo 100% nativo.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, Cpu, FileText, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useSaveExtractionConfig, type ExtractionConfig, type ExtractionStrategyMode } from "@/hooks/useExtractionConfigs";
import { toast } from "sonner";

interface ExtractionConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ExtractionConfig | null;
}

const DEFAULT_REQUIRED_FIELDS = ["consumo_kwh", "valor_total", "referencia_mes", "referencia_ano"];

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SwitchRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium leading-none text-foreground">{label}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

export function ExtractionConfigModal({ open, onOpenChange, config }: ExtractionConfigModalProps) {
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

  const handleSave = async () => {
    if (!form.concessionaria_code || !form.concessionaria_nome) {
      toast.error("Preencha o nome e código da concessionária");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[1100px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {config ? "Editar Configuração" : "Nova Configuração de Extração"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure a estratégia de extração nativa por concessionária
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <SectionCard icon={Settings2} title="Concessionária">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={form.concessionaria_nome}
                      onChange={e => setForm(f => ({ ...f, concessionaria_nome: e.target.value }))}
                      placeholder="Energisa, Light, Cemig..."
                      className="h-10"
                      disabled={!!config}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código (slug)</Label>
                    <Input
                      value={form.concessionaria_code}
                      onChange={e => setForm(f => ({ ...f, concessionaria_code: e.target.value }))}
                      placeholder="energisa, light, cemig..."
                      className="h-10"
                      disabled={!!config}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={Cpu} title="Estratégia de Extração">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modo</Label>
                    <Select
                      value={form.strategy_mode}
                      onValueChange={(v) => setForm(f => ({ ...f, strategy_mode: v as ExtractionStrategyMode }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="native">Nativo</SelectItem>
                        <SelectItem value="provider">Nativo (assistido)</SelectItem>
                        <SelectItem value="auto">Automático</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Versão do Parser</Label>
                    <Input
                      value={form.parser_version || ""}
                      onChange={e => setForm(f => ({ ...f, parser_version: e.target.value }))}
                      placeholder="3.0.2"
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <SwitchRow label="Parser Nativo" description="Usar parser determinístico interno" checked={form.native_enabled} onChange={v => setForm(f => ({ ...f, native_enabled: v }))} />
                  <SwitchRow label="Suporte Avançado" description="Habilitar cobertura adicional de extração" checked={form.provider_enabled} onChange={v => setForm(f => ({ ...f, provider_enabled: v }))} />
                </div>
              </SectionCard>

              <SectionCard icon={RefreshCw} title="Recuperação e Fallback">
                <div className="space-y-2">
                  <SwitchRow label="Recuperação Automática" description="Se o parser falhar, o sistema tenta outra rota interna" checked={form.fallback_enabled} onChange={v => setForm(f => ({ ...f, fallback_enabled: v }))} />
                  <SwitchRow label="Requer Conversão Backend" description="O backend converte o PDF do Storage para processamento" checked={form.provider_requires_base64} onChange={v => setForm(f => ({ ...f, provider_requires_base64: v }))} />
                  <SwitchRow label="PDF Protegido" description="A fatura exige senha para abertura" checked={form.provider_requires_password} onChange={v => setForm(f => ({ ...f, provider_requires_password: v }))} />
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-4">
              <SectionCard icon={FileText} title="Campos obrigatórios">
                <div className="space-y-1.5">
                  <Label className="text-xs">Campos obrigatórios (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(form.required_fields, null, 2)}
                    onChange={e => {
                      try {
                        setForm(f => ({ ...f, required_fields: JSON.parse(e.target.value) }));
                      } catch {
                        // ignore parse errors during typing
                      }
                    }}
                    rows={10}
                    className="min-h-[240px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe um array JSON com os campos críticos exigidos para validar a extração.
                  </p>
                </div>
              </SectionCard>

              <SectionCard icon={Settings2} title="Status e observações">
                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notas sobre esta configuração..."
                    rows={8}
                    className="min-h-[180px]"
                  />
                </div>
                <SwitchRow label="Ativo" description="Habilitar esta configuração na Central de Extração" checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
              </SectionCard>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveConfig.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!form.concessionaria_code || saveConfig.isPending}>
            {saveConfig.isPending && <Spinner size="sm" className="mr-2" />}
            {config ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
