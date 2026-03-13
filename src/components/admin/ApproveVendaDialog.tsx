import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle, User, MapPin, Phone, Zap, DollarSign, FileText,
  AlertTriangle, Download, X, Eye,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { formatBRL } from "@/lib/formatters";
import { formatPhoneBR } from "@/lib/formatters/index";
import { formatKwh } from "@/lib/formatters/index";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PendingValidation } from "@/hooks/usePendingValidations";

interface LeadSimulacao {
  id: string;
  investimento_estimado: number | null;
  potencia_recomendada_kwp: number | null;
  economia_mensal: number | null;
  consumo_kwh: number | null;
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
  valorVenda: string;
  onValorVendaChange: (v: string) => void;
  percentualComissao: string;
  onPercentualChange: (v: string) => void;
  onApprove: () => void;
  approving: boolean;
  isValid: boolean;
  documents: DocumentItem[];
}

function DataCard({ label, value, icon: Icon, valueClass }: {
  label: string;
  value: string;
  icon: React.ElementType;
  valueClass?: string;
}) {
  const isUnavailable = !value || value === "—" || value === "0" || value === "R$ 0,00";
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

function DocumentPreviewDialog({ url, open, onClose }: { url: string; open: boolean; onClose: () => void }) {
  const isPdf = url.toLowerCase().includes(".pdf");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <DialogTitle className="text-sm font-semibold text-foreground flex-1">Preview do Documento</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          {isPdf ? (
            <iframe src={url} className="w-full h-[70vh] rounded-lg border border-border" />
          ) : (
            <div className="flex items-center justify-center">
              <img src={url} alt="Documento" className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <a href={url} download target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1.5" /> Baixar
            </Button>
          </a>
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
}: ApproveVendaDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  console.debug("[ApproveVendaDialog] data:", {
    selectedSimulacaoId,
    selectedSim,
    firstSim,
    clienteSimulacoes: cliente.simulacoes,
    leadMediaConsumo: cliente.leads?.media_consumo,
    orcConsumo,
    potencia, consumo, valorProposta,
    documents,
    leadArquivos: cliente.leads?.arquivos_urls,
    orcArquivos: cliente.leads?.orcamentos?.map(o => o.arquivos_urls),
  });

  const valorComissao = () => {
    const base = parseFloat(valorVenda) || 0;
    return (base * (parseFloat(percentualComissao) || 0)) / 100;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-[780px] p-0 gap-0 overflow-hidden">
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

          {/* BODY — 2 colunas §25 */}
          <div className="overflow-y-auto min-h-0 flex-1 max-h-[70vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <DataCard icon={Zap} label="Potência" value={potencia ? `${potencia} kWp` : "—"} />
                    <DataCard icon={Zap} label="Consumo médio" value={consumo ? formatKwh(consumo, 0) : "—"} />
                    <DataCard icon={DollarSign} label="Valor proposta" value={formatBRL(valorProposta)} valueClass="text-success" />
                  </div>
                </div>
              </div>

              {/* ═══ COLUNA DIREITA — Documentos + Comissão ═══ */}
              <div className="p-5 space-y-5">
                {/* Documentos anexados */}
                {documents.length > 0 && (
                  <>
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
                              onClick={() => hasFiles && doc.urls && setPreviewUrl(doc.urls[0])}
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
                    <div className="border-t border-border" />
                  </>
                )}

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
                    <Input
                      id="av-valor"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 35000.00"
                      value={valorVenda}
                      onChange={(e) => onValorVendaChange(e.target.value)}
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
              </div>
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
      {previewUrl && (
        <DocumentPreviewDialog
          url={previewUrl}
          open={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </>
  );
}