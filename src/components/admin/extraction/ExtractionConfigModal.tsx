/**
 * ExtractionConfigModal — Modal for creating/editing extraction config per concessionária.
 * §25: FormModalTemplate pattern. Reposicionado para modelo 100% nativo.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Settings2, Cpu, FileText, RefreshCw, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useSaveExtractionConfig, type ExtractionConfig, type ExtractionStrategyMode } from "@/hooks/useExtractionConfigs";
import { toast } from "sonner";
import { ExtractionHelpHint } from "./ExtractionHelpHint";

interface ExtractionConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ExtractionConfig | null;
}

// ── All available extraction fields with labels and categories ──
interface FieldDef {
  key: string;
  label: string;
  description?: string;
  /** Campo exclusivo de UC geradora (injeção) */
  geradoraOnly?: boolean;
}

interface FieldCategory {
  category: string;
  icon: string;
  fields: FieldDef[];
}

const FIELD_CATEGORIES: FieldCategory[] = [
  {
    category: "Dados Básicos",
    icon: "📋",
    fields: [
      { key: "consumo_kwh", label: "Consumo (kWh)", description: "Consumo total faturado" },
      { key: "valor_total", label: "Valor Total (R$)", description: "Valor total da fatura" },
      { key: "numero_uc", label: "Número da UC", description: "Código da unidade consumidora" },
      { key: "vencimento", label: "Vencimento", description: "Data de vencimento" },
      { key: "mes_referencia", label: "Mês de Referência", description: "Período de referência da fatura" },
    ],
  },
  {
    category: "Leituras e Medição",
    icon: "📊",
    fields: [
      { key: "data_leitura_anterior", label: "Data Leitura Anterior" },
      { key: "data_leitura_atual", label: "Data Leitura Atual" },
      { key: "proxima_leitura_data", label: "Próxima Leitura" },
      { key: "dias_leitura", label: "Dias de Leitura" },
      { key: "leitura_anterior_03", label: "Leitura Anterior (03)", description: "Medidor de consumo" },
      { key: "leitura_atual_03", label: "Leitura Atual (03)", description: "Medidor de consumo" },
      { key: "leitura_anterior_103", label: "Leitura Anterior (103)", description: "Medidor de injeção", geradoraOnly: true },
      { key: "leitura_atual_103", label: "Leitura Atual (103)", description: "Medidor de injeção", geradoraOnly: true },
    ],
  },
  {
    category: "Geração Distribuída (GD)",
    icon: "☀️",
    fields: [
      { key: "energia_injetada_kwh", label: "Energia Injetada (kWh)", geradoraOnly: true },
      { key: "energia_compensada_kwh", label: "Energia Compensada (kWh)" },
      { key: "saldo_gd_acumulado", label: "Saldo GD Acumulado (kWh)", geradoraOnly: true },
      { key: "categoria_gd", label: "Categoria GD", description: "Autoconsumo remoto, local, etc.", geradoraOnly: true },
    ],
  },
  {
    category: "Tarifas e Tributos",
    icon: "💰",
    fields: [
      { key: "tarifa_energia_kwh", label: "Tarifa Energia (R$/kWh)" },
      { key: "tarifa_fio_b_kwh", label: "Tarifa Fio B (R$/kWh)" },
      { key: "icms_percentual", label: "ICMS (%)" },
      { key: "pis_valor", label: "PIS (R$)" },
      { key: "cofins_valor", label: "COFINS (R$)" },
      { key: "bandeira_tarifaria", label: "Bandeira Tarifária" },
    ],
  },
  {
    category: "Dados Técnicos",
    icon: "⚡",
    fields: [
      { key: "classe_consumo", label: "Classe de Consumo" },
      { key: "modalidade_tarifaria", label: "Modalidade Tarifária" },
      { key: "demanda_contratada_kw", label: "Demanda Contratada (kW)" },
      { key: "medidor_consumo_codigo", label: "Código Medidor Consumo" },
      { key: "medidor_injecao_codigo", label: "Código Medidor Injeção", geradoraOnly: true },
      { key: "numero_nota_fiscal", label: "Número da Nota Fiscal" },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_CATEGORIES.flatMap(c => c.fields.map(f => f.key));

const IDENTIFIER_FIELD_OPTIONS = [
  { value: "numero_uc", label: "Número da UC" },
  { value: "numero_instalacao", label: "Número da Instalação" },
  { value: "numero_cliente", label: "Número do Cliente" },
  { value: "codigo_medidor", label: "Código do Medidor" },
];

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

function FieldCategorySection({
  category,
  requiredFields,
  optionalFields,
  onToggleRequired,
  onToggleOptional,
}: {
  category: FieldCategory;
  requiredFields: string[];
  optionalFields: string[];
  onToggleRequired: (key: string) => void;
  onToggleOptional: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const catRequiredCount = category.fields.filter(f => requiredFields.includes(f.key)).length;
  const catOptionalCount = category.fields.filter(f => optionalFields.includes(f.key)).length;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <span className="text-sm">{category.icon}</span>
        <span className="text-sm font-medium text-foreground flex-1">{category.category}</span>
        {catRequiredCount > 0 && (
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
            {catRequiredCount} obrig.
          </Badge>
        )}
        {catOptionalCount > 0 && (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
            {catOptionalCount} opc.
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {category.fields.map(field => {
            const isRequired = requiredFields.includes(field.key);
            const isOptional = optionalFields.includes(field.key);
            return (
              <div key={field.key} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-foreground">{field.label}</p>
                    {field.geradoraOnly && (
                      <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20 px-1 py-0">
                        Geradora
                      </Badge>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{field.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={isRequired}
                      onCheckedChange={() => onToggleRequired(field.key)}
                      className="h-4 w-4"
                    />
                    <span className="text-[11px] text-foreground font-medium">Obrigatório</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={isOptional}
                      disabled={isRequired}
                      onCheckedChange={() => onToggleOptional(field.key)}
                      className="h-4 w-4"
                    />
                    <span className="text-[11px] text-muted-foreground">Opcional</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ExtractionConfigModal({ open, onOpenChange, config }: ExtractionConfigModalProps) {
  const saveConfig = useSaveExtractionConfig();
  const [customFieldInput, setCustomFieldInput] = useState("");

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
    required_fields: ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"] as string[],
    required_fields_geradora: ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia", "energia_injetada_kwh", "saldo_gd_acumulado"] as string[],
    required_fields_beneficiaria: ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"] as string[],
    optional_fields: [] as string[],
    identifier_field: "numero_uc" as string,
    parser_version: "3.0.2",
    active: true,
    notes: "",
    custom_fields: [] as FieldDef[],
  });

  const baselineRef = useRef<string>("");

  useEffect(() => {
    const newForm = config ? {
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
      required_fields: config.required_fields || ["consumo_kwh", "valor_total"],
      required_fields_geradora: config.required_fields_geradora?.length ? config.required_fields_geradora : config.required_fields || ["consumo_kwh", "valor_total"],
      required_fields_beneficiaria: config.required_fields_beneficiaria?.length ? config.required_fields_beneficiaria : (config.required_fields || ["consumo_kwh", "valor_total"]).filter((f: string) => !["energia_injetada_kwh", "saldo_gd_acumulado", "leitura_anterior_103", "leitura_atual_103", "medidor_injecao_codigo", "categoria_gd"].includes(f)),
      optional_fields: config.optional_fields || [],
      identifier_field: config.identifier_field || "numero_uc",
      parser_version: config.parser_version || "3.0.2",
      active: config.active,
      notes: config.notes || "",
      custom_fields: [] as FieldDef[],
    } : {
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
      required_fields: ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"],
      required_fields_geradora: ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia", "energia_injetada_kwh", "saldo_gd_acumulado"],
      required_fields_beneficiaria: ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"],
      optional_fields: [] as string[],
      identifier_field: "numero_uc",
      parser_version: "3.0.2",
      active: true,
      notes: "",
      custom_fields: [] as FieldDef[],
    };
    setForm(newForm);
    baselineRef.current = JSON.stringify(newForm);
    setCustomFieldInput("");
  }, [config, open]);

  const isDirty = useMemo(() => {
    if (!config) return !!form.concessionaria_code; // new: dirty when code filled
    return JSON.stringify(form) !== baselineRef.current;
  }, [form, config]);

  const toggleRequired = (key: string) => {
    setForm(f => {
      const isRequired = f.required_fields.includes(key);
      if (isRequired) {
        return { ...f, required_fields: f.required_fields.filter(k => k !== key) };
      }
      // Remove from optional if adding to required
      return {
        ...f,
        required_fields: [...f.required_fields, key],
        optional_fields: f.optional_fields.filter(k => k !== key),
      };
    });
  };

  const toggleOptional = (key: string) => {
    setForm(f => {
      if (f.required_fields.includes(key)) return f; // Can't be optional if required
      const isOptional = f.optional_fields.includes(key);
      if (isOptional) {
        return { ...f, optional_fields: f.optional_fields.filter(k => k !== key) };
      }
      return { ...f, optional_fields: [...f.optional_fields, key] };
    });
  };

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
        required_fields_geradora: form.required_fields_geradora,
        required_fields_beneficiaria: form.required_fields_beneficiaria,
        optional_fields: form.optional_fields,
        identifier_field: form.identifier_field || "numero_uc",
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
            {/* Row 1: Concessionária + Estratégia + Fallback */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <SectionCard icon={Settings2} title="Concessionária">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Nome</Label>
                      <ExtractionHelpHint text="Nome exibido na Central de Extração. Use o nome comercial da concessionária para facilitar a leitura do time." />
                    </div>
                    <Input
                      value={form.concessionaria_nome}
                      onChange={e => setForm(f => ({ ...f, concessionaria_nome: e.target.value }))}
                      placeholder="Energisa, Light, Cemig..."
                      className="h-10"
                      disabled={!!config}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Código (slug)</Label>
                      <ExtractionHelpHint text="Código técnico usado pelo backend para localizar parser, regras aprendidas e eventos de layout. Ex.: energisa, cemig, light." />
                    </div>
                    <Input
                      value={form.concessionaria_code}
                      onChange={e => setForm(f => ({ ...f, concessionaria_code: e.target.value }))}
                      placeholder="energisa, light, cemig..."
                      className="h-10"
                      disabled={!!config}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Campo identificador da UC</Label>
                      <ExtractionHelpHint text="Define qual campo da conta será comparado com a UC cadastrada para validar titularidade e vínculo automático." />
                    </div>
                    <Select
                      value={form.identifier_field}
                      onValueChange={v => setForm(f => ({ ...f, identifier_field: v }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IDENTIFIER_FIELD_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Como identificar a UC nesta concessionária
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={Cpu} title="Estratégia de Extração">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Modo</Label>
                      <ExtractionHelpHint text="Nativo usa parser determinístico. Automático combina rotas internas. Use esta seção para orientar o backend sem esconder a lógica." />
                    </div>
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
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Versão do Parser</Label>
                      <ExtractionHelpHint text="Versão auditável do parser usada para esta concessionária. Ajuda a rastrear mudanças de comportamento entre releases." />
                    </div>
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
                  <SwitchRow label="Requer Conversão Backend" description="O backend prepara e converte o arquivo antes do processamento" checked={form.provider_requires_base64} onChange={v => setForm(f => ({ ...f, provider_requires_base64: v }))} />
                  <SwitchRow label="PDF Protegido" description="Marque quando a conta costuma exigir senha para abertura" checked={form.provider_requires_password} onChange={v => setForm(f => ({ ...f, provider_requires_password: v }))} />
                </div>
                <SwitchRow label="Ativo" description="Habilitar esta configuração" checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
              </SectionCard>
            </div>

            {/* Row 2: Fields selector with context tabs */}
            <SectionCard icon={FileText} title="Campos de Extração">
              <div className="space-y-1 mb-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure quais campos são obrigatórios dependendo do tipo de UC.
                  Campos marcados com <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20 px-1 py-0 mx-0.5 inline">Geradora</Badge> são
                  exclusivos de unidades que injetam energia na rede.
                </p>
              </div>

              <Tabs defaultValue="geral" className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="geral">Geral (Base)</TabsTrigger>
                  <TabsTrigger value="geradora">☀️ Geradora</TabsTrigger>
                  <TabsTrigger value="beneficiaria">🏠 Beneficiária</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="mt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Campos base usados quando o tipo de UC não é conhecido (ex.: teste de extração sem vínculo).
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {form.required_fields.length} obrigatórios
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                      {form.optional_fields.length} opcionais
                    </Badge>
                  </div>
                  {FIELD_CATEGORIES.map(cat => (
                    <FieldCategorySection
                      key={cat.category}
                      category={cat}
                      requiredFields={form.required_fields}
                      optionalFields={form.optional_fields}
                      onToggleRequired={toggleRequired}
                      onToggleOptional={toggleOptional}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="geradora" className="mt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Campos obrigatórios para UCs que injetam energia (geradoras). Inclui campos de injeção, saldo e medidor 103.
                  </p>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-2">
                    {form.required_fields_geradora.length} obrigatórios para geradora
                  </Badge>
                  {FIELD_CATEGORIES.map(cat => (
                    <FieldCategorySection
                      key={`ger-${cat.category}`}
                      category={cat}
                      requiredFields={form.required_fields_geradora}
                      optionalFields={[]}
                      onToggleRequired={(key) => {
                        setForm(f => {
                          const has = f.required_fields_geradora.includes(key);
                          return {
                            ...f,
                            required_fields_geradora: has
                              ? f.required_fields_geradora.filter(k => k !== key)
                              : [...f.required_fields_geradora, key],
                          };
                        });
                      }}
                      onToggleOptional={() => {}}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="beneficiaria" className="mt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Campos obrigatórios para UCs beneficiárias (recebem créditos). Campos de injeção não se aplicam.
                  </p>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-2">
                    {form.required_fields_beneficiaria.length} obrigatórios para beneficiária
                  </Badge>
                  {FIELD_CATEGORIES.filter(cat => cat.category !== "Geração Distribuída (GD)" || cat.fields.some(f => !f.geradoraOnly)).map(cat => {
                    const filteredCat = {
                      ...cat,
                      fields: cat.fields.filter(f => !f.geradoraOnly),
                    };
                    return (
                      <FieldCategorySection
                        key={`ben-${cat.category}`}
                        category={filteredCat}
                        requiredFields={form.required_fields_beneficiaria}
                        optionalFields={[]}
                        onToggleRequired={(key) => {
                          setForm(f => {
                            const has = f.required_fields_beneficiaria.includes(key);
                            return {
                              ...f,
                              required_fields_beneficiaria: has
                                ? f.required_fields_beneficiaria.filter(k => k !== key)
                                : [...f.required_fields_beneficiaria, key],
                            };
                          });
                        }}
                        onToggleOptional={() => {}}
                      />
                    );
                  })}
                </TabsContent>
              </Tabs>
            </SectionCard>

            {/* Row 3: Notes */}
            {form.notes || !config ? (
              <SectionCard icon={Settings2} title="Observações">
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas sobre esta configuração..."
                  rows={3}
                  className="min-h-[80px]"
                />
              </SectionCard>
            ) : null}
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
