import { useState, useEffect, useMemo } from "react";
import { FileText, Sun, Zap, Plus, Loader2, Globe, FileDown, User, Building2, BoltIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "./types";

interface PropostaTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  thumbnail_url: string | null;
}

interface CustomField {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  options: any;
  required_on_proposal: boolean | null;
  ordem: number | null;
}

interface StepDocumentoProps {
  clienteNome: string;
  empresaNome?: string;
  potenciaKwp: number;
  numUcs: number;
  precoFinal: number;
  templateSelecionado: string;
  onTemplateSelecionado: (id: string) => void;
  generating: boolean;
  rendering: boolean;
  result: any;
  htmlPreview: string | null;
  onGenerate: () => void;
  onNewVersion: () => void;
  onViewDetail: () => void;
  // Custom field values from wizard state
  customFieldValues?: Record<string, any>;
  onCustomFieldValuesChange?: (values: Record<string, any>) => void;
}

export function StepDocumento({
  clienteNome, empresaNome, potenciaKwp, numUcs, precoFinal,
  templateSelecionado, onTemplateSelecionado,
  generating, rendering, result, htmlPreview,
  onGenerate, onNewVersion, onViewDetail,
  customFieldValues = {}, onCustomFieldValuesChange,
}: StepDocumentoProps) {
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState<"html" | "docx">("html");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Custom fields (pos_dimensionamento)
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingCustomFields, setLoadingCustomFields] = useState(true);

  // Modal form state
  const [nomeProposta, setNomeProposta] = useState("");
  const [descricaoProposta, setDescricaoProposta] = useState("");
  const [modalCustomValues, setModalCustomValues] = useState<Record<string, any>>({});

  const filteredTemplates = templates.filter(t => t.tipo === tipoFiltro);

  // Load templates
  useEffect(() => {
    setLoadingTemplates(true);
    supabase
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, thumbnail_url")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        const tpls = (data || []) as PropostaTemplate[];
        setTemplates(tpls);
        const matching = tpls.filter(t => t.tipo === tipoFiltro);
        if (matching.length > 0 && !templateSelecionado) {
          onTemplateSelecionado(matching[0].id);
        }
        setLoadingTemplates(false);
      });
  }, []);

  // Load custom fields (pos_dimensionamento)
  useEffect(() => {
    setLoadingCustomFields(true);
    supabase
      .from("deal_custom_fields")
      .select("id, title, field_key, field_type, options, required_on_proposal, ordem")
      .eq("is_active", true)
      .eq("field_context", "pos_dimensionamento")
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        setCustomFields((data || []) as CustomField[]);
        setLoadingCustomFields(false);
      });
  }, []);

  const handleOpenCreateModal = () => {
    setNomeProposta("");
    setDescricaoProposta("");
    setModalCustomValues({ ...customFieldValues });
    setShowCreateModal(true);
  };

  const handleSave = (asActive: boolean) => {
    // Propagate custom field values back
    onCustomFieldValuesChange?.({ ...modalCustomValues });
    setShowCreateModal(false);
    // Trigger generation
    onGenerate();
  };

  if (!result) {
    return (
      <div className="space-y-6">
        <h3 className="text-base font-bold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Gerar Proposta
        </h3>

        {/* Tipo Toggle */}
        <div className="space-y-3">
          <Label>Tipo de Modelo</Label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTipoFiltro("html");
                const match = templates.find(t => t.tipo === "html");
                if (match) onTemplateSelecionado(match.id);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                tipoFiltro === "html"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border/70"
              )}
            >
              <Globe className="h-4 w-4" />
              WEB
              <Badge variant="secondary" className="text-[9px] ml-1">
                {templates.filter(t => t.tipo === "html").length}
              </Badge>
            </button>
            <button
              onClick={() => {
                setTipoFiltro("docx");
                const match = templates.find(t => t.tipo === "docx");
                if (match) onTemplateSelecionado(match.id);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                tipoFiltro === "docx"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border/70"
              )}
            >
              <FileDown className="h-4 w-4" />
              DOCX
              <Badge variant="secondary" className="text-[9px] ml-1">
                {templates.filter(t => t.tipo === "docx").length}
              </Badge>
            </button>
          </div>
        </div>

        {/* Template Selection */}
        <div className="space-y-2">
          <Label>Template</Label>
          {loadingTemplates ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => onTemplateSelecionado(t.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    templateSelecionado === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border/70"
                  )}
                >
                  {t.thumbnail_url ? (
                    <img src={t.thumbnail_url} alt={t.nome} className="h-10 w-10 mx-auto mb-2 rounded object-cover" />
                  ) : (
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium">{t.nome}</p>
                  {t.descricao && <p className="text-[10px] text-muted-foreground mt-0.5">{t.descricao}</p>}
                  <Badge variant="outline" className="text-[9px] mt-1">{t.grupo}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto opacity-20 mb-2" />
              <p className="text-sm">Nenhum template {tipoFiltro.toUpperCase()} cadastrado</p>
              <p className="text-xs mt-1">Cadastre em Proposta Comercial → Modelos de Proposta</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cliente</p>
            <p className="text-sm font-semibold truncate">{clienteNome}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Potência</p>
            <p className="text-sm font-semibold">{potenciaKwp} kWp</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">UCs</p>
            <p className="text-sm font-semibold">{numUcs}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</p>
            <p className="text-sm font-semibold">{formatBRL(precoFinal)}</p>
          </div>
        </div>

        {/* Generate Button → Opens Modal */}
        <div className="text-center">
          <Button size="lg" className="gap-2 min-w-[200px]" onClick={handleOpenCreateModal} disabled={generating}>
            {generating ? <Sun className="h-5 w-5 animate-spin" style={{ animationDuration: "2s" }} /> : <Zap className="h-5 w-5" />}
            {generating ? "Gerando..." : "Criar Proposta"}
          </Button>
        </div>

        {generating && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Gerando proposta comercial...</p>
          </div>
        )}

        {/* ═══ Modal: Criar Proposta ═══ */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Criar Proposta</DialogTitle>
            </DialogHeader>

            {/* Resume header */}
            <div className="space-y-1 text-sm pb-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{clienteNome || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Empresa:</span>
                <span className="font-medium">{empresaNome || clienteNome || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <BoltIcon className="h-3.5 w-3.5 text-warning" />
                <span className="text-muted-foreground">Potência:</span>
                <span className="font-medium">{potenciaKwp} kWp</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <span className="text-muted-foreground">Preço:</span>
                <span className="font-medium">{formatBRL(precoFinal)}</span>
              </div>
            </div>

            {/* Base fields */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-destructive">Nome da Proposta *</Label>
                <Input
                  value={nomeProposta}
                  onChange={e => setNomeProposta(e.target.value)}
                  placeholder=""
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição (Opcional)</Label>
                <Textarea
                  value={descricaoProposta}
                  onChange={e => setDescricaoProposta(e.target.value)}
                  className="text-sm min-h-[80px] resize-y"
                />
              </div>
            </div>

            {/* Custom Fields (pos_dimensionamento) */}
            {customFields.length > 0 && (
              <div className="space-y-4 pt-3 border-t border-border/30">
                <h4 className="text-sm font-bold">Campos Customizados</h4>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {customFields.map(field => (
                    <CustomFieldInput
                      key={field.id}
                      field={field}
                      value={modalCustomValues[field.field_key]}
                      onChange={val => setModalCustomValues(prev => ({ ...prev, [field.field_key]: val }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {loadingCustomFields && (
              <div className="py-4 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/30">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="text-sm">
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={!nomeProposta.trim()}
                className="text-sm"
              >
                Salvar
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={!nomeProposta.trim()}
                className="text-sm"
              >
                Salvar como ativa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Result view
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 text-center">
          <p className="text-xs text-muted-foreground">Investimento</p>
          <p className="text-lg font-bold text-primary">{formatBRL(result.valor_total)}</p>
        </div>
        <div className="p-4 rounded-xl bg-success/5 border border-success/15 text-center">
          <p className="text-xs text-muted-foreground">Economia/mês</p>
          <p className="text-lg font-bold text-success">{formatBRL(result.economia_mensal)}</p>
        </div>
        <div className="p-4 rounded-xl bg-info/5 border border-info/15 text-center">
          <p className="text-xs text-muted-foreground">Payback</p>
          <p className="text-lg font-bold text-info">{result.payback_meses} meses</p>
        </div>
      </div>

      {rendering ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Renderizando proposta...</p>
        </div>
      ) : htmlPreview ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ maxHeight: 600, overflow: "auto" }}>
            <iframe srcDoc={htmlPreview} title="Proposta Preview" className="w-full border-0" style={{ height: 800, pointerEvents: "none" }} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Button onClick={onViewDetail} className="gap-2">Ver Detalhes</Button>
        <Button variant="outline" onClick={onNewVersion} className="gap-2"><Plus className="h-4 w-4" /> Nova Versão</Button>
        <Button variant="ghost" onClick={onNewVersion}>Voltar e Editar</Button>
      </div>
    </div>
  );
}

// ─── Custom Field Input Component ────────────────────────────

function CustomFieldInput({ field, value, onChange }: {
  field: { title: string; field_key: string; field_type: string; options: any; required_on_proposal: boolean | null };
  value: any;
  onChange: (val: any) => void;
}) {
  const isRequired = field.required_on_proposal;
  const labelColor = isRequired ? "text-destructive" : "text-muted-foreground";

  // Parse options for select fields
  const selectOptions = useMemo(() => {
    if (field.field_type !== "select" || !field.options) return [];
    if (Array.isArray(field.options)) return field.options as string[];
    if (typeof field.options === "object" && (field.options as any).choices) return (field.options as any).choices as string[];
    return [];
  }, [field.options, field.field_type]);

  if (field.field_type === "select") {
    return (
      <div className="space-y-1">
        <Label className={cn("text-xs", labelColor)}>
          {field.title}{isRequired ? " *" : ""}
        </Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Selecione uma opção" />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.map((opt: string) => (
              <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <div className="space-y-1">
        <Label className={cn("text-xs", labelColor)}>
          {field.title}{isRequired ? " *" : ""}
        </Label>
        <Textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="text-sm min-h-[60px] resize-y"
        />
      </div>
    );
  }

  if (field.field_type === "number" || field.field_type === "currency") {
    return (
      <div className="space-y-1">
        <Label className={cn("text-xs", labelColor)}>
          {field.title}{isRequired ? " *" : ""}
        </Label>
        <Input
          type="number"
          value={value ?? ""}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : "")}
          placeholder={field.field_type === "currency" ? "R$ 0,00" : "Texto"}
          className="h-9 text-sm"
        />
      </div>
    );
  }

  // Default: text
  return (
    <div className="space-y-1">
      <Label className={cn("text-xs", labelColor)}>
        {field.title}{isRequired ? " *" : ""}
      </Label>
      <Input
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder="Texto"
        className="h-9 text-sm"
      />
    </div>
  );
}
