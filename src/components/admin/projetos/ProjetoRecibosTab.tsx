// Lista de recibos vinculados a um projeto/cliente/deal e ações rápidas.
// Reutilizado em ProjetoDetalhe e ClienteViewDialog.
// SSOT: useRecibos. Sem duplicação de domínio.
import { useState, useEffect, useRef } from "react";
import { Receipt, FileText, Download, Send, RefreshCw, Trash2, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui-kit";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  useRecibos, useReciboPDF, useDeleteRecibo, useEnviarReciboWa,
  useReciboLogs, getReciboSignedUrl, type Recibo, type ReciboFilters,
} from "@/hooks/useRecibos";
import { EmitirReciboModal } from "@/components/admin/documentos/EmitirReciboModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  formatBRL, 
  formatDateTime, 
  displayCpfCnpj, 
  formatNameCapitalize 
} from "@/lib/formatters/index";

const STATUS_LABEL: Record<Recibo["status"], string> = {
  emitido: "Emitido",
  cancelado: "Cancelado",
};

const STATUS_VARIANT: Record<Recibo["status"], string> = {
  emitido: "bg-info/10 text-info border-info/20",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20",
};

interface ProjetoRecibosTabProps {
  filters: ReciboFilters;            // { projeto_id?, cliente_id? }
  defaultClienteId?: string;
  defaultProjetoId?: string;
  defaultDealId?: string;
  title?: string;
  emptyDescription?: string;
}

export function ProjetoRecibosTab({
  filters,
  defaultClienteId,
  defaultProjetoId,
  defaultDealId,
  title = "Recibos",
  emptyDescription = "Nenhum recibo emitido ainda. Clique em \"Emitir recibo\" para gerar o primeiro.",
}: ProjetoRecibosTabProps) {
  const { data: recibos, isLoading } = useRecibos(filters);
  const regen = useReciboPDF();
  const del = useDeleteRecibo();
  const enviar = useEnviarReciboWa();

  const [emitirOpen, setEmitirOpen] = useState(false);
  const [logsReciboId, setLogsReciboId] = useState<string | null>(null);
  const [financeiro, setFinanceiro] = useState<{ valor_total: number; total_pago: number; saldo_devedor: number; percentual_pago: number } | null>(null);

  useEffect(() => {
    if (defaultProjetoId) {
      supabase.rpc('get_saldo_projeto', { p_projeto_id: defaultProjetoId })
        .then(({ data }) => setFinanceiro(data as any));
    }
  }, [defaultProjetoId, recibos]);

  const requestIdRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  async function handleOpenPdf(r: Recibo) {
    const currentId = ++requestIdRef.current;
    const toastId = toast.loading("Preparando PDF...");
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (currentId === requestIdRef.current) {
        toast.dismiss(toastId);
        toast.error("Tempo esgotado ao abrir PDF. Tente regerar o arquivo.");
      }
    }, 8000);

    try {
      let path = r.pdf_url;
      if (!path) {
        const res = await regen.mutateAsync(r.id);
        path = res.pdf_url;
      }
      
      if (currentId !== requestIdRef.current) {
        toast.dismiss(toastId);
        return;
      }

      const url = await getReciboSignedUrl(path!);
      
      if (currentId !== requestIdRef.current) {
        toast.dismiss(toastId);
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
      toast.dismiss(toastId);
    } catch (e: any) {
      if (currentId === requestIdRef.current) {
        toast.dismiss(toastId);
        toast.error(e?.message || "Não foi possível abrir o PDF");
      }
    } finally {
      if (currentId === requestIdRef.current && timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {financeiro && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor Total</p>
              <p className="text-xl font-bold">{formatBRL(financeiro.valor_total)}</p>
            </CardContent>
          </Card>
          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-4">
              <p className="text-[10px] text-success uppercase font-bold tracking-wider">Recebido ({financeiro.percentual_pago}%)</p>
              <p className="text-xl font-bold text-success">{formatBRL(financeiro.total_pago)}</p>
              <div className="w-full bg-success/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-success h-full transition-all" style={{ width: `${financeiro.percentual_pago}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="pt-4">
              <p className="text-[10px] text-destructive uppercase font-bold tracking-wider">Saldo Devedor</p>
              <p className="text-xl font-bold text-destructive">{formatBRL(financeiro.saldo_devedor)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {title}{recibos?.length ? ` (${recibos.length})` : ""}
          </CardTitle>
          <Button size="sm" onClick={() => setEmitirOpen(true)} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Emitir recibo
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState context="config" message="Carregando recibos..." />
          ) : (recibos ?? []).length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum recibo"
              description={emptyDescription}
              action={{ label: "Emitir recibo", onClick: () => setEmitirOpen(true), icon: FileText }}
            />
          ) : (
            <div className="space-y-2">
              {recibos!.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {r.cliente?.nome ?? "—"}
                      </span>
                      {r.cliente?.cnpj_cpf && (
                        <span className="text-xs text-muted-foreground">
                          ({displayCpfCnpj(r.cliente.cnpj_cpf)})
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${STATUS_VARIANT[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      {r.template && (
                        <Badge variant="secondary" className="text-[10px]">{r.template}</Badge>
                      )}
                      {r.numero && (
                        <Badge variant="outline" className="text-[10px]">Nº {r.numero}</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatBRL(Number(r.valor))} • {formatDateTime(r.created_at)}
                      {r.forma_pagamento && (
                        <Badge variant="outline" className="text-[9px] ml-2">
                          {formatNameCapitalize(r.forma_pagamento)}
                        </Badge>
                      )}
                    </p>
                    {r.descricao && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.descricao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      title="Abrir PDF" onClick={() => handleOpenPdf(r)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      title="Enviar por WhatsApp"
                      disabled={enviar.isPending}
                      onClick={() => enviar.mutate({ recibo_id: r.id })}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      title="Histórico de envios"
                      onClick={() => setLogsReciboId(r.id)}
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      title="Regerar PDF"
                      disabled={regen.isPending}
                      onClick={() => regen.mutate(r.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title={r.status === 'cancelado' ? "Já cancelado" : "Cancelar recibo"}
                      disabled={r.status === 'cancelado'}
                      onClick={() => { if (confirm("Deseja cancelar este recibo? O status será alterado para cancelado.")) del.mutate(r.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EmitirReciboModal
        open={emitirOpen}
        onOpenChange={setEmitirOpen}
        defaultClienteId={defaultClienteId}
        defaultProjetoId={defaultProjetoId}
        defaultDealId={defaultDealId}
        onEmitted={() => {
          toast.success("Recibo emitido com sucesso");
        }}
      />

      <ReciboLogsDialog
        reciboId={logsReciboId}
        onClose={() => setLogsReciboId(null)}
      />
    </div>
  );
}

function ReciboLogsDialog({ reciboId, onClose }: { reciboId: string | null; onClose: () => void }) {
  const { data: logs, isLoading } = useReciboLogs(reciboId);
  return (
    <Dialog open={!!reciboId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico do recibo
          </DialogTitle>
          <DialogDescription>Eventos de envio e geração registrados.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoadingState context="config" message="Carregando histórico..." />
        ) : (logs ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nenhum evento registrado.
          </p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-premium">
            {logs!.map((l) => (
              <div key={l.id} className="rounded border border-border p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{l.tipo}</Badge>
                    {l.canal && <Badge variant="outline" className="text-[10px]">{l.canal}</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(l.created_at), "dd/MM/yy HH:mm")}
                  </span>
                </div>
                {l.destino && (
                  <p className="text-[11px] text-muted-foreground mt-1">→ {l.destino}</p>
                )}
                {l.mensagem && (
                  <p className="text-[11px] mt-1 whitespace-pre-line line-clamp-4">{l.mensagem}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
