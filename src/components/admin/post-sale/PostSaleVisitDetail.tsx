import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateVisitStatus, PostSaleVisit } from "@/hooks/usePostSale";
import {
  useVisitChecklist,
  useChecklistTemplates,
  useApplyTemplate,
  useUpdateChecklistEntry,
} from "@/hooks/usePostSaleChecklist";
import {
  usePostSaleAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from "@/hooks/usePostSaleAttachments";
import { useVisitReport, useGenerateReport } from "@/hooks/usePostSaleReports";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, CalendarClock, XCircle, Upload, Trash2, Image as ImageIcon, FileDown, FileText } from "lucide-react";
import { LoadingState } from "@/components/ui-kit/LoadingState";

const TIPO_LABELS: Record<string, string> = {
  preventiva: "Preventiva", limpeza: "Limpeza", suporte: "Suporte",
  vistoria: "Vistoria", corretiva: "Corretiva",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  agendado: "bg-info/10 text-info border-info/30",
  concluido: "bg-success/10 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const CHECKLIST_STATUS_COLORS: Record<string, string> = {
  ok: "bg-success/10 text-success border-success/30",
  atencao: "bg-warning/10 text-warning border-warning/30",
  problema: "bg-destructive/10 text-destructive border-destructive/30",
  na: "bg-muted text-muted-foreground border-border",
};

const QUICK_LABELS = ["Antes da limpeza", "Depois da limpeza", "Leitura do inversor", "Painel geral", "Detalhe"];

export function PostSaleVisitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [conclusionOpen, setConclusionOpen] = useState(false);
  const [conclusionNotes, setConclusionNotes] = useState("");
  const [uploadLabel, setUploadLabel] = useState("Antes da limpeza");

  // Fetch visit
  const { data: visit, isLoading } = useQuery<PostSaleVisit>({
    queryKey: ["ps-visit-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_visits")
        .select("*, cliente:clientes(nome, telefone, cidade), projeto:projetos(nome, codigo, potencia_kwp)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useUpdateVisitStatus();
  const { data: checklist = [] } = useVisitChecklist(id);
  const { data: templates = [] } = useChecklistTemplates(visit?.tipo);
  const applyTemplate = useApplyTemplate();
  const updateEntry = useUpdateChecklistEntry();
  const { data: attachments = [] } = usePostSaleAttachments(id);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const { data: report } = useVisitReport(id);
  const generateReport = useGenerateReport();

  const canAct = visit && visit.status !== "concluido" && visit.status !== "cancelado";

  const handleConcluir = () => {
    if (!visit) return;
    updateStatus.mutate(
      { id: visit.id, status: "concluido", observacoes: conclusionNotes || undefined },
      {
        onSuccess: () => {
          setConclusionOpen(false);
          // Auto-generate PDF report
          generateReport.mutate(visit.id);
        },
      }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    await uploadAttachment.mutateAsync({ visitId: id, file, label: uploadLabel });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) return <LoadingState message="Carregando visita..." />;
  if (!visit) return <div className="p-6 text-center text-muted-foreground">Visita não encontrada</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{visit.cliente?.nome ?? "Visita"}</h1>
          <p className="text-sm text-muted-foreground">
            {visit.projeto?.codigo ?? visit.projeto?.nome} · {(visit.projeto as any)?.potencia_kwp ? `${(visit.projeto as any).potencia_kwp} kWp` : ""}
          </p>
        </div>
        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[visit.status]}`}>{visit.status}</Badge>
      </div>

      {/* Info */}
      <SectionCard title="Dados da Visita">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">Tipo:</span> <strong>{TIPO_LABELS[visit.tipo] ?? visit.tipo}</strong></div>
          <div><span className="text-muted-foreground">Data prevista:</span> <strong>{visit.data_prevista ? format(new Date(visit.data_prevista), "dd/MM/yyyy", { locale: ptBR }) : "—"}</strong></div>
          <div><span className="text-muted-foreground">Data agendada:</span> <strong>{visit.data_agendada ? format(new Date(visit.data_agendada), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</strong></div>
          <div><span className="text-muted-foreground">Telefone:</span> <strong>{visit.cliente?.telefone ?? "—"}</strong></div>
          <div><span className="text-muted-foreground">Cidade:</span> <strong>{(visit.cliente as any)?.cidade ?? "—"}</strong></div>
          {visit.observacoes && <div className="col-span-full"><span className="text-muted-foreground">Observações:</span> <p className="mt-1">{visit.observacoes}</p></div>}
        </div>
      </SectionCard>

      {/* Actions */}
      {canAct && (
        <div className="flex flex-wrap gap-2">
          {visit.status === "pendente" && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus.mutate({ id: visit.id, status: "agendado" })}>
              <CalendarClock className="h-3.5 w-3.5" /> Agendar
            </Button>
          )}
          <Button size="sm" className="gap-1" onClick={() => setConclusionOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
          </Button>
          <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus.mutate({ id: visit.id, status: "cancelado" })}>
            <XCircle className="h-3.5 w-3.5" /> Cancelar
          </Button>
        </div>
      )}

      {/* Checklist */}
      <SectionCard title="Checklist" description={checklist.length ? `${checklist.length} itens` : "Nenhum checklist aplicado"}>
        {checklist.length === 0 && canAct ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione um template para aplicar:</p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <Button key={t.id} size="sm" variant="outline"
                  disabled={applyTemplate.isPending}
                  onClick={() => applyTemplate.mutate({ visitId: visit.id, templateId: t.id })}>
                  {t.nome} ({t.items?.length ?? 0} itens)
                </Button>
              ))}
              {templates.length === 0 && <p className="text-xs text-muted-foreground">Nenhum template cadastrado para "{TIPO_LABELS[visit.tipo]}"</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {checklist.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card">
                <div className="flex-1">
                  <p className="text-sm font-medium">{entry.item?.descricao ?? "Item"}</p>
                  {entry.observacao && <p className="text-xs text-muted-foreground mt-1">{entry.observacao}</p>}
                </div>
                <Select
                  value={entry.status}
                  onValueChange={(val) => updateEntry.mutate({ id: entry.id, status: val, visitId: visit.id })}
                  disabled={!canAct}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ok">✅ OK</SelectItem>
                    <SelectItem value="atencao">⚠️ Atenção</SelectItem>
                    <SelectItem value="problema">❌ Problema</SelectItem>
                    <SelectItem value="na">— N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Attachments */}
      <SectionCard title="Anexos / Fotos" description={`${attachments.length} arquivo(s)`}>
        {canAct && (
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rótulo</label>
              <Select value={uploadLabel} onValueChange={setUploadLabel}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUICK_LABELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => fileRef.current?.click()} disabled={uploadAttachment.isPending}>
              <Upload className="h-3.5 w-3.5" /> {uploadAttachment.isPending ? "Enviando..." : "Upload"}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        )}
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {attachments.map(att => (
              <div key={att.id} className="relative group rounded-lg border border-border overflow-hidden bg-muted/30">
                {att.signedUrl ? (
                  <img src={att.signedUrl} alt={att.label ?? "Anexo"} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center bg-muted text-muted-foreground text-xs">Sem preview</div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-2 py-1 flex items-center justify-between">
                  <span className="text-xs truncate">{att.label ?? "—"}</span>
                  {canAct && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteAttachment.mutate({ id: att.id, visitId: visit.id })}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {attachments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo</p>}
      </SectionCard>

      {/* Report / PDF */}
      <SectionCard title="Relatório" description="PDF gerado automaticamente na conclusão">
        {report?.signedUrl ? (
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{report.file_name || "Relatório"}</p>
              <p className="text-xs text-muted-foreground">
                Gerado em {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1" asChild>
              <a href={report.signedUrl} target="_blank" rel="noopener noreferrer">
                <FileDown className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={() => generateReport.mutate(visit.id)}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? "Gerando..." : "Regerar"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2">
            <p className="text-sm text-muted-foreground flex-1">
              {visit.status === "concluido" ? "Nenhum relatório encontrado." : "O relatório será gerado ao concluir a visita."}
            </p>
            {visit.status === "concluido" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => generateReport.mutate(visit.id)}
                disabled={generateReport.isPending}
              >
                <FileText className="h-3.5 w-3.5" /> {generateReport.isPending ? "Gerando..." : "Gerar Relatório"}
              </Button>
            )}
          </div>
        )}
      </SectionCard>

      {/* Conclusion dialog */}
      <Dialog open={conclusionOpen} onOpenChange={setConclusionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Concluir visita</DialogTitle></DialogHeader>
          <Textarea placeholder="Observações da visita..." value={conclusionNotes} onChange={e => setConclusionNotes(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConclusionOpen(false)}>Cancelar</Button>
            <Button onClick={handleConcluir} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Salvando..." : "Concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PostSaleVisitDetail;
