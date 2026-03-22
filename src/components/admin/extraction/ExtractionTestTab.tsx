/**
 * ExtractionTestTab — Test extraction directly from the Central de Extração.
 * Accepts PDF/images, calls parse-conta-energia, shows detailed results.
 */
import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Info, Download, Settings2, Cpu } from "lucide-react";
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
}

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";

const STATUS_MAP: Record<string, { icon: typeof CheckCircle2; label: string; color: string }> = {
  success: { icon: CheckCircle2, label: "Sucesso", color: "text-success" },
  partial: { icon: AlertTriangle, label: "Parcial", color: "text-warning" },
  failed: { icon: XCircle, label: "Falha", color: "text-destructive" },
  needs_ocr: { icon: Info, label: "Precisa OCR", color: "text-info" },
};

export function ExtractionTestTab() {
  const { data: configs = [] } = useExtractionConfigs();
  const [selectedConc, setSelectedConc] = useState<string>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
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

      // Upload to temp storage
      const storagePath = await uploadInvoiceTempPdf(file);

      // Call process-fatura-pdf in TEST MODE — parses without requiring UC
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

        // Check validations from parser
        if (parsed?.validations) {
          for (const v of parsed.validations) {
            if (!v.passed) warnings.push(v.detail);
          }
        }

        // Add GD consistency warnings/errors
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
        // Fallback: old response format (non-test-mode)
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
      {/* Explanation */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Como funciona o teste</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Envie um PDF de conta de energia para simular a leitura antes de processar no fluxo operacional.
                O sistema detecta automaticamente a concessionária, aplica o parser nativo e mostra todos os campos extraídos,
                faltantes e alertas de consistência.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Concessionária (opcional)</Label>
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
              <Label className="text-xs">Arquivo (PDF, PNG, JPG, WEBP)</Label>
              <div
                className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground truncate">
                  {file ? file.name : "Selecionar arquivo..."}
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
          {isProcessing ? "Analisando..." : "Testar Extração"}
        </Button>
      </div>

      {/* Results */}
      {isProcessing && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
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
                <Badge variant="outline" className="text-xs">
                  {result.file_type.toUpperCase()} · {result.is_textual ? "Textual" : "Imagem"}
                </Badge>
              </div>
            </CardContent>
          </Card>

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

          {/* Validations */}
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
