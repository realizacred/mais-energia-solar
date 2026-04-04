import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentComposer } from "@/components/admin/vendas/PaymentComposer";
import type { PaymentItemInput } from "@/services/paymentComposition/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle, User, MapPin, Phone, Zap, DollarSign, FileText,
  AlertTriangle, Download, X, Eye, Sun, TrendingDown, Clock, Navigation, Wrench, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { formatBRL } from "@/lib/formatters";
import { formatPhoneBR } from "@/lib/formatters/index";
import { formatKwh } from "@/lib/formatters/index";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { PendingValidation } from "@/hooks/usePendingValidations";

interface LeadSimulacao {
  id: string;
  investimento_estimado: number | null;
  potencia_recomendada_kwp: number | null;
  economia_mensal: number | null;
  consumo_kwh: number | null;
  geracao_mensal_estimada: number | null;
  payback_meses: number | null;
  created_at: string;
}

interface Vendedor {
  id: string;
  nome: string;
  percentual_comissao: number | null;
}

interface DocumentItem {
  label: string;
  urls: string[] | null;
}

interface ApproveVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: PendingValidation | null;
  vendedores: Vendedor[];
  leadSimulacoes: LeadSimulacao[];
  loadingVendedor: boolean;
  selectedVendedorId: string;
  onVendedorChange: (id: string) => void;
  selectedSimulacaoId: string;
  onSimulacaoChange: (id: string) => void;
  valorVenda: number;
  onValorVendaChange: (v: number) => void;
  percentualComissao: string;
  onPercentualChange: (v: string) => void;
  onApprove: () => void;
  approving: boolean;
  isValid: boolean;
  documents: DocumentItem[];
  /** Payment composition items — optional, enables the payment composer */
  paymentItems?: PaymentItemInput[];
  onPaymentItemsChange?: (items: PaymentItemInput[]) => void;
}

function DataCard({ label, value, icon: Icon, valueClass }: {
  label: string;
  value: string;
  icon: React.ElementType;
  valueClass?: string;
}) {
  const isUnavailable = !value || value === "—" || value === "0" || value === "R$ 0,00" || value === "0 kWh";
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      {isUnavailable ? (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">
          Dado indisponível
        </Badge>
      ) : (
        <p className={`text-sm font-semibold ${valueClass || "text-foreground"}`}>{value}</p>
      )}
    </div>
  );
}

/** Resolves a storage path to a signed URL. Returns the URL or null. */
async function resolveStorageUrl(path: string, bucket = "documentos-clientes"): Promise<string | null> {
  // Already a full URL
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      console.warn("[resolveStorageUrl] Failed for path:", path, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn("[resolveStorageUrl] Error:", e);
    return null;
  }
}

function DocumentPreviewDialog({ urls, open, onClose }: { urls: string[]; open: boolean; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || urls.length === 0) return;
    setLoading(true);
    setCurrentIndex(0);
    Promise.all(urls.map((u) => resolveStorageUrl(u).then((r) => r || u))).then((resolved) => {
      setResolvedUrls(resolved);
      setLoading(false);
    });
  }, [urls, open]);

  const displayUrl = resolvedUrls[currentIndex] || urls[currentIndex] || "";
  const isPdf = displayUrl.toLowerCase().includes(".pdf");
  const total = urls.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <DialogTitle className="text-sm font-semibold text-foreground flex-1">
            Preview do Documento{total > 1 ? ` (${currentIndex + 1}/${total})` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="relative p-4">
          {loading ? (
            <div className="flex items-center justify-center h-[50vh]">
              <Spinner size="lg" />
            </div>
          ) : isPdf ? (
            <iframe src={displayUrl} className="w-full h-[70vh] rounded-lg border border-border" />
          ) : (
            <div className="flex items-center justify-center">
              <img src={displayUrl} alt="Documento" className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          )}
          {/* Navigation arrows */}
          {total > 1 && !loading && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100"
                onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : total - 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100"
                onClick={() => setCurrentIndex((i) => (i < total - 1 ? i + 1 : 0))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch(displayUrl);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = `documento-${currentIndex + 1}${isPdf ? ".pdf" : ".jpg"}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
              } catch {
                window.open(displayUrl, "_blank");
              }
            }}
          >
            <Download className="w-4 h-4 mr-1.5" /> Baixar
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApproveVendaDialog({
  open,
  onOpenChange,
  cliente,
  vendedores,
  leadSimulacoes,
  loadingVendedor,
  selectedVendedorId,
  onVendedorChange,
  selectedSimulacaoId,
  onSimulacaoChange,
  valorVenda,
  onValorVendaChange,
  percentualComissao,
  onPercentualChange,
  onApprove,
  approving,
  isValid,
  documents,
  paymentItems,
  onPaymentItemsChange,
}: ApproveVendaDialogProps) {
  const [previewUrls, setPreviewUrls] = useState<string[] | null>(null);

  if (!cliente) return null;

  // Fallback chain: selected sim → accepted sim (FK) → first loaded sim → client fields → lead fields
  const selectedSim = leadSimulacoes.find(s => s.id === selectedSimulacaoId);
  const firstSim = leadSimulacoes.length > 0 ? leadSimulacoes[0] : null;
  const orcConsumo = cliente.leads?.orcamentos?.[0]?.media_consumo;

  const potencia = selectedSim?.potencia_recomendada_kwp
    || cliente.simulacoes?.potencia_recomendada_kwp
    || firstSim?.potencia_recomendada_kwp
    || cliente.potencia_kwp
    || 0;

  const consumo = selectedSim?.consumo_kwh
    || cliente.simulacoes?.consumo_kwh
    || firstSim?.consumo_kwh
    || cliente.leads?.media_consumo
    || orcConsumo
    || 0;

  const valorProposta = selectedSim?.investimento_estimado
    || cliente.simulacoes?.investimento_estimado
    || firstSim?.investimento_estimado
    || cliente.valor_projeto
    || 0;

  // NEW: Geração mensal estimada
  const geracaoMensal = selectedSim?.geracao_mensal_estimada
    || cliente.simulacoes?.geracao_mensal_estimada
    || firstSim?.geracao_mensal_estimada
    || 0;

  // NEW: Economia mensal
  const economiaMensal = selectedSim?.economia_mensal
    || cliente.simulacoes?.economia_mensal
    || firstSim?.economia_mensal
    || 0;

  // NEW: Payback
  const paybackMeses = selectedSim?.payback_meses
    || cliente.simulacoes?.payback_meses
    || firstSim?.payback_meses
    || 0;

  const disjuntorInfo = cliente.disjuntores?.amperagem
    ? `${cliente.disjuntores.amperagem}A${cliente.disjuntores.descricao ? ` · ${cliente.disjuntores.descricao}` : ""}`
    : (cliente.disjuntor_id ? "Configurado" : "—");

  const transformadorInfo = cliente.transformadores?.potencia_kva
    ? `${cliente.transformadores.potencia_kva} kVA${cliente.transformadores.descricao ? ` · ${cliente.transformadores.descricao}` : ""}`
    : (cliente.transformador_id ? "Configurado" : "—");

  const localizacaoInfo = cliente.localizacao
    ? (cliente.localizacao.includes("google.com/maps") ? "Link de localização informado" : cliente.localizacao)
    : "—";

  // console.debug("[ApproveVendaDialog] data:", {
  //   selectedSimulacaoId, selectedSim, firstSim,
  //   clienteSimulacoes: cliente.simulacoes,
  //   leadMediaConsumo: cliente.leads?.media_consumo,
  //   orcConsumo, potencia, consumo, valorProposta,
  //   geracaoMensal, economiaMensal, paybackMeses,
  //   disjuntorInfo, transformadorInfo, localizacaoInfo,
  //   transformador_id: cliente.transformador_id,
  //   transformadores_raw: cliente.transformadores,
  //   disjuntor_id: cliente.disjuntor_id,
  //   disjuntores_raw: cliente.disjuntores,
  //   documents,
  // });

  const valorComissao = () => {
    const base = valorVenda || 0;
    return (base * (parseFloat(percentualComissao) || 0)) / 100;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-[900px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          {/* HEADER §25 */}
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Aprovar Venda</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revise todos os dados antes de confirmar
              </p>
            </div>
          </DialogHeader>

          {/* BODY — 2 COLUNAS OBRIGATÓRIO */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border flex-1 min-h-0 overflow-y-auto">
              {/* ═══ COLUNA ESQUERDA — Dados ═══ */}
              <div className="p-5 space-y-5">
                {/* Dados do cliente */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Dados do cliente
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DataCard icon={User} label="Cliente" value={cliente.nome} />
                    <DataCard icon={Phone} label="Telefone" value={formatPhoneBR(cliente.telefone)} />
                    <DataCard icon={MapPin} label="Localização" value={[cliente.cidade, cliente.estado].filter(Boolean).join(", ") || "—"} />
                    <DataCard icon={FileText} label="Lead" value={cliente.leads?.lead_code || "—"} />
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Dados da proposta */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Dados da proposta
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DataCard icon={Zap} label="Potência" value={potencia ? `${potencia} kWp` : "—"} />
                    <DataCard icon={Zap} label="Consumo médio" value={consumo ? formatKwh(consumo, 0) : "—"} />
                    <DataCard icon={Sun} label="Geração prevista" value={geracaoMensal ? `${geracaoMensal.toFixed(0)} kWh/mês` : "—"} />
                    <DataCard icon={TrendingDown} label="Economia mensal" value={economiaMensal ? formatBRL(economiaMensal) : "—"} valueClass="text-success" />
                    <DataCard icon={Clock} label="Payback" value={paybackMeses ? `${Math.floor(paybackMeses / 12)}a ${paybackMeses % 12}m` : "—"} />
                    <DataCard icon={DollarSign} label="Valor proposta" value={formatBRL(valorProposta)} valueClass="text-primary" />
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Configurações técnicas */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Configurações técnicas
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DataCard icon={Wrench} label="Disjuntor" value={disjuntorInfo} />
                    <DataCard icon={Wrench} label="Transformador" value={transformadorInfo} />
                    <DataCard icon={Navigation} label="Localização" value={localizacaoInfo} />
                  </div>
                </div>

                {/* Documentos anexados */}
                <div className="border-t border-border" />
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Documentos anexados
                  </p>
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const hasFiles = doc.urls && doc.urls.length > 0;
                      return (
                        <div
                          key={doc.label}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            hasFiles
                              ? "bg-muted/50 border-border hover:bg-muted cursor-pointer"
                              : "bg-muted/30 border-warning/30"
                          }`}
                          onClick={() => hasFiles && doc.urls && setPreviewUrls(doc.urls)}
                        >
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm text-foreground">{doc.label}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              hasFiles
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-warning/10 text-warning border-warning/20"
                            }`}
                          >
                            {hasFiles ? `Anexado (${doc.urls!.length})` : "Pendente"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ═══ COLUNA DIREITA — Comissão ═══ */}
              <div className="p-5 space-y-5">
                {/* Comissão */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Comissão
                  </p>

                  {/* Vendedor selector */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5" />
                      Vendedor Responsável *
                    </Label>
                    <Select value={selectedVendedorId} onValueChange={onVendedorChange}>
                      <SelectTrigger className={!selectedVendedorId ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione o consultor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome}
                            {v.percentual_comissao != null && (
                              <span className="text-muted-foreground ml-1">({v.percentual_comissao}%)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedVendedorId && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Selecione o vendedor para gerar a comissão
                      </p>
                    )}
                  </div>

                  {/* Simulação selector */}
                  {loadingVendedor ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size="sm" />
                      <span className="ml-2 text-sm text-muted-foreground">Carregando propostas...</span>
                    </div>
                  ) : leadSimulacoes.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-sm">
                        <FileText className="h-3.5 w-3.5" />
                        Proposta ({leadSimulacoes.length})
                      </Label>
                      <Select value={selectedSimulacaoId} onValueChange={onSimulacaoChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma proposta" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadSimulacoes.map((sim) => (
                            <SelectItem key={sim.id} value={sim.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{sim.potencia_recomendada_kwp || 0} kWp</span>
                                <span className="text-muted-foreground">—</span>
                                <span>{sim.investimento_estimado ? formatBRL(sim.investimento_estimado) : "Sem valor"}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({format(new Date(sim.created_at), "dd/MM/yy", { locale: ptBR })})
                                </span>
                                {sim.id === cliente.simulacao_aceita_id && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">Aceita</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                          <SelectItem value="manual">
                            <span className="text-muted-foreground">✏️ Informar valor manualmente</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-warning p-3 bg-warning/10 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Nenhuma proposta encontrada — informe o valor manualmente</span>
                    </div>
                  )}

                  {/* Valor da venda */}
                  <div className="space-y-1.5">
                    <Label htmlFor="av-valor">Valor da Venda (R$) *</Label>
                    <CurrencyInput
                      id="av-valor"
                      value={valorVenda}
                      onChange={onValorVendaChange}
                    />
                    {!valorVenda && (
                      <p className="text-xs text-destructive">Informe o valor para gerar a comissão</p>
                    )}
                  </div>

                  {/* Percentual */}
                  <div className="space-y-1.5">
                    <Label htmlFor="av-perc" className="flex items-center gap-1.5">
                      Percentual de Comissão (%)
                      {loadingVendedor && <Spinner size="sm" />}
                    </Label>
                    <Input
                      id="av-perc"
                      type="number"
                      step="0.1"
                      value={percentualComissao}
                      onChange={(e) => onPercentualChange(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Pré-preenchido do cadastro do vendedor. Altere se necessário.
                    </p>
                  </div>

                  {/* Comissão preview */}
                  <div className="p-4 bg-success/10 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-success" />
                        <span className="font-medium text-sm text-foreground">Valor da Comissão</span>
                      </div>
                      <span className="text-xl font-bold text-success">{formatBRL(valorComissao())}</span>
                    </div>
                  </div>
                </div>

                {/* ── Composição de Pagamento ── */}
                {paymentItems && onPaymentItemsChange && (
                  <>
                    <div className="border-t border-border" />
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Composição de Pagamento
                      </p>
                      <PaymentComposer
                        valorVenda={valorVenda}
                        items={paymentItems}
                        onChange={onPaymentItemsChange}
                      />
                    </div>
                  </>
                )}
              </div>
          </div>

          {/* FOOTER §25 */}
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={onApprove}
              disabled={approving || !isValid}
            >
              {approving && <Spinner size="sm" className="mr-1.5" />}
              Confirmar Aprovação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document preview overlay */}
      {previewUrls && previewUrls.length > 0 && (
        <DocumentPreviewDialog
          urls={previewUrls}
          open={!!previewUrls}
          onClose={() => setPreviewUrls(null)}
        />
      )}
    </>
  );
}
