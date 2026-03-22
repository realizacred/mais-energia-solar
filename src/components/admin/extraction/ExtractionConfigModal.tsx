/**
 * ExtractionConfigModal — Modal for creating/editing extraction config per concessionária.
 * §25: FormModalTemplate pattern. Supports pre-fill from test results and JSON advanced mode.
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
import { Settings2, Cpu, FileText, RefreshCw, ChevronDown, ChevronRight, Plus, X, Code2, Eye } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useSaveExtractionConfig, type ExtractionConfig, type ExtractionStrategyMode } from "@/hooks/useExtractionConfigs";
import { toast } from "sonner";
import { ExtractionHelpHint } from "./ExtractionHelpHint";

/** Pre-fill data generated from test results */
export interface ExtractionConfigPrefill {
  concessionaria_code: string;
  concessionaria_nome: string;
  fields_found: string[];
  fields_missing: string[];
  parser_version?: string;
  tipo_uc_detectado?: string;
}

interface ExtractionConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ExtractionConfig | null;
  prefill?: ExtractionConfigPrefill | null;
}

// ── All available extraction fields with labels and categories ──
interface FieldDef {
  key: string;
  label: string;
  description?: string;
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
const BASE_REQUIRED = ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"];
const GERADORA_EXTRA = ["energia_injetada_kwh", "saldo_gd_acumulado"];
const MISTA_EXTRA = ["energia_injetada_kwh", "energia_compensada_kwh"];
const CONSUMO_FIELDS = ["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"];
const BENEFICIARIA_NEVER = ["energia_injetada_kwh", "saldo_gd_acumulado", "leitura_anterior_103", "leitura_atual_103", "medidor_injecao_codigo", "categoria_gd"];

const IDENTIFIER_FIELD_OPTIONS = [
  { value: "numero_uc", label: "Número da UC" },
  { value: "numero_instalacao", label: "Número da Instalação" },
  { value: "numero_cliente", label: "Número do Cliente" },
  { value: "codigo_medidor", label: "Código do Medidor" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "imagem", label: "Imagem" },
  { value: "ambos", label: "PDF e Imagem" },
];

const DEFAULT_GERADORA_SIGNALS = ["energia_injetada_kwh", "leitura_103", "medidor_injecao"];
const DEFAULT_BENEFICIARIA_SIGNALS = ["energia_compensada_kwh", "saldo_gd_acumulado", "creditos_recebidos"];
const DEFAULT_MISTA_SIGNALS = ["energia_injetada_kwh", "energia_compensada_kwh"];

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

function SwitchRow({ label, description, hint, checked, onChange }: { label: string; description: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium leading-none text-foreground">{label}</p>
          {hint && <ExtractionHelpHint text={hint} />}
        </div>
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

/** Build form state from config, prefill, or defaults */
function buildFormState(config?: ExtractionConfig | null, prefill?: ExtractionConfigPrefill | null) {
  if (config) {
    return {
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
      recovery_enabled: config.recovery_enabled ?? false,
      required_fields: config.required_fields || BASE_REQUIRED,
      required_fields_geradora: config.required_fields_geradora?.length ? config.required_fields_geradora : [...BASE_REQUIRED, ...GERADORA_EXTRA],
      required_fields_beneficiaria: config.required_fields_beneficiaria?.length ? config.required_fields_beneficiaria : BASE_REQUIRED.filter(f => !BENEFICIARIA_NEVER.includes(f)),
      required_fields_mista: config.required_fields_mista?.length ? config.required_fields_mista : [...BASE_REQUIRED, ...MISTA_EXTRA],
      required_fields_consumo: config.required_fields_consumo?.length ? config.required_fields_consumo : [...CONSUMO_FIELDS],
      desired_fields: config.desired_fields || [],
      blocking_fields: config.blocking_fields || [],
      geradora_signals: config.geradora_signals?.length ? config.geradora_signals : DEFAULT_GERADORA_SIGNALS,
      beneficiaria_signals: config.beneficiaria_signals?.length ? config.beneficiaria_signals : DEFAULT_BENEFICIARIA_SIGNALS,
      mista_signals: config.mista_signals?.length ? config.mista_signals : DEFAULT_MISTA_SIGNALS,
      source_type_supported: config.source_type_supported || "pdf",
      optional_fields: config.optional_fields || [],
      identifier_field: config.identifier_field || "numero_uc",
      parser_version: config.parser_version || "3.0.2",
      active: config.active,
      notes: config.notes || "",
      custom_fields: [] as FieldDef[],
    };
  }

  // Prefill from test results
  if (prefill) {
    const allFound = prefill.fields_found || [];
    const optionals = allFound.filter(f => !BASE_REQUIRED.includes(f));
    return {
      concessionaria_code: prefill.concessionaria_code,
      concessionaria_nome: prefill.concessionaria_nome,
      concessionaria_id: null as string | null,
      strategy_mode: "native" as ExtractionStrategyMode,
      native_enabled: true,
      provider_enabled: false,
      provider_name: "",
      provider_endpoint_key: "",
      provider_requires_base64: false,
      provider_requires_password: false,
      fallback_enabled: false,
      recovery_enabled: false,
      required_fields: [...BASE_REQUIRED],
      required_fields_geradora: [...BASE_REQUIRED, ...GERADORA_EXTRA],
      required_fields_beneficiaria: BASE_REQUIRED.filter(f => !BENEFICIARIA_NEVER.includes(f)),
      required_fields_mista: [...BASE_REQUIRED, ...MISTA_EXTRA],
      required_fields_consumo: [...CONSUMO_FIELDS],
      desired_fields: [] as string[],
      blocking_fields: [] as string[],
      geradora_signals: [...DEFAULT_GERADORA_SIGNALS],
      beneficiaria_signals: [...DEFAULT_BENEFICIARIA_SIGNALS],
      mista_signals: [...DEFAULT_MISTA_SIGNALS],
      source_type_supported: "pdf",
      optional_fields: optionals.filter(f => !GERADORA_EXTRA.includes(f) && !BENEFICIARIA_NEVER.includes(f)),
      identifier_field: "numero_uc",
      parser_version: prefill.parser_version || "3.0.2",
      active: true,
      notes: prefill.tipo_uc_detectado
        ? `Tipo UC detectado automaticamente: ${prefill.tipo_uc_detectado}. Configuração gerada a partir de teste de extração.`
        : "Configuração gerada a partir de teste de extração.",
      custom_fields: [] as FieldDef[],
    };
  }

  // Defaults
  return {
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
    recovery_enabled: false,
    required_fields: [...BASE_REQUIRED],
    required_fields_geradora: [...BASE_REQUIRED, ...GERADORA_EXTRA],
    required_fields_beneficiaria: BASE_REQUIRED.filter(f => !BENEFICIARIA_NEVER.includes(f)),
    required_fields_mista: [...BASE_REQUIRED, ...MISTA_EXTRA],
    required_fields_consumo: [...CONSUMO_FIELDS],
    desired_fields: [] as string[],
    blocking_fields: [] as string[],
    geradora_signals: [...DEFAULT_GERADORA_SIGNALS],
    beneficiaria_signals: [...DEFAULT_BENEFICIARIA_SIGNALS],
    mista_signals: [...DEFAULT_MISTA_SIGNALS],
    source_type_supported: "pdf",
    optional_fields: [] as string[],
    identifier_field: "numero_uc",
    parser_version: "3.0.2",
    active: true,
    notes: "",
    custom_fields: [] as FieldDef[],
  };
}

/** Extract the DB-saveable payload from form state (for JSON mode) */
function formToJsonPayload(form: ReturnType<typeof buildFormState>) {
  return {
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
    recovery_enabled: form.recovery_enabled,
    required_fields: form.required_fields,
    required_fields_geradora: form.required_fields_geradora,
    required_fields_beneficiaria: form.required_fields_beneficiaria,
    required_fields_mista: form.required_fields_mista,
    required_fields_consumo: form.required_fields_consumo,
    desired_fields: form.desired_fields,
    blocking_fields: form.blocking_fields,
    geradora_signals: form.geradora_signals,
    beneficiaria_signals: form.beneficiaria_signals,
    mista_signals: form.mista_signals,
    source_type_supported: form.source_type_supported,
    optional_fields: form.optional_fields,
    identifier_field: form.identifier_field,
    parser_version: form.parser_version,
    active: form.active,
    notes: form.notes || null,
  };
}

// ── JSONB Fields Editor Tab ──
const JSONB_FIELD_DEFS = [
  { key: "required_fields_mista", label: "Campos Obrigatórios — Mista" },
  { key: "required_fields_consumo", label: "Campos Obrigatórios — Consumo" },
  { key: "desired_fields", label: "Campos Desejados" },
  { key: "blocking_fields", label: "Campos Bloqueantes" },
  { key: "geradora_signals", label: "Sinais de Geradora" },
  { key: "beneficiaria_signals", label: "Sinais de Beneficiária" },
  { key: "mista_signals", label: "Sinais de Mista" },
  { key: "layout_rules", label: "Regras de Layout" },
] as const;

type JsonbFieldKey = typeof JSONB_FIELD_DEFS[number]["key"];

function JsonbFieldEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (parsed: any) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  // Sync external changes
  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      setError(null);
      onChange(parsed);
    } catch (e: any) {
      setError("JSON inválido");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <Textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={4}
        className="font-mono text-xs min-h-[80px]"
        spellCheck={false}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ExtractionConfigModal({ open, onOpenChange, config, prefill }: ExtractionConfigModalProps) {
  const saveConfig = useSaveExtractionConfig();
  const [customFieldInput, setCustomFieldInput] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonbErrors, setJsonbErrors] = useState<Set<string>>(new Set());

  const [form, setForm] = useState(() => buildFormState(config, prefill));
  const baselineRef = useRef<string>("");

  useEffect(() => {
    const newForm = buildFormState(config, prefill);
    setForm(newForm);
    baselineRef.current = JSON.stringify(newForm);
    setCustomFieldInput("");
    setViewMode("visual");
    setJsonbErrors(new Set());
  }, [config, prefill, open]);

  // Sync form → JSON when switching to JSON mode
  useEffect(() => {
    if (viewMode === "json") {
      setJsonText(JSON.stringify(formToJsonPayload(form), null, 2));
      setJsonError(null);
    }
  }, [viewMode]);

  const isDirty = useMemo(() => {
    if (!config && !prefill) return !!form.concessionaria_code;
    if (prefill && !config) return true; // prefilled = always dirty
    return JSON.stringify(form) !== baselineRef.current;
  }, [form, config, prefill]);

  const toggleRequired = (key: string) => {
    setForm(f => {
      const isRequired = f.required_fields.includes(key);
      if (isRequired) {
        return { ...f, required_fields: f.required_fields.filter(k => k !== key) };
      }
      return {
        ...f,
        required_fields: [...f.required_fields, key],
        optional_fields: f.optional_fields.filter(k => k !== key),
      };
    });
  };

  const toggleOptional = (key: string) => {
    setForm(f => {
      if (f.required_fields.includes(key)) return f;
      const isOptional = f.optional_fields.includes(key);
      if (isOptional) {
        return { ...f, optional_fields: f.optional_fields.filter(k => k !== key) };
      }
      return { ...f, optional_fields: [...f.optional_fields, key] };
    });
  };

  /** Apply JSON changes back to form */
  const applyJsonToForm = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setForm(f => ({
        ...f,
        concessionaria_code: parsed.concessionaria_code ?? f.concessionaria_code,
        concessionaria_nome: parsed.concessionaria_nome ?? f.concessionaria_nome,
        strategy_mode: parsed.strategy_mode ?? f.strategy_mode,
        native_enabled: parsed.native_enabled ?? f.native_enabled,
        provider_enabled: parsed.provider_enabled ?? f.provider_enabled,
        provider_name: parsed.provider_name ?? "",
        provider_endpoint_key: parsed.provider_endpoint_key ?? "",
        provider_requires_base64: parsed.provider_requires_base64 ?? f.provider_requires_base64,
        provider_requires_password: parsed.provider_requires_password ?? f.provider_requires_password,
        fallback_enabled: parsed.fallback_enabled ?? f.fallback_enabled,
        required_fields: Array.isArray(parsed.required_fields) ? parsed.required_fields : f.required_fields,
        required_fields_geradora: Array.isArray(parsed.required_fields_geradora) ? parsed.required_fields_geradora : f.required_fields_geradora,
        required_fields_beneficiaria: Array.isArray(parsed.required_fields_beneficiaria) ? parsed.required_fields_beneficiaria : f.required_fields_beneficiaria,
        optional_fields: Array.isArray(parsed.optional_fields) ? parsed.optional_fields : f.optional_fields,
        identifier_field: parsed.identifier_field ?? f.identifier_field,
        parser_version: parsed.parser_version ?? f.parser_version,
        active: parsed.active ?? f.active,
        notes: parsed.notes ?? f.notes,
      }));
      setJsonError(null);
      setViewMode("visual");
      toast.success("JSON aplicado ao formulário");
    } catch (err: any) {
      setJsonError(err.message || "JSON inválido");
    }
  };

  const handleSave = async () => {
    if (!form.concessionaria_code || !form.concessionaria_nome) {
      toast.error("Preencha o nome e código da concessionária");
      return;
    }

    try {
      // If editing a system default (tenant_id IS NULL), create a tenant-specific override
      const isSystemDefault = config && !config.tenant_id;
      const configId = isSystemDefault ? undefined : config?.id;

      await saveConfig.mutateAsync({
        ...(configId ? { id: configId } : {}),
        ...(isSystemDefault ? { is_system_default: true } : {}),
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
        recovery_enabled: form.recovery_enabled,
        required_fields: form.required_fields,
        required_fields_geradora: form.required_fields_geradora,
        required_fields_beneficiaria: form.required_fields_beneficiaria,
        required_fields_mista: form.required_fields_mista,
        required_fields_consumo: form.required_fields_consumo,
        desired_fields: form.desired_fields,
        blocking_fields: form.blocking_fields,
        geradora_signals: form.geradora_signals,
        beneficiaria_signals: form.beneficiaria_signals,
        mista_signals: form.mista_signals,
        source_type_supported: form.source_type_supported,
        optional_fields: form.optional_fields,
        identifier_field: form.identifier_field || "numero_uc",
        parser_version: form.parser_version,
        active: form.active,
        notes: form.notes || null,
      } as any);
      toast.success(isSystemDefault
        ? "Configuração personalizada criada (override da padrão do sistema)"
        : config ? "Configuração atualizada" : "Configuração criada"
      );
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
              {config && !config.tenant_id
                ? "Personalizar Configuração Padrão"
                : config ? "Editar Configuração" : prefill ? "Nova Configuração (pré-preenchida)" : "Nova Configuração de Extração"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config && !config.tenant_id
                ? "Esta é uma configuração padrão do sistema. Ao salvar, será criada uma cópia personalizada para sua empresa."
                : prefill
                  ? `Gerada a partir do teste de extração — ${prefill.concessionaria_nome}`
                  : "Configure a estratégia de extração nativa por concessionária"
              }
            </p>
          </div>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 shrink-0">
            <Button
              variant={viewMode === "visual" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setViewMode("visual")}
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Visual
            </Button>
            <Button
              variant={viewMode === "json" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setViewMode("json")}
            >
              <Code2 className="w-3.5 h-3.5 mr-1" />
              JSON
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {viewMode === "json" ? (
            /* ── JSON Advanced Mode ── */
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Edite o JSON diretamente. A estrutura reflete exatamente os campos salvos no banco.
                Clique em "Aplicar JSON" para sincronizar com o modo visual.
              </p>
              <Textarea
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setJsonError(null); }}
                rows={28}
                className="font-mono text-xs min-h-[400px]"
                spellCheck={false}
              />
              {jsonError && (
                <p className="text-xs text-destructive">❌ {jsonError}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(jsonText);
                  toast.success("JSON copiado");
                }}>
                  Copiar
                </Button>
                <Button size="sm" onClick={applyJsonToForm}>
                  Aplicar JSON ao formulário
                </Button>
              </div>
            </div>
          ) : (
            /* ── Visual Mode ── */
            <div className="space-y-4 p-5">
              {/* Prefill banner */}
              {prefill && !config && (
                <Card className="border-l-[3px] border-l-primary bg-primary/5">
                  <CardContent className="p-3 flex items-start gap-2">
                    <Cpu className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="text-xs text-foreground space-y-0.5">
                      <p className="font-medium">Configuração gerada a partir do teste de extração</p>
                      <p className="text-muted-foreground">
                        {prefill.fields_found.length} campos encontrados, {prefill.fields_missing.length} faltantes.
                        {prefill.tipo_uc_detectado && ` Tipo UC detectado: ${prefill.tipo_uc_detectado}.`}
                        {" "}Revise e ajuste antes de salvar.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Row 1: Concessionária + Estratégia + Fallback */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard icon={Settings2} title="Concessionária">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Nome</Label>
                        <ExtractionHelpHint text="Nome exibido na Central de Extração." />
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
                        <ExtractionHelpHint text="Código técnico usado pelo backend. Ex.: energisa, cemig, light." />
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
                        <ExtractionHelpHint text="Define qual campo da conta será comparado com a UC cadastrada." />
                      </div>
                      <Select value={form.identifier_field} onValueChange={v => setForm(f => ({ ...f, identifier_field: v }))}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {IDENTIFIER_FIELD_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard icon={Cpu} title="Estratégia de Extração">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Modo</Label>
                      <Select value={form.strategy_mode} onValueChange={(v) => setForm(f => ({ ...f, strategy_mode: v as ExtractionStrategyMode }))}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="native">Nativo</SelectItem>
                          <SelectItem value="provider">Nativo (assistido)</SelectItem>
                          <SelectItem value="auto">Automático</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Versão do Parser</Label>
                      <Input value={form.parser_version || ""} onChange={e => setForm(f => ({ ...f, parser_version: e.target.value }))} placeholder="3.0.2" className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <SwitchRow label="Parser Nativo" description="Usar parser determinístico interno" hint="Lê o PDF diretamente sem serviços externos." checked={form.native_enabled} onChange={v => setForm(f => ({ ...f, native_enabled: v }))} />
                    <SwitchRow label="Suporte Avançado" description="Habilitar cobertura adicional" hint="Segunda camada de extração para campos extras." checked={form.provider_enabled} onChange={v => setForm(f => ({ ...f, provider_enabled: v }))} />
                  </div>
                </SectionCard>

                <SectionCard icon={RefreshCw} title="Recuperação e Opções">
                  <div className="space-y-2">
                    <SwitchRow label="Recuperação Automática" description="Tentar rota alternativa se falhar" checked={form.fallback_enabled} onChange={v => setForm(f => ({ ...f, fallback_enabled: v }))} />
                    <SwitchRow label="Requer Conversão Backend" description="Converter arquivo antes da extração" hint="Para PDFs escaneados que precisam de conversão." checked={form.provider_requires_base64} onChange={v => setForm(f => ({ ...f, provider_requires_base64: v }))} />
                    <SwitchRow label="PDF Protegido" description="Conta exige senha para abertura" hint="Geralmente CPF/CNPJ do titular." checked={form.provider_requires_password} onChange={v => setForm(f => ({ ...f, provider_requires_password: v }))} />
                    <SwitchRow label="Ativo" description="Habilitar esta configuração" checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
                  </div>
                </SectionCard>
              </div>

              {/* Row 2: Fields selector with context tabs */}
              <SectionCard icon={FileText} title="Campos de Extração">
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure quais campos são obrigatórios dependendo do tipo de UC.
                    Campos com <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20 px-1 py-0 mx-0.5 inline">Geradora</Badge> são
                    exclusivos de unidades que injetam energia.
                  </p>
                </div>

                <Tabs defaultValue="geral" className="w-full">
                  <TabsList className="w-full grid grid-cols-5">
                    <TabsTrigger value="geral">Base</TabsTrigger>
                    <TabsTrigger value="geradora">☀️ Geradora</TabsTrigger>
                    <TabsTrigger value="beneficiaria">🏠 Beneficiária</TabsTrigger>
                    <TabsTrigger value="mista">🔄 Mista</TabsTrigger>
                    <TabsTrigger value="consumo">⚡ Consumo</TabsTrigger>
                  </TabsList>

                  <TabsContent value="geral" className="mt-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Campos base usados quando o tipo de UC não é conhecido.
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
                      Campos obrigatórios para UCs geradoras. Inclui injeção, saldo e medidor 103.
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-2">
                      {form.required_fields_geradora.length} obrigatórios
                    </Badge>
                    {FIELD_CATEGORIES.map(cat => (
                      <FieldCategorySection
                        key={`ger-${cat.category}`}
                        category={cat}
                        requiredFields={form.required_fields_geradora}
                        optionalFields={[]}
                        onToggleRequired={(key) => {
                          setForm(f => ({
                            ...f,
                            required_fields_geradora: f.required_fields_geradora.includes(key)
                              ? f.required_fields_geradora.filter(k => k !== key)
                              : [...f.required_fields_geradora, key],
                          }));
                        }}
                        onToggleOptional={() => {}}
                      />
                    ))}
                  </TabsContent>

                  <TabsContent value="beneficiaria" className="mt-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Campos para UCs beneficiárias. Campos de injeção não se aplicam.
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-2">
                      {form.required_fields_beneficiaria.length} obrigatórios
                    </Badge>
                    {FIELD_CATEGORIES.filter(cat => cat.fields.some(f => !f.geradoraOnly)).map(cat => {
                      const filteredCat = { ...cat, fields: cat.fields.filter(f => !f.geradoraOnly) };
                      return (
                        <FieldCategorySection
                          key={`ben-${cat.category}`}
                          category={filteredCat}
                          requiredFields={form.required_fields_beneficiaria}
                          optionalFields={[]}
                          onToggleRequired={(key) => {
                            setForm(f => ({
                              ...f,
                              required_fields_beneficiaria: f.required_fields_beneficiaria.includes(key)
                                ? f.required_fields_beneficiaria.filter(k => k !== key)
                                : [...f.required_fields_beneficiaria, key],
                            }));
                          }}
                          onToggleOptional={() => {}}
                        />
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="mista" className="mt-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Campos para UCs mistas (geram e recebem créditos simultaneamente).
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-2">
                      {form.required_fields_mista.length} obrigatórios
                    </Badge>
                    {FIELD_CATEGORIES.map(cat => (
                      <FieldCategorySection
                        key={`mix-${cat.category}`}
                        category={cat}
                        requiredFields={form.required_fields_mista}
                        optionalFields={[]}
                        onToggleRequired={(key) => {
                          setForm(f => ({
                            ...f,
                            required_fields_mista: f.required_fields_mista.includes(key)
                              ? f.required_fields_mista.filter(k => k !== key)
                              : [...f.required_fields_mista, key],
                          }));
                        }}
                        onToggleOptional={() => {}}
                      />
                    ))}
                  </TabsContent>

                  <TabsContent value="consumo" className="mt-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Campos para UCs de consumo puro (sem geração distribuída).
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-2">
                      {form.required_fields_consumo.length} obrigatórios
                    </Badge>
                    {FIELD_CATEGORIES.filter(cat => cat.fields.some(f => !f.geradoraOnly)).map(cat => {
                      const filteredCat = { ...cat, fields: cat.fields.filter(f => !f.geradoraOnly) };
                      return (
                        <FieldCategorySection
                          key={`con-${cat.category}`}
                          category={filteredCat}
                          requiredFields={form.required_fields_consumo}
                          optionalFields={[]}
                          onToggleRequired={(key) => {
                            setForm(f => ({
                              ...f,
                              required_fields_consumo: f.required_fields_consumo.includes(key)
                                ? f.required_fields_consumo.filter(k => k !== key)
                                : [...f.required_fields_consumo, key],
                            }));
                          }}
                          onToggleOptional={() => {}}
                        />
                      );
                    })}
                  </TabsContent>
                </Tabs>

                {/* Custom field creator */}
                <div className="rounded-lg border border-dashed border-border p-3 mt-3">
                  <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    Adicionar campo personalizado
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={customFieldInput}
                      onChange={e => setCustomFieldInput(e.target.value)}
                      placeholder="Ex.: taxa_iluminacao, multa_atraso..."
                      className="h-8 text-xs flex-1"
                      onKeyDown={e => {
                        if (e.key === "Enter" && customFieldInput.trim()) {
                          e.preventDefault();
                          addCustomField();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={!customFieldInput.trim()} onClick={addCustomField}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {form.custom_fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.custom_fields.map(cf => (
                        <Badge key={cf.key} variant="outline" className="text-xs gap-1 bg-primary/5">
                          {cf.label}
                          <button
                            type="button"
                            onClick={() => setForm(f => ({
                              ...f,
                              custom_fields: f.custom_fields.filter(c => c.key !== cf.key),
                              optional_fields: f.optional_fields.filter(k => k !== cf.key),
                              required_fields: f.required_fields.filter(k => k !== cf.key),
                            }))}
                            className="ml-0.5 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* JSONB Fields Advanced Editor */}
              <SectionCard icon={Code2} title="JSON Avançado — Campos JSONB">
                <p className="text-xs text-muted-foreground mb-3">
                  Edite campos JSONB individualmente. Cada campo aceita um array JSON válido.
                </p>
                <div className="space-y-4">
                  {JSONB_FIELD_DEFS.map((def) => (
                    <JsonbFieldEditor
                      key={def.key}
                      label={def.label}
                      value={(form as any)[def.key] ?? []}
                      onChange={(parsed) => {
                        setForm(f => ({ ...f, [def.key]: parsed }));
                        setJsonbErrors(prev => {
                          const next = new Set(prev);
                          next.delete(def.key);
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              </SectionCard>

              {/* Notes */}
              <SectionCard icon={Settings2} title="Observações">
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas sobre esta configuração..."
                  rows={3}
                  className="min-h-[80px]"
                />
              </SectionCard>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveConfig.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || !form.concessionaria_code || saveConfig.isPending}>
            {saveConfig.isPending && <Spinner size="sm" className="mr-2" />}
            {config ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  function addCustomField() {
    const key = customFieldInput.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!key) return;
    if (ALL_FIELD_KEYS.includes(key) || form.custom_fields.some(f => f.key === key)) {
      toast.error("Este campo já existe");
      return;
    }
    const label = customFieldInput.trim();
    setForm(f => ({
      ...f,
      custom_fields: [...f.custom_fields, { key, label }],
      optional_fields: [...f.optional_fields, key],
    }));
    setCustomFieldInput("");
  }
}
