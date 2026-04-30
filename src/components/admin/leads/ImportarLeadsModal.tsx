/**
 * ImportarLeadsModal — Importação em massa de leads via CSV/XLSX.
 * §25: FormModalTemplate pattern. RB-03: Button shadcn. RB-07: w-[90vw].
 */
import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { useLeadOrigensAtivas } from "@/hooks/useLeadOrigens";
import { formatPhone } from "@/lib/validations";
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ──────────────────────────────────────────────────

interface ImportarLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "upload" | "mapping" | "validation" | "result";

interface ParsedRow {
  [key: string]: string;
}

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

const SYSTEM_FIELDS: FieldDef[] = [
  { key: "nome", label: "Nome", required: true },
  { key: "telefone", label: "Telefone", required: true },
  { key: "email", label: "E-mail", required: false },
  { key: "cidade", label: "Cidade", required: false },
  { key: "estado", label: "Estado", required: false },
  { key: "media_consumo", label: "Consumo Médio (kWh)", required: false },
  { key: "origem", label: "Origem", required: false },
  { key: "consultor", label: "Consultor", required: false },
  { key: "observacoes", label: "Observações", required: false },
];

const COLUMN_ALIASES: Record<string, string[]> = {
  nome: ["nome", "name", "nome completo", "cliente", "razao social", "razão social"],
  telefone: ["telefone", "phone", "celular", "tel", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail", "e_mail", "mail"],
  cidade: ["cidade", "city", "municipio", "município"],
  estado: ["estado", "state", "uf"],
  media_consumo: ["consumo", "consumo medio", "consumo médio", "kwh", "media_consumo", "consumo_medio"],
  origem: ["origem", "source", "canal", "indicação", "indicacao"],
  consultor: ["consultor", "vendedor", "representante", "responsavel", "responsável"],
  observacoes: ["observacoes", "observações", "obs", "notas", "notes", "comentario", "comentários"],
};

const MAX_ROWS = 5000;

// ─── Helpers ────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const norm = normalizeStr(header);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        if (!Object.values(mapping).includes(field)) {
          mapping[header] = field;
          break;
        }
      }
    }
  }
  return mapping;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  
  // Simple CSV parser that handles quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === "," || ch === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

function isValidPhone(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidatedRow {
  data: Record<string, string>;
  errors: string[];
  isDuplicate: boolean;
}

// ─── Model CSV download ─────────────────────────────────────

function downloadModelCSV() {
  const headers = SYSTEM_FIELDS.map((f) => f.label);
  const example = ["João Silva", "(32) 99843-7675", "joao@email.com", "Juiz de Fora", "MG", "500", "Indicação", "", ""];
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ──────────────────────────────────────────────

export function ImportarLeadsModal({ open, onOpenChange, onSuccess }: ImportarLeadsModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: consultores = [] } = useConsultoresAtivos();
  const { data: origens = [] } = useLeadOrigensAtivas();

  const reset = useCallback(() => {
    setStep("upload");
    setRawRows([]);
    setHeaders([]);
    setMapping({});
    setValidatedRows([]);
    setImporting(false);
    setResult(null);
  }, []);

  const handleClose = useCallback((v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  }, [onOpenChange, reset]);

  // ── Step 1: File upload ──

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      toast.error("Formato não suportado. Use CSV ou XLSX.");
      return;
    }

    const reader = new FileReader();

    if (ext === "csv") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error("Arquivo vazio ou formato inválido.");
          return;
        }
        if (rows.length > MAX_ROWS) {
          toast.error(`Limite de ${MAX_ROWS.toLocaleString()} linhas. O arquivo tem ${rows.length.toLocaleString()}.`);
          return;
        }
        const hdrs = Object.keys(rows[0]);
        setRawRows(rows);
        setHeaders(hdrs);
        setMapping(autoDetectMapping(hdrs));
        setStep("mapping");
      };
      reader.readAsText(file, "UTF-8");
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: "" });
        // Ensure all values are strings
        const stringRows = rows.map((r) => {
          const sr: ParsedRow = {};
          for (const [k, v] of Object.entries(r)) {
            sr[k] = String(v ?? "");
          }
          return sr;
        });
        if (stringRows.length === 0) {
          toast.error("Planilha vazia.");
          return;
        }
        if (stringRows.length > MAX_ROWS) {
          toast.error(`Limite de ${MAX_ROWS.toLocaleString()} linhas.`);
          return;
        }
        const hdrs = Object.keys(stringRows[0]);
        setRawRows(stringRows);
        setHeaders(hdrs);
        setMapping(autoDetectMapping(hdrs));
        setStep("mapping");
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Step 2: Validate mapping ──

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const hasRequiredFields = SYSTEM_FIELDS.filter((f) => f.required).every((f) => mappedFields.has(f.key));

  // ── Step 3: Validate rows ──

  const runValidation = useCallback(async () => {
    // Build mapped data
    const mapped = rawRows.map((row) => {
      const result: Record<string, string> = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field) result[field] = (row[header] || "").trim();
      }
      return result;
    });

    // Fetch existing phones for duplicate check
    const phonesInFile = mapped
      .map((r) => normalizePhone(r.telefone || ""))
      .filter(isValidPhone);

    const emailsInFile = mapped
      .map((r) => (r.email || "").toLowerCase().trim())
      .filter(Boolean);

    // Batch check duplicates
    let existingPhones = new Set<string>();
    let existingEmails = new Set<string>();

    if (phonesInFile.length > 0) {
      // Check in batches of 100
      for (let i = 0; i < phonesInFile.length; i += 100) {
        const batch = phonesInFile.slice(i, i + 100);
        const suffixes = batch.map((p) => p.slice(-9));
        const orFilters = suffixes.map((s) => `telefone.ilike.%${s}%`).join(",");
        const { data } = await supabase
          .from("leads")
          .select("telefone")
          .is("deleted_at", null)
          .or(orFilters)
          .limit(500);
        if (data) {
          data.forEach((d: any) => {
            const norm = d.telefone?.replace(/\D/g, "");
            if (norm) existingPhones.add(norm.slice(-9));
          });
        }
      }
    }

    if (emailsInFile.length > 0) {
      for (let i = 0; i < emailsInFile.length; i += 100) {
        const batch = emailsInFile.slice(i, i + 100);
        const orFilters = batch.map((e) => `email.eq.${e}`).join(",");
        const { data } = await supabase
          .from("leads")
          .select("email")
          .is("deleted_at", null)
          .or(orFilters)
          .limit(500);
        if (data) {
          data.forEach((d: any) => {
            if (d.email) existingEmails.add(d.email.toLowerCase());
          });
        }
      }
    }

    // Validate each row
    const validated: ValidatedRow[] = mapped.map((row) => {
      const errors: string[] = [];
      let isDuplicate = false;

      // Required checks
      if (!row.nome || row.nome.length < 3) errors.push("Nome inválido (mín. 3 caracteres)");
      
      const phoneDigits = normalizePhone(row.telefone || "");
      if (!isValidPhone(phoneDigits)) {
        errors.push("Telefone inválido");
      } else {
        if (existingPhones.has(phoneDigits.slice(-9))) isDuplicate = true;
      }

      // Optional validations
      if (row.email && !EMAIL_RE.test(row.email)) errors.push("E-mail inválido");
      if (row.email && existingEmails.has(row.email.toLowerCase())) isDuplicate = true;

      if (row.media_consumo) {
        const val = Number(row.media_consumo);
        if (isNaN(val) || val <= 0) errors.push("Consumo inválido");
      }

      return { data: row, errors, isDuplicate };
    });

    setValidatedRows(validated);
    setStep("validation");
  }, [rawRows, mapping]);

  // ── Step 4: Import ──

  const validCount = validatedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate).length;
  const duplicateCount = validatedRows.filter((r) => r.isDuplicate && r.errors.length === 0).length;
  const errorCount = validatedRows.filter((r) => r.errors.length > 0).length;

  const handleImport = useCallback(async () => {
    setImporting(true);
    let imported = 0;

    try {
      const toImport = validatedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate);

      // Build consultant lookup
      const consultorLookup = new Map<string, string>();
      consultores.forEach((c) => {
        consultorLookup.set(c.nome.toLowerCase(), c.id);
      });

      // Build origin lookup
      const origemLookup = new Map<string, string>();
      origens.forEach((o) => {
        origemLookup.set(o.nome.toLowerCase(), o.id);
      });

      // Insert in batches of 50
      for (let i = 0; i < toImport.length; i += 50) {
        const batch = toImport.slice(i, i + 50);
        const rows = batch.map((r) => {
          const phoneDigits = normalizePhone(r.data.telefone || "");
          const canonical = toCanonicalPhoneDigits(r.data.telefone || "");
          const formattedPhone = phoneDigits.length === 11
            ? formatPhone(phoneDigits)
            : phoneDigits.length === 10
              ? formatPhone(phoneDigits)
              : r.data.telefone;

          const consultorNome = (r.data.consultor || "").trim();
          const consultorId = consultorNome ? consultorLookup.get(consultorNome.toLowerCase()) || null : null;

          const origemNome = (r.data.origem || "").trim();
          const origemId = origemNome ? origemLookup.get(origemNome.toLowerCase()) || null : null;

          return {
            nome: r.data.nome.trim(),
            telefone: formattedPhone,
            telefone_normalized: canonical,
            email: r.data.email?.trim() || null,
            cidade: r.data.cidade?.trim() || "",
            estado: r.data.estado?.trim().toUpperCase().slice(0, 2) || "",
            media_consumo: r.data.media_consumo ? Number(r.data.media_consumo) : 0,
            consumo_previsto: r.data.media_consumo ? Number(r.data.media_consumo) : 0,
            area: "Urbana",
            tipo_telhado: "Outro",
            rede_atendimento: "Monofásica",
            observacoes: r.data.observacoes?.trim() || null,
            consultor_id: consultorId,
            consultor: consultorId ? consultorNome : null,
            lead_origem_id: origemId,
            visto: false,
            visto_admin: false,
          };
        });

        const { error } = await supabase.from("leads").insert(rows as any);
        if (error) {
          console.error("[ImportarLeads] Batch insert error:", error);
        } else {
          imported += rows.length;
        }
      }

      setResult({ imported, duplicates: duplicateCount, errors: errorCount });
      setStep("result");
      if (imported > 0) onSuccess?.();
    } catch (err: any) {
      console.error("[ImportarLeads] Import error:", err);
      toast.error("Erro ao importar: " + (err.message || "Tente novamente"));
    } finally {
      setImporting(false);
    }
  }, [validatedRows, consultores, origens, duplicateCount, errorCount, onSuccess]);

  // ── Render ──

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Importar Leads
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "upload" && "Faça upload de um arquivo CSV ou XLSX"}
              {step === "mapping" && "Mapeie as colunas do arquivo para os campos do sistema"}
              {step === "validation" && "Revise os dados antes de importar"}
              {step === "result" && "Importação concluída"}
            </p>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {(["upload", "mapping", "validation", "result"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  s === step ? "bg-primary" : i < ["upload", "mapping", "validation", "result"].indexOf(step) ? "bg-primary/40" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5">
            {/* ── Step 1: Upload ── */}
            {step === "upload" && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    Arraste um arquivo ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV ou XLSX • Máximo {MAX_ROWS.toLocaleString()} linhas
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                <Button variant="outline" size="sm" onClick={downloadModelCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Baixar modelo CSV
                </Button>
              </div>
            )}

            {/* ── Step 2: Mapping ── */}
            {step === "mapping" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {rawRows.length.toLocaleString()} linhas detectadas • {headers.length} colunas
                  </p>
                </div>

                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Coluna do Arquivo</TableHead>
                        <TableHead className="font-semibold text-foreground">Exemplo</TableHead>
                        <TableHead className="font-semibold text-foreground w-48">Campo do Sistema</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {headers.map((header) => (
                        <TableRow key={header}>
                          <TableCell className="font-medium text-foreground">{header}</TableCell>
                          <TableCell className="text-muted-foreground text-xs truncate max-w-[200px]">
                            {rawRows[0]?.[header] || "—"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={mapping[header] || "_none"}
                              onValueChange={(val) =>
                                setMapping((prev) => ({ ...prev, [header]: val === "_none" ? "" : val }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Ignorar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">— Ignorar —</SelectItem>
                                {SYSTEM_FIELDS.map((f) => (
                                  <SelectItem key={f.key} value={f.key} disabled={mappedFields.has(f.key) && mapping[header] !== f.key}>
                                    {f.label} {f.required ? "*" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {!hasRequiredFields && (
                  <div className="flex items-center gap-2 text-warning text-sm p-3 bg-warning/10 rounded-lg">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Mapeie os campos obrigatórios: Nome e Telefone
                  </div>
                )}

                <div className="flex items-center gap-2 justify-between">
                  <Button variant="ghost" onClick={reset}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={runValidation} disabled={!hasRequiredFields}>
                    Validar dados
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Validation ── */}
            {step === "validation" && (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-foreground">{validCount}</p>
                      <p className="text-xs text-muted-foreground">Válidos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                    <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-foreground">{duplicateCount}</p>
                      <p className="text-xs text-muted-foreground">Duplicados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-foreground">{errorCount}</p>
                      <p className="text-xs text-muted-foreground">Com erro</p>
                    </div>
                  </div>
                </div>

                {/* Preview table */}
                <p className="text-xs text-muted-foreground">Prévia dos primeiros 10 registros:</p>
                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground w-10">#</TableHead>
                        <TableHead className="font-semibold text-foreground">Nome</TableHead>
                        <TableHead className="font-semibold text-foreground">Telefone</TableHead>
                        <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validatedRows.slice(0, 10).map((row, i) => (
                        <TableRow key={i} className={row.errors.length > 0 ? "bg-destructive/5" : row.isDuplicate ? "bg-warning/5" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm text-foreground">{row.data.nome || "—"}</TableCell>
                          <TableCell className="text-sm text-foreground">{row.data.telefone || "—"}</TableCell>
                          <TableCell className="text-sm text-foreground">{row.data.email || "—"}</TableCell>
                          <TableCell>
                            {row.errors.length > 0 ? (
                              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                {row.errors[0]}
                              </Badge>
                            ) : row.isDuplicate ? (
                              <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                                Duplicado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center gap-2 justify-between">
                  <Button variant="ghost" onClick={() => setStep("mapping")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={handleImport} disabled={importing || validCount === 0}>
                    {importing ? (
                      <>
                        <Spinner size="sm" />
                        Importando...
                      </>
                    ) : (
                      <>
                        Importar {validCount} leads
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 4: Result ── */}
            {step === "result" && result && (
              <div className="space-y-6 py-6 text-center">
                <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                <div>
                  <p className="text-xl font-bold text-foreground">Importação concluída!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {result.imported} leads importados
                    {result.duplicates > 0 && ` • ${result.duplicates} duplicados ignorados`}
                    {result.errors > 0 && ` • ${result.errors} com erro`}
                  </p>
                </div>
                <Button onClick={() => handleClose(false)}>Fechar</Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
