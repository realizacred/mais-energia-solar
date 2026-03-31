/**
 * ExtractionTestTab — Test extraction directly from the Central de Extração.
 * Accepts PDF/images, calls parse-conta-energia, shows detailed results.
 */
import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Info, Download, Settings2, Cpu, Sparkles, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui-kit/Spinner";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { uploadInvoiceTempPdf } from "@/services/invoiceUploadService";
import { useExtractionConfigs, type ExtractionConfig } from "@/hooks/useExtractionConfigs";
import { ExtractionHelpHint } from "./ExtractionHelpHint";
import type { ExtractionConfigPrefill } from "./ExtractionConfigModal";

interface UcDetectionResult {
  tipo_uc_detectado: "consumo" | "geradora" | "beneficiaria" | "mista" | "indefinida";
  confianca_tipo_uc: number;
  regras_disparadas: string[];
  sinais_detectados: Record<string, boolean>;
  divergencia_cadastro: boolean;
}

interface TestResult {
  concessionaria_detected: string | null;
  file_type: string;
  is_textual: boolean;
  strategy_used: string;
  parser_used: string;
  parser_version: string;
  status: "success" | "partial" | "failed" | "needs_ocr";
  confidence: number;
  fields_found: string[];
  fields_missing: string[];
  warnings: string[];
  errors: string[];
  raw_extraction: Record<string, any>;
  field_results: Record<string, any>;
  validations: Array<{ rule: string; passed: boolean; detail: string }>;
  ownership_validation?: { status: "valid" | "mismatch" | "unknown"; score: number };
  identifier_extracted?: string | null;
  identifier_expected?: string | null;
  uc_detection?: UcDetectionResult | null;
  contexto?: string | null;
}

const ACCEPTED_TYPES = ".pdf";

const STATUS_MAP: Record<string, { icon: typeof CheckCircle2; label: string; color: string }> = {
  success: { icon: CheckCircle2, label: "Sucesso", color: "text-success" },
  partial: { icon: AlertTriangle, label: "Parcial", color: "text-warning" },
  failed: { icon: XCircle, label: "Falha", color: "text-destructive" },
  needs_ocr: { icon: Info, label: "Precisa OCR", color: "text-info" },
};

interface ExtractionTestTabProps {
  onGenerateConfig?: (prefill: ExtractionConfigPrefill) => void;
}

export function ExtractionTestTab({ onGenerateConfig }: ExtractionTestTabProps = {}) {
  const { data: configs = [] } = useExtractionConfigs();
  const [selectedConc, setSelectedConc] = useState<string>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (IMAGE_EXTENSIONS.includes(ext)) {
        toast.error("Imagens não são suportadas para extração. Envie um arquivo PDF.");
        e.target.value = "";
        return;
      }
      setFile(f);
      setResult(null);
    }
  };

  const handleTest = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResult(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isPdf = ext === "pdf";

      if (!isPdf) {
        setResult({
          concessionaria_detected: null,
          file_type: ext,
          is_textual: false,
          strategy_used: "none",
          parser_used: "none",
          parser_version: "",
          status: "needs_ocr",
          confidence: 0,
          fields_found: [],
          fields_missing: ["consumo_kwh", "valor_total"],
          warnings: ["Imagens requerem OCR para extração. Atualmente, apenas PDFs textuais são suportados pelo parser nativo."],
          errors: [],
          raw_extraction: {},
          field_results: {},
          validations: [],
        });
        return;
      }

      const storagePath = await uploadInvoiceTempPdf(file);

      const data = await invokeEdgeFunction<any>("process-fatura-pdf", {
        body: {
          pdf_storage_path: storagePath,
          source: "import",
          test_mode: true,
        },
        headers: { "x-client-timeout": "120" },
      });

      if (data?.test_mode && data?.data) {
        const parsed = data.data.parsed;
        const testData = data.data;

        const warnings: string[] = [];
        const errors: string[] = [];

        if (parsed?.validations) {
          for (const v of parsed.validations) {
            if (!v.passed) warnings.push(v.detail);
          }
        }

        if (testData.gd_consistency?.checks) {
          for (const c of testData.gd_consistency.checks) {
            if (c.level === "warning") warnings.push(`GD: ${c.message}`);
            if (c.level === "error") errors.push(`GD: ${c.message}`);
          }
        }

        setResult({
          concessionaria_detected: testData.concessionaria_detected || parsed?.concessionaria_nome || null,
          file_type: "pdf",
          is_textual: true,
          strategy_used: testData.config_used?.strategy || "native",
          parser_used: parsed?.parser_used || "generic",
          parser_version: parsed?.parser_version || "?",
          status: testData.extraction_status || "failed",
          confidence: parsed?.confidence || 0,
          fields_found: testData.fields_found || [],
          fields_missing: testData.fields_missing || [],
          warnings,
          errors,
          raw_extraction: parsed || {},
          field_results: parsed?.field_results || {},
          validations: parsed?.validations || [],
          uc_detection: testData.uc_detection || null,
          contexto: testData.contexto || null,
        });
      } else if (data?.success === false && data?.test_mode) {
        setResult({
          concessionaria_detected: data.concessionaria_detected || null,
          file_type: "pdf",
          is_textual: true,
          strategy_used: data.config_used?.strategy || "native",
          parser_used: "unknown",
          parser_version: "",
          status: "failed",
          confidence: 0,
          fields_found: [],
          fields_missing: [],
          warnings: [],
          errors: [data.error || "Falha ao parsear fatura"],
          raw_extraction: {},
          field_results: {},
          validations: [],
        });
      } else {
        const parsed = data?.data?.parsed;
        if (parsed) {
          const config = selectedConc !== "auto"
            ? configs.find(c => c.concessionaria_code === selectedConc)
            : null;
          const requiredFields = config?.required_fields || ["consumo_kwh", "valor_total"];
          const found = requiredFields.filter((f: string) => parsed[f] != null);
          const missing = requiredFields.filter((f: string) => parsed[f] == null);
          const status: TestResult["status"] = missing.length === 0 ? "success" : missing.length <= 2 ? "partial" : "failed";
          setResult({
            concessionaria_detected: parsed.concessionaria_nome || parsed.parser_used || null,
            file_type: "pdf",
            is_textual: true,
            strategy_used: "native",
            parser_used: parsed.parser_used || "generic",
            parser_version: parsed.parser_version || "?",
            status,
            confidence: parsed.confidence || 0,
            fields_found: found,
            fields_missing: missing,
            warnings: [],
            errors: [],
            raw_extraction: parsed,
            field_results: parsed.field_results || {},
            validations: parsed.validations || [],
          });
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || "Erro desconhecido";
      setResult({
        concessionaria_detected: null,
        file_type: file.name.split(".").pop() || "pdf",
        is_textual: true,
        strategy_used: "native",
        parser_used: "unknown",
        parser_version: "",
        status: "failed",
        confidence: 0,
        fields_found: [],
        fields_missing: [],
        warnings: [],
        errors: [errMsg],
        raw_extraction: {},
        field_results: {},
        validations: [],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const statusInfo = result ? STATUS_MAP[result.status] : null;

  return (
    <div className="space-y-6">
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Importe uma conta real para o sistema analisar</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta é a área de importação da Central de Extração. Envie um PDF real, veja o que foi encontrado,
                entenda o que faltou e use o resultado para ajustar a configuração e o aprendizado de layouts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Concessionária (opcional)</Label>
                    <ExtractionHelpHint text="Deixe em detecção automática na maioria dos casos. Se você já souber a concessionária, selecione aqui para comparar com a configuração existente." />
                  </div>
                  <Select value={selectedConc} onValueChange={setSelectedConc}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Detectar automaticamente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Detectar automaticamente</SelectItem>
                      {configs.map(c => (
                        <SelectItem key={c.id} value={c.concessionaria_code}>
                          {c.concessionaria_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Arquivo da conta</Label>
                    <ExtractionHelpHint text="Envie preferencialmente o PDF original da concessionária. O sistema usa este arquivo para extrair texto, testar parser e identificar campos faltantes." />
                  </div>
                  <div
                    className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground truncate">
                      {file ? file.name : "Selecionar conta de luz..."}
                    </span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleTest} disabled={!file || isProcessing} className="h-10">
              {isProcessing && <Spinner size="sm" className="mr-2" />}
              {isProcessing ? "Analisando..." : "Importar e Analisar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isProcessing && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      )}

      {!isProcessing && !result && (
        <EmptyState
          icon={FileText}
          title="Nenhum teste realizado"
          description="Selecione um arquivo de conta de energia e clique em 'Testar Extração' para simular o processamento."
          className="min-h-[300px]"
        />
      )}

      {!isProcessing && result && (
        <div className="space-y-4">
          {/* Status header */}
          <Card className={`border-l-[3px] ${result.status === "success" ? "border-l-success" : result.status === "partial" ? "border-l-warning" : "border-l-destructive"}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusInfo && <statusInfo.icon className={`w-6 h-6 ${statusInfo.color}`} />}
                  <div>
                    <p className="text-lg font-semibold text-foreground">{statusInfo?.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.concessionaria_detected
                        ? `Concessionária: ${result.concessionaria_detected}`
                        : "Concessionária não detectada"}
                      {" · "}Parser: {result.parser_used} v{result.parser_version}
                      {" · "}Confiança: {result.confidence}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {result.file_type.toUpperCase()} · {result.is_textual ? "Textual" : "Imagem"}
                  </Badge>
                  {onGenerateConfig && result.concessionaria_detected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        onGenerateConfig({
                          concessionaria_code: (result.concessionaria_detected || "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
                          concessionaria_nome: result.concessionaria_detected || "",
                          fields_found: result.fields_found,
                          fields_missing: result.fields_missing,
                          parser_version: result.parser_version,
                          tipo_uc_detectado: result.uc_detection?.tipo_uc_detectado,
                        });
                      }}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                      Gerar Configuração
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* UC Type Detection */}
          {result.uc_detection && (
            <Card className={`border-l-[3px] ${result.uc_detection.divergencia_cadastro ? "border-l-warning" : "border-l-primary"}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Tipo de UC Detectado</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {result.uc_detection.tipo_uc_detectado === "geradora" ? "Geradora" :
                       result.uc_detection.tipo_uc_detectado === "beneficiaria" ? "Beneficiária" :
                       result.uc_detection.tipo_uc_detectado === "mista" ? "Mista" :
                       result.uc_detection.tipo_uc_detectado === "consumo" ? "Consumo" : "Indefinida"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Confiança: {result.uc_detection.confianca_tipo_uc}%
                    </Badge>
                  </div>
                </div>

                {/* Signals */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(result.uc_detection.sinais_detectados).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      {val ? (
                        <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={val ? "text-foreground" : "text-muted-foreground"}>
                        {key.replace(/^tem_/, "").replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rules fired */}
                {result.uc_detection.regras_disparadas.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Regras aplicadas</p>
                    {result.uc_detection.regras_disparadas.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{r}</p>
                    ))}
                  </div>
                )}

                {result.uc_detection.divergencia_cadastro && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/20">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground">
                      A detecção automática diverge do cadastro atual da UC. Recomenda-se revisar o tipo cadastrado.
                    </p>
                  </div>
                )}

                {result.contexto && (
                  <p className="text-[10px] text-muted-foreground">Contexto utilizado: {result.contexto}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fields found / missing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <p className="text-sm font-semibold text-foreground">Campos encontrados ({result.fields_found.length})</p>
                </div>
                {result.fields_found.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.fields_found.map(f => (
                      <Badge key={f} variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                        {f}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum campo obrigatório encontrado</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm font-semibold text-foreground">Campos faltantes ({result.fields_missing.length})</p>
                </div>
                {result.fields_missing.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.fields_missing.map(f => (
                      <Badge key={f} variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                        {f}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Todos os campos obrigatórios foram encontrados</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Warnings / Errors */}
          {(result.warnings.length > 0 || result.errors.length > 0) && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Alertas e Erros</p>
                <div className="space-y-2">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                      <span className="text-foreground">{e}</span>
                    </div>
                  ))}
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                      <span className="text-foreground">{w}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ownership Validation */}
          {result.ownership_validation && (
            <Card className={`border-l-[3px] ${result.ownership_validation.status === "valid" ? "border-l-success" : result.ownership_validation.status === "mismatch" ? "border-l-destructive" : "border-l-warning"}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {result.ownership_validation.status === "valid" ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : result.ownership_validation.status === "mismatch" ? (
                    <XCircle className="w-4 h-4 text-destructive" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-warning" />
                  )}
                  <p className="text-sm font-semibold text-foreground">
                    Validação de Titularidade: {result.ownership_validation.status === "valid" ? "Confirmada" : result.ownership_validation.status === "mismatch" ? "Divergente" : "Indeterminada"}
                  </p>
                  <Badge variant="outline" className="text-xs ml-auto">
                    Score: {result.ownership_validation.score}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Identificador extraído</p>
                    <p className="font-mono font-medium text-foreground">{result.identifier_extracted || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Identificador da UC</p>
                    <p className="font-mono font-medium text-foreground">{result.identifier_expected || "—"}</p>
                  </div>
                </div>
                {result.ownership_validation.status === "mismatch" && (
                  <p className="text-xs text-destructive font-medium">
                    ⚠️ A fatura não será vinculada automaticamente. Revisão manual necessária.
                  </p>
                )}
              </CardContent>
            </Card>
          )}


          {result.validations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Validações Cruzadas</p>
                <div className="space-y-1.5">
                  {result.validations.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {v.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                      )}
                      <span className="text-muted-foreground">{v.rule}:</span>
                      <span className="text-foreground">{v.detail}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted data summary */}
          {Object.keys(result.raw_extraction).length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Dados Extraídos</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(result.raw_extraction, null, 2));
                      toast.success("JSON copiado");
                    }}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Copiar JSON
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(result.raw_extraction)
                    .filter(([k]) => !["field_results", "validations", "raw_fields", "ai_fallback_used", "ai_model_used", "extraction_method"].includes(k))
                    .map(([key, value]) => (
                      <div key={key} className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{key}</p>
                        <p className="text-xs font-medium text-foreground truncate">
                          {value == null ? "—" : typeof value === "object" ? JSON.stringify(value).slice(0, 40) : String(value)}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
